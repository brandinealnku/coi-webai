const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

let mainWindow;
let isTracking = false;
let trackerInterval = null;
let currentSession = null;
let sessions = [];
let trackerSettings = {
  pollMs: 5000,
  ignoredApps: ['ScreenSaverEngine', 'WorkTrail Desktop Companion'],
  ignoredTitleIncludes: ['Developer Tools'],
  autoExportLatest: true
};

const dataDir = () => app.getPath('userData');
const sessionsFile = () => path.join(dataDir(), 'worktrail-sessions.json');
const settingsFile = () => path.join(dataDir(), 'worktrail-settings.json');
const latestExportFile = () => path.join(dataDir(), 'worktrail-latest-export.json');

async function getActiveWindowSafe() {
  const mod = await import('active-win');
  const fn = mod.default || mod;
  return fn();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1040,
    minHeight: 720,
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer.html'));
}

async function ensureDataDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function loadPersistedState() {
  sessions = await readJson(sessionsFile(), []);
  trackerSettings = {
    ...trackerSettings,
    ...(await readJson(settingsFile(), {}))
  };
}

async function persistSessions() {
  await writeJson(sessionsFile(), sessions);
  if (trackerSettings.autoExportLatest) {
    await writeJson(latestExportFile(), buildExportShape());
  }
}

async function persistSettings() {
  await writeJson(settingsFile(), trackerSettings);
}

function safeDomain(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

function getDurationMinutes(start, end) {
  const diff = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  return Math.round((diff / 60000) * 10) / 10;
}

function normalizeWindowInfo(info) {
  if (!info) return null;
  const appName = info.owner?.name || 'Unknown App';
  const title = info.title || appName;

  if ((trackerSettings.ignoredApps || []).includes(appName)) return null;
  if ((trackerSettings.ignoredTitleIncludes || []).some(term => term && title.toLowerCase().includes(term.toLowerCase()))) {
    return null;
  }

  return {
    app: appName,
    title,
    url: info.url || '',
    processId: info.owner?.processId || null,
    filePath: info.owner?.path || '',
    platform: process.platform,
    observedAt: new Date().toISOString()
  };
}

function sessionSignature(entry) {
  if (!entry) return 'none';
  return `${entry.app}__${entry.title}__${entry.url || ''}`;
}

function buildExportShape() {
  const finalized = currentSession ? [...sessions, currentSession] : [...sessions];
  return {
    exportedAt: new Date().toISOString(),
    source: 'desktop-companion',
    version: '0.5.0',
    activities: finalized.map(item => ({
      id: item.id,
      source: 'desktop-companion',
      title: item.title,
      app: item.app,
      domain: item.url ? safeDomain(item.url) : '',
      url: item.url || '',
      start: item.start,
      end: item.end,
      durationMinutes: getDurationMinutes(item.start, item.end),
      notes: item.notes || '',
      filePath: item.filePath || ''
    }))
  };
}

function pushUpdate() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const finalized = currentSession ? [...sessions, currentSession] : [...sessions];
  mainWindow.webContents.send('tracker:update', {
    isTracking,
    pollMs: trackerSettings.pollMs,
    settings: trackerSettings,
    sessionCount: finalized.length,
    currentSession,
    sessions: finalized,
    latestExportPath: latestExportFile()
  });
}

async function finalizeCurrentSession(endIso = new Date().toISOString()) {
  if (!currentSession) return;
  currentSession.end = endIso;
  if (getDurationMinutes(currentSession.start, currentSession.end) > 0) {
    sessions.push(currentSession);
    await persistSessions();
  }
  currentSession = null;
}

async function captureActiveWindow() {
  if (!isTracking) return;

  try {
    const active = normalizeWindowInfo(await getActiveWindowSafe());
    const nowIso = new Date().toISOString();
    if (!active) {
      pushUpdate();
      return;
    }

    if (!currentSession) {
      currentSession = {
        id: randomUUID(),
        app: active.app,
        title: active.title,
        url: active.url,
        start: nowIso,
        end: nowIso,
        notes: '',
        filePath: active.filePath
      };
      pushUpdate();
      return;
    }

    const currentSig = sessionSignature(currentSession);
    const nextSig = sessionSignature(active);

    if (currentSig === nextSig) {
      currentSession.end = nowIso;
      pushUpdate();
      return;
    }

    await finalizeCurrentSession(nowIso);
    currentSession = {
      id: randomUUID(),
      app: active.app,
      title: active.title,
      url: active.url,
      start: nowIso,
      end: nowIso,
      notes: '',
      filePath: active.filePath
    };

    pushUpdate();
  } catch (error) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tracker:error', error.message || String(error));
    }
  }
}

function restartInterval() {
  if (trackerInterval) clearInterval(trackerInterval);
  trackerInterval = null;
  if (isTracking) {
    trackerInterval = setInterval(captureActiveWindow, trackerSettings.pollMs);
  }
}

async function startTracking() {
  if (isTracking) return { ok: true, isTracking };
  isTracking = true;
  await captureActiveWindow();
  restartInterval();
  pushUpdate();
  return { ok: true, isTracking };
}

async function stopTracking() {
  if (!isTracking) return { ok: true, isTracking };
  isTracking = false;
  if (trackerInterval) clearInterval(trackerInterval);
  trackerInterval = null;
  await finalizeCurrentSession();
  pushUpdate();
  return { ok: true, isTracking };
}

ipcMain.handle('tracker:start', async () => startTracking());
ipcMain.handle('tracker:stop', async () => stopTracking());
ipcMain.handle('tracker:state', async () => ({
  isTracking,
  pollMs: trackerSettings.pollMs,
  settings: trackerSettings,
  currentSession,
  latestExportPath: latestExportFile(),
  sessions: currentSession ? [...sessions, currentSession] : [...sessions]
}));
ipcMain.handle('tracker:clear', async () => {
  sessions = [];
  currentSession = null;
  await persistSessions();
  pushUpdate();
  return { ok: true };
});
ipcMain.handle('tracker:export', async () => {
  const data = buildExportShape();
  const fileName = `worktrail-desktop-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export WorkTrail desktop sessions',
    defaultPath: path.join(app.getPath('downloads'), fileName),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });

  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  await fs.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf8');
  return { ok: true, filePath: result.filePath, count: data.activities.length };
});
ipcMain.handle('tracker:settings:get', async () => trackerSettings);
ipcMain.handle('tracker:settings:update', async (_event, nextSettings = {}) => {
  const pollMs = Number(nextSettings.pollMs);
  trackerSettings = {
    ...trackerSettings,
    ...nextSettings,
    pollMs: Number.isFinite(pollMs) ? Math.min(60000, Math.max(2000, pollMs)) : trackerSettings.pollMs,
    ignoredApps: Array.isArray(nextSettings.ignoredApps)
      ? nextSettings.ignoredApps.filter(Boolean)
      : trackerSettings.ignoredApps,
    ignoredTitleIncludes: Array.isArray(nextSettings.ignoredTitleIncludes)
      ? nextSettings.ignoredTitleIncludes.filter(Boolean)
      : trackerSettings.ignoredTitleIncludes
  };
  await persistSettings();
  restartInterval();
  pushUpdate();
  return { ok: true, settings: trackerSettings };
});
ipcMain.handle('tracker:open-data-folder', async () => {
  return { ok: true, path: dataDir(), latestExportPath: latestExportFile() };
});

app.whenReady().then(async () => {
  await loadPersistedState();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', async () => {
  await stopTracking();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
