const STORAGE_KEY = 'worktrail_extension_events_v1';
const SETTINGS_KEY = 'worktrail_extension_settings_v1';
const MAX_EVENTS = 1500;

let activeSession = null;

chrome.runtime.onInstalled.addListener(async () => {
  const saved = await chrome.storage.local.get([SETTINGS_KEY]);
  if (!saved[SETTINGS_KEY]) {
    await chrome.storage.local.set({
      [SETTINGS_KEY]: {
        enabled: true,
        ignoreDomains: ['mail.google.com', 'accounts.google.com', 'bank', 'canvas.instructure.com']
      }
    });
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  await startOrSwitchSession(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    await startOrSwitchSession(tab);
  }
});

chrome.windows.onFocusChanged.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
  await startOrSwitchSession(tab || null);
});

chrome.alarms.create('worktrailHeartbeat', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== 'worktrailHeartbeat') return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
  await startOrSwitchSession(tab || null, true);
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  handleExternalMessage(message).then(sendResponse);
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleInternalMessage(message).then(sendResponse);
  return true;
});

async function handleExternalMessage(message) {
  if (message?.type === 'PING') {
    return { ok: true, name: 'WorkTrail Tracker', version: '0.2.0' };
  }

  if (message?.type === 'GET_EVENTS') {
    const stored = await chrome.storage.local.get([STORAGE_KEY]);
    return { ok: true, events: stored[STORAGE_KEY] || [] };
  }

  if (message?.type === 'CLEAR_EVENTS') {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
    return { ok: true };
  }

  return { ok: false, error: 'Unknown external message type.' };
}

async function handleInternalMessage(message) {
  if (message?.type === 'GET_STATUS') {
    const settings = await getSettings();
    const stored = await chrome.storage.local.get([STORAGE_KEY]);
    return {
      ok: true,
      enabled: settings.enabled,
      eventCount: (stored[STORAGE_KEY] || []).length,
      activeSession
    };
  }

  if (message?.type === 'TOGGLE_ENABLED') {
    const settings = await getSettings();
    settings.enabled = !settings.enabled;
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    return { ok: true, enabled: settings.enabled };
  }

  if (message?.type === 'EXPORT_EVENTS') {
    const stored = await chrome.storage.local.get([STORAGE_KEY]);
    return { ok: true, events: stored[STORAGE_KEY] || [] };
  }

  return { ok: false, error: 'Unknown internal message type.' };
}

async function getSettings() {
  const saved = await chrome.storage.local.get([SETTINGS_KEY]);
  return saved[SETTINGS_KEY] || { enabled: true, ignoreDomains: [] };
}

async function startOrSwitchSession(tab, heartbeat = false) {
  const settings = await getSettings();
  if (!settings.enabled) return;

  const now = new Date();
  const nextSession = normalizeTab(tab);

  if (activeSession && (!nextSession || activeSession.key !== nextSession.key || heartbeat)) {
    await finalizeActiveSession(now);
  }

  if (nextSession && (!activeSession || activeSession.key !== nextSession.key)) {
    activeSession = {
      ...nextSession,
      startedAt: now.toISOString(),
      lastSeenAt: now.toISOString()
    };
    return;
  }

  if (activeSession) {
    activeSession.lastSeenAt = now.toISOString();
  }
}

function normalizeTab(tab) {
  if (!tab?.url) return null;
  let domain = '';
  try {
    const parsed = new URL(tab.url);
    if (!/^https?:/.test(parsed.protocol)) return null;
    domain = parsed.hostname;
    return {
      key: `${domain}::${tab.title || ''}`,
      title: tab.title || domain,
      domain,
      url: parsed.origin + parsed.pathname,
      app: 'Chrome'
    };
  } catch {
    return null;
  }
}

async function finalizeActiveSession(now = new Date()) {
  if (!activeSession) return;

  const settings = await getSettings();
  const ignoreDomains = settings.ignoreDomains || [];
  const durationMinutes = Math.max(1, Math.round((new Date(now) - new Date(activeSession.startedAt)) / 60000));

  if (!ignoreDomains.some(fragment => activeSession.domain.includes(fragment)) && durationMinutes > 0) {
    const event = {
      id: crypto.randomUUID(),
      source: 'browser-extension',
      title: activeSession.title,
      app: activeSession.app,
      domain: activeSession.domain,
      url: activeSession.url,
      start: activeSession.startedAt,
      end: now.toISOString(),
      durationMinutes,
      notes: '',
      importedAt: new Date().toISOString()
    };

    const stored = await chrome.storage.local.get([STORAGE_KEY]);
    const events = stored[STORAGE_KEY] || [];
    events.unshift(event);
    await chrome.storage.local.set({ [STORAGE_KEY]: events.slice(0, MAX_EVENTS) });
  }

  activeSession = null;
}
