const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { DatabaseSync } = require('node:sqlite');

let mainWindow;
let db;
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

const APP_VERSION = '0.7.0';
const dataDir = () => app.getPath('userData');
const dbFile = () => path.join(dataDir(), 'worktrail.db');
const sessionsFile = () => path.join(dataDir(), 'worktrail-sessions.json');
const settingsFile = () => path.join(dataDir(), 'worktrail-settings.json');
const latestExportFile = () => path.join(dataDir(), 'worktrail-latest-export.json');
const schemaFile = () => path.join(__dirname, 'schema.sql');

async function getActiveWindowSafe() {
  const mod = await import('active-win');
  const fn = mod.default || mod;
  return fn();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 920,
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

async function initDb() {
  await ensureDataDir();
  db = new DatabaseSync(dbFile());
  const schema = await fs.readFile(schemaFile(), 'utf8');
  db.exec(schema);
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

function sessionToActivity(item) {
  return {
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
  };
}

function buildExportShape() {
  const finalized = currentSession ? [...sessions, currentSession] : [...sessions];
  return {
    exportedAt: new Date().toISOString(),
    source: 'desktop-companion',
    version: APP_VERSION,
    activities: finalized.map(sessionToActivity)
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
    latestExportPath: latestExportFile(),
    dbPath: dbFile(),
    todaySummary: buildTodaySummary(finalized)
  });
}

function buildTodaySummary(items) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const todaysSessions = items.filter(item => {
    const d = new Date(item.start);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayKey;
  });
  const totalMinutes = Math.round(todaysSessions.reduce((sum, item) => sum + getDurationMinutes(item.start, item.end), 0));
  const byApp = new Map();
  todaysSessions.forEach(item => byApp.set(item.app, (byApp.get(item.app) || 0) + getDurationMinutes(item.start, item.end)));
  const topApp = [...byApp.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    sessionCount: todaysSessions.length,
    totalMinutes,
    topApp: topApp ? topApp[0] : '',
    text: todaysSessions.length
      ? `Today you captured ${todaysSessions.length} session${todaysSessions.length === 1 ? '' : 's'} totaling ${totalMinutes} minutes.${topApp ? ` Most-used app: ${topApp[0]}.` : ''}`
      : 'No desktop sessions captured yet today.'
  };
}

async function persistSessionsJson() {
  await writeJson(sessionsFile(), sessions);
  if (trackerSettings.autoExportLatest) {
    await writeJson(latestExportFile(), buildExportShape());
  }
}

async function persistSettings() {
  await writeJson(settingsFile(), trackerSettings);
}

function insertSessionIntoDb(session) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO sessions (
      id, source, title, app, url, domain, start_at, end_at, duration_minutes, notes, file_path, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    session.id,
    'desktop-companion',
    session.title,
    session.app,
    session.url || '',
    safeDomain(session.url || ''),
    session.start,
    session.end,
    getDurationMinutes(session.start, session.end),
    session.notes || '',
    session.filePath || '',
    new Date().toISOString()
  );
}

function loadSessionsFromDb() {
  if (!db) return [];
  const rows = db.prepare(`
    SELECT id, title, app, url, start_at as start, end_at as end, notes, file_path as filePath
    FROM sessions
    ORDER BY start_at ASC
  `).all();
  return rows.map(row => ({ ...row }));
}

async function migrateLegacyJsonSessions() {
  const legacy = await readJson(sessionsFile(), []);
  if (!legacy.length) return;
  const count = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
  if (count > 0) return;
  legacy.forEach(insertSessionIntoDb);
}

async function loadPersistedState() {
  trackerSettings = {
    ...trackerSettings,
    ...(await readJson(settingsFile(), {}))
  };
  sessions = loadSessionsFromDb();
}

async function finalizeCurrentSession(endIso = new Date().toISOString()) {
  if (!currentSession) return;
  currentSession.end = endIso;
  if (getDurationMinutes(currentSession.start, currentSession.end) > 0) {
    sessions.push(currentSession);
    insertSessionIntoDb(currentSession);
    await persistSessionsJson();
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
  if (isTracking) trackerInterval = setInterval(captureActiveWindow, trackerSettings.pollMs);
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
  dbPath: dbFile(),
  todaySummary: buildTodaySummary(currentSession ? [...sessions, currentSession] : [...sessions]),
  sessions: currentSession ? [...sessions, currentSession] : [...sessions]
}));
ipcMain.handle('tracker:clear', async () => {
  sessions = [];
  currentSession = null;
  db.exec('DELETE FROM sessions;');
  await persistSessionsJson();
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
    ignoredApps: Array.isArray(nextSettings.ignoredApps) ? nextSettings.ignoredApps.filter(Boolean) : trackerSettings.ignoredApps,
    ignoredTitleIncludes: Array.isArray(nextSettings.ignoredTitleIncludes) ? nextSettings.ignoredTitleIncludes.filter(Boolean) : trackerSettings.ignoredTitleIncludes
  };
  await persistSettings();
  restartInterval();
  pushUpdate();
  return { ok: true, settings: trackerSettings };
});
ipcMain.handle('tracker:open-data-folder', async () => {
  await shell.openPath(dataDir());
  return { ok: true, path: dataDir(), latestExportPath: latestExportFile(), dbPath: dbFile() };
});

app.whenReady().then(async () => {
  await initDb();
  await migrateLegacyJsonSessions();
  await loadPersistedState();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', async () => {
  await stopTracking();
  db?.close?.();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
