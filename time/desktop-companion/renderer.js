const els = {
  trackingStatus: document.getElementById('trackingStatus'),
  statusMessage: document.getElementById('statusMessage'),
  sessionCount: document.getElementById('sessionCount'),
  totalMinutes: document.getElementById('totalMinutes'),
  pollMs: document.getElementById('pollMs'),
  currentSessionOutput: document.getElementById('currentSessionOutput'),
  sessionList: document.getElementById('sessionList'),
  debugOutput: document.getElementById('debugOutput'),
  errorOutput: document.getElementById('errorOutput'),
  dataPaths: document.getElementById('dataPaths'),
  pollInput: document.getElementById('pollInput'),
  autoExportInput: document.getElementById('autoExportInput'),
  ignoredAppsInput: document.getElementById('ignoredAppsInput'),
  ignoredTitlesInput: document.getElementById('ignoredTitlesInput'),
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  exportBtn: document.getElementById('exportBtn'),
  openFolderBtn: document.getElementById('openFolderBtn'),
  clearBtn: document.getElementById('clearBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn')
};

function durationMinutes(start, end) {
  if (!start || !end) return 0;
  return Math.round(((new Date(end) - new Date(start)) / 60000) * 10) / 10;
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function settingsToForm(settings = {}) {
  els.pollInput.value = settings.pollMs || 5000;
  els.autoExportInput.checked = Boolean(settings.autoExportLatest);
  els.ignoredAppsInput.value = (settings.ignoredApps || []).join('\n');
  els.ignoredTitlesInput.value = (settings.ignoredTitleIncludes || []).join('\n');
}

function renderState(payload) {
  const sessions = payload.sessions || [];
  const currentSession = payload.currentSession;
  const totalMinutes = sessions.reduce((sum, item) => sum + durationMinutes(item.start, item.end), 0);

  els.trackingStatus.textContent = payload.isTracking ? 'Tracking on' : 'Tracking off';
  els.trackingStatus.classList.toggle('off', !payload.isTracking);
  els.statusMessage.textContent = payload.isTracking
    ? 'Tracking the frontmost app and window title locally on this device.'
    : 'Tracking is paused.';
  els.sessionCount.textContent = String(sessions.length);
  els.totalMinutes.textContent = String(Math.round(totalMinutes));
  els.pollMs.textContent = `${Math.round((payload.pollMs || 5000) / 1000)}s`;

  if (!currentSession) {
    els.currentSessionOutput.innerHTML = '<div class="muted">No active session yet.</div>';
  } else {
    els.currentSessionOutput.innerHTML = `
      <h3>${escapeHtml(currentSession.title)}</h3>
      <p class="muted">${escapeHtml(currentSession.app)}${currentSession.url ? ` · ${escapeHtml(currentSession.url)}` : ''}</p>
      <p class="muted">Started ${formatTime(currentSession.start)} · ${durationMinutes(currentSession.start, currentSession.end)} minutes so far</p>
    `;
  }

  if (!sessions.length) {
    els.sessionList.innerHTML = '<div class="muted">No sessions captured yet.</div>';
  } else {
    els.sessionList.innerHTML = sessions.slice().reverse().slice(0, 30).map(item => `
      <div class="session-item">
        <div class="session-top">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <div class="session-meta">${escapeHtml(item.app)}${item.url ? ` · ${escapeHtml(item.url)}` : ''}</div>
          </div>
          <div class="session-meta">${durationMinutes(item.start, item.end)} min</div>
        </div>
        <div class="session-meta">${formatTime(item.start)}–${formatTime(item.end)}</div>
      </div>
    `).join('');
  }

  const exportPreview = {
    exportedAt: new Date().toISOString(),
    source: 'desktop-companion',
    version: window.worktrailDesktop.version,
    activities: sessions.map(item => ({
      id: item.id,
      source: 'desktop-companion',
      title: item.title,
      app: item.app,
      url: item.url || '',
      start: item.start,
      end: item.end,
      durationMinutes: durationMinutes(item.start, item.end),
      notes: item.notes || ''
    }))
  };

  els.debugOutput.textContent = JSON.stringify(exportPreview, null, 2);
  if (payload.settings) settingsToForm(payload.settings);
  if (payload.latestExportPath) {
    els.dataPaths.innerHTML = `Latest export file:<br><code>${escapeHtml(payload.latestExportPath)}</code>`;
  }
}

async function refresh() {
  const state = await window.worktrailDesktop.getState();
  renderState(state);
}

async function saveSettings() {
  const payload = {
    pollMs: Number(els.pollInput.value || 5000),
    autoExportLatest: els.autoExportInput.checked,
    ignoredApps: els.ignoredAppsInput.value.split(/\n+/).map(v => v.trim()).filter(Boolean),
    ignoredTitleIncludes: els.ignoredTitlesInput.value.split(/\n+/).map(v => v.trim()).filter(Boolean)
  };
  await window.worktrailDesktop.updateSettings(payload);
  await refresh();
}

els.startBtn.addEventListener('click', async () => {
  await window.worktrailDesktop.startTracking();
  await refresh();
});

els.stopBtn.addEventListener('click', async () => {
  await window.worktrailDesktop.stopTracking();
  await refresh();
});

els.exportBtn.addEventListener('click', async () => {
  const result = await window.worktrailDesktop.exportSessions();
  if (result?.ok && result.filePath) {
    els.errorOutput.textContent = `Exported ${result.count} session${result.count === 1 ? '' : 's'} to ${result.filePath}`;
  }
});

els.clearBtn.addEventListener('click', async () => {
  await window.worktrailDesktop.clearSessions();
  await refresh();
});

els.saveSettingsBtn.addEventListener('click', saveSettings);
els.openFolderBtn.addEventListener('click', async () => {
  const result = await window.worktrailDesktop.openDataFolder();
  if (result?.ok) {
    els.dataPaths.innerHTML = `App data folder:<br><code>${escapeHtml(result.path)}</code><br><br>Latest export file:<br><code>${escapeHtml(result.latestExportPath)}</code>`;
  }
});

window.worktrailDesktop.onUpdate(renderState);
window.worktrailDesktop.onError(message => {
  els.errorOutput.textContent = message;
});

refresh();
