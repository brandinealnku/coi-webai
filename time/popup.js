const statusText = document.getElementById('statusText');
const toggleBtn = document.getElementById('toggleBtn');
const exportBtn = document.getElementById('exportBtn');
const extensionIdEl = document.getElementById('extensionId');

async function loadStatus() {
  const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
  extensionIdEl.textContent = chrome.runtime.id;
  if (!status?.ok) {
    statusText.textContent = 'Unable to read tracker status.';
    return;
  }
  statusText.textContent = `${status.enabled ? 'Tracking is on' : 'Tracking is paused'} • ${status.eventCount} saved browser sessions`;
  toggleBtn.textContent = status.enabled ? 'Pause tracking' : 'Resume tracking';
}

toggleBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'TOGGLE_ENABLED' });
  loadStatus();
});

exportBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(chrome.runtime.id);
  exportBtn.textContent = 'Copied extension ID';
  setTimeout(() => { exportBtn.textContent = 'Copy extension ID'; }, 1400);
});

loadStatus();
