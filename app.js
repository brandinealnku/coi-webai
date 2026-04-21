const STORAGE_KEY = 'worktrail-starter-v7';
const LEGACY_KEYS = ['worktrail-starter-v6', 'worktrail-starter-v5', 'worktrail-starter-v4'];

const seedProjects = [
  { id: crypto.randomUUID(), name: 'INF 286', description: 'Intro to Web Development' },
  { id: crypto.randomUUID(), name: 'INF 125', description: 'AI Literacy' },
  { id: crypto.randomUUID(), name: 'ITSBAD', description: 'Digital product and consulting work' }
];

const seedCategories = ['Teaching', 'Email', 'Meetings', 'Course Design', 'Coding', 'Design', 'Research', 'Admin', 'Planning'];

function createDefaultState() {
  return {
    activities: [],
    projects: [...seedProjects],
    categories: [...seedCategories],
    rules: [
      { id: crypto.randomUUID(), field: 'domain', value: 'canvas', projectId: seedProjects[0].id, category: 'Teaching' },
      { id: crypto.randomUUID(), field: 'domain', value: 'mail.google.com', projectId: '', category: 'Email' },
      { id: crypto.randomUUID(), field: 'title', value: 'INF 125', projectId: seedProjects[1].id, category: 'Course Design' },
      { id: crypto.randomUUID(), field: 'app', value: 'VS Code', projectId: seedProjects[2].id, category: 'Coding' }
    ],
    settings: {
      extensionId: '',
      lastDesktopImportAt: '',
      lastBrowserImportAt: ''
    }
  };
}

let state = loadState();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return normalizeState(saved);
  for (const key of LEGACY_KEYS) {
    const legacy = localStorage.getItem(key);
    if (legacy) {
      const migrated = normalizeState(legacy);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  }
  return createDefaultState();
}

function normalizeState(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const fallback = createDefaultState();
    const next = {
      activities: Array.isArray(parsed.activities) ? parsed.activities.map(normalizeActivity).filter(Boolean) : [],
      projects: Array.isArray(parsed.projects) && parsed.projects.length ? parsed.projects : fallback.projects,
      categories: Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : fallback.categories,
      rules: Array.isArray(parsed.rules) ? parsed.rules : fallback.rules,
      settings: {
        extensionId: parsed.settings?.extensionId || '',
        lastDesktopImportAt: parsed.settings?.lastDesktopImportAt || '',
        lastBrowserImportAt: parsed.settings?.lastBrowserImportAt || ''
      }
    };
    next.activities = dedupeActivities(next.activities);
    return next;
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const els = {
  navButtons: document.querySelectorAll('.nav-btn'),
  views: document.querySelectorAll('.view'),
  viewTitle: document.getElementById('viewTitle'),
  trackerStatus: document.getElementById('trackerStatus'),
  activityForm: document.getElementById('activityForm'),
  activityTitle: document.getElementById('activityTitle'),
  activitySource: document.getElementById('activitySource'),
  activityApp: document.getElementById('activityApp'),
  activityDomain: document.getElementById('activityDomain'),
  activityStart: document.getElementById('activityStart'),
  activityEnd: document.getElementById('activityEnd'),
  activityProject: document.getElementById('activityProject'),
  activityCategory: document.getElementById('activityCategory'),
  activityNotes: document.getElementById('activityNotes'),
  applyRulesBtn: document.getElementById('applyRulesBtn'),
  recentActivityList: document.getElementById('recentActivityList'),
  sourceBreakdownList: document.getElementById('sourceBreakdownList'),
  timelineList: document.getElementById('timelineList'),
  timelineSearch: document.getElementById('timelineSearch'),
  timelineProjectFilter: document.getElementById('timelineProjectFilter'),
  timelineSourceFilter: document.getElementById('timelineSourceFilter'),
  projectForm: document.getElementById('projectForm'),
  projectName: document.getElementById('projectName'),
  projectDescription: document.getElementById('projectDescription'),
  projectTotalsList: document.getElementById('projectTotalsList'),
  ruleForm: document.getElementById('ruleForm'),
  ruleField: document.getElementById('ruleField'),
  ruleValue: document.getElementById('ruleValue'),
  ruleProject: document.getElementById('ruleProject'),
  ruleCategory: document.getElementById('ruleCategory'),
  rulesList: document.getElementById('rulesList'),
  reportSummary: document.getElementById('reportSummary'),
  reportBreakdowns: document.getElementById('reportBreakdowns'),
  metricSessions: document.getElementById('metricSessions'),
  metricMinutes: document.getElementById('metricMinutes'),
  metricProjects: document.getElementById('metricProjects'),
  metricRules: document.getElementById('metricRules'),
  todayFocusProject: document.getElementById('todayFocusProject'),
  todaySummaryText: document.getElementById('todaySummaryText'),
  seedDemoBtn: document.getElementById('seedDemoBtn'),
  clearDataBtn: document.getElementById('clearDataBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  importJsonInput: document.getElementById('importJsonInput'),
  desktopImportInput: document.getElementById('desktopImportInput'),
  desktopImportStatus: document.getElementById('desktopImportStatus'),
  extensionIdInput: document.getElementById('extensionIdInput'),
  saveExtensionBtn: document.getElementById('saveExtensionBtn'),
  connectExtensionBtn: document.getElementById('connectExtensionBtn'),
  importExtensionBtn: document.getElementById('importExtensionBtn'),
  extensionStatus: document.getElementById('extensionStatus')
};

init();

function init() {
  hydrateSettings();
  resetManualFormTimes();
  bindEvents();
  renderAll();
}

function hydrateSettings() {
  els.extensionIdInput.value = state.settings.extensionId || '';
}

function resetManualFormTimes() {
  const now = new Date();
  const start = new Date(now.getTime() - 60 * 60 * 1000);
  els.activityStart.value = toLocalInputValue(start);
  els.activityEnd.value = toLocalInputValue(now);
}

function bindEvents() {
  els.navButtons.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  els.activityForm.addEventListener('submit', handleActivitySubmit);
  els.projectForm.addEventListener('submit', handleProjectSubmit);
  els.ruleForm.addEventListener('submit', handleRuleSubmit);
  els.applyRulesBtn.addEventListener('click', () => {
    applyRulesToAll();
    saveState();
    renderAll();
    alert('Rules applied to all activities.');
  });
  els.timelineSearch.addEventListener('input', renderTimeline);
  els.timelineProjectFilter.addEventListener('change', renderTimeline);
  els.timelineSourceFilter.addEventListener('change', renderTimeline);
  els.seedDemoBtn.addEventListener('click', seedDemoData);
  els.clearDataBtn.addEventListener('click', clearAllData);
  els.exportJsonBtn.addEventListener('click', exportJson);
  els.importJsonInput.addEventListener('change', importJson);
  els.desktopImportInput.addEventListener('change', importDesktopJson);
  els.saveExtensionBtn.addEventListener('click', saveExtensionId);
  els.connectExtensionBtn.addEventListener('click', testExtensionConnection);
  els.importExtensionBtn.addEventListener('click', importFromExtension);
  document.addEventListener('click', handleActionClicks);
}

function handleActivitySubmit(event) {
  event.preventDefault();
  const activity = normalizeActivity({
    id: crypto.randomUUID(),
    source: els.activitySource.value,
    title: els.activityTitle.value.trim(),
    app: els.activityApp.value.trim(),
    domain: els.activityDomain.value.trim(),
    start: els.activityStart.value,
    end: els.activityEnd.value,
    projectId: els.activityProject.value,
    category: els.activityCategory.value,
    notes: els.activityNotes.value.trim(),
    createdAt: new Date().toISOString()
  });
  if (!activity) {
    alert('End time must be later than start time.');
    return;
  }
  applyRulesToActivity(activity);
  state.activities.unshift(activity);
  state.activities = dedupeActivities(state.activities);
  saveState();
  els.activityForm.reset();
  els.activitySource.value = 'manual';
  resetManualFormTimes();
  renderAll();
}

function handleProjectSubmit(event) {
  event.preventDefault();
  const name = els.projectName.value.trim();
  if (!name) return;
  state.projects.push({ id: crypto.randomUUID(), name, description: els.projectDescription.value.trim() });
  saveState();
  els.projectForm.reset();
  renderAll();
}

function handleRuleSubmit(event) {
  event.preventDefault();
  const value = els.ruleValue.value.trim();
  if (!value) return;
  state.rules.push({
    id: crypto.randomUUID(),
    field: els.ruleField.value,
    value,
    projectId: els.ruleProject.value,
    category: els.ruleCategory.value
  });
  saveState();
  els.ruleForm.reset();
  renderAll();
}

function handleActionClicks(event) {
  const activityDeleteBtn = event.target.closest('[data-action="delete-activity"]');
  if (activityDeleteBtn) {
    state.activities = state.activities.filter(item => item.id !== activityDeleteBtn.dataset.id);
    saveState();
    renderAll();
    return;
  }
  const ruleDeleteBtn = event.target.closest('[data-action="delete-rule"]');
  if (ruleDeleteBtn) {
    state.rules = state.rules.filter(item => item.id !== ruleDeleteBtn.dataset.id);
    saveState();
    renderAll();
  }
}

function switchView(viewName) {
  els.navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
  els.views.forEach(view => view.classList.toggle('active', view.id === `${viewName}View`));
  els.viewTitle.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);
}

function renderAll() {
  populateSelects();
  renderDashboard();
  renderTimeline();
  renderProjects();
  renderRules();
  renderReports();
  renderConnectionStatus();
}

function populateSelects() {
  const projectOptions = ['<option value="">Unassigned</option>']
    .concat(state.projects.map(project => `<option value="${project.id}">${escapeHtml(project.name)}</option>`))
    .join('');
  const categoryOptions = ['<option value="">Unassigned</option>']
    .concat(state.categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`))
    .join('');
  [els.activityProject, els.ruleProject].forEach(select => {
    select.innerHTML = projectOptions;
  });
  [els.activityCategory, els.ruleCategory].forEach(select => {
    select.innerHTML = categoryOptions;
  });
  els.timelineProjectFilter.innerHTML = '<option value="">All projects</option>' + state.projects.map(project => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('');
}

function renderDashboard() {
  const activities = sortedActivities();
  const totalMinutes = Math.round(sumMinutes(activities));
  const autoTaggedCount = activities.filter(item => item.autoTagged).length;
  const projectTotals = getProjectTotals(activities);
  const topProject = projectTotals[0];

  els.metricSessions.textContent = String(activities.length);
  els.metricMinutes.textContent = String(totalMinutes);
  els.metricProjects.textContent = String(state.projects.length);
  els.metricRules.textContent = String(autoTaggedCount);
  els.todayFocusProject.textContent = topProject ? topProject.name : 'No project tagged yet';
  els.todaySummaryText.textContent = activities.length ? buildDailySummary(activities, topProject) : 'Start logging activity or load demo data to see a daily summary.';
  els.trackerStatus.textContent = state.settings.extensionId
    ? 'Dashboard ready · browser import connected · desktop JSON import enabled'
    : 'Manual mode active · desktop JSON import enabled';

  renderRecentActivity(activities);
  renderSourceBreakdown(activities);
}

function renderRecentActivity(activities) {
  if (!activities.length) {
    els.recentActivityList.innerHTML = '<div class="empty-state">No activity yet.</div>';
    return;
  }
  els.recentActivityList.innerHTML = activities.slice(0, 6).map(item => renderActivityCard(item, true)).join('');
}

function renderSourceBreakdown(activities) {
  const sourceTotals = aggregateBy(activities, item => item.source || 'manual');
  if (!sourceTotals.length) {
    els.sourceBreakdownList.innerHTML = '<div class="empty-state">No source data yet.</div>';
    return;
  }
  els.sourceBreakdownList.innerHTML = sourceTotals.map(item => `
    <div class="project-item compact-item">
      <div class="section-head tight-head">
        <h3>${escapeHtml(formatSource(item.key))}</h3>
        <span class="meta-tag">${item.totalMinutes} min</span>
      </div>
      <p class="muted">${item.count} session${item.count === 1 ? '' : 's'}</p>
    </div>
  `).join('');
}

function renderTimeline() {
  const searchTerm = els.timelineSearch.value.trim().toLowerCase();
  const projectFilter = els.timelineProjectFilter.value;
  const sourceFilter = els.timelineSourceFilter.value;
  const filtered = sortedActivities().filter(item => {
    const searchable = [item.title, item.app, item.domain, item.notes, getProjectName(item.projectId), item.category, item.source].join(' ').toLowerCase();
    return (!searchTerm || searchable.includes(searchTerm))
      && (!projectFilter || item.projectId === projectFilter)
      && (!sourceFilter || item.source === sourceFilter);
  });

  els.timelineList.innerHTML = filtered.length
    ? filtered.map(item => renderActivityCard(item)).join('')
    : '<div class="empty-state">No sessions found.</div>';
}

function renderProjects() {
  const totals = getProjectTotals(sortedActivities());
  if (!totals.length) {
    els.projectTotalsList.innerHTML = '<div class="empty-state">No projects yet.</div>';
    return;
  }
  els.projectTotalsList.innerHTML = totals.map(project => `
    <div class="project-item">
      <div class="section-head tight-head">
        <h3>${escapeHtml(project.name)}</h3>
        <span class="meta-tag">${project.totalMinutes} min</span>
      </div>
      <p class="muted">${escapeHtml(project.description || 'No description yet.')}</p>
      <div class="meta-row">
        <span class="meta-tag">${project.sessionCount} sessions</span>
      </div>
    </div>
  `).join('');
}

function renderRules() {
  if (!state.rules.length) {
    els.rulesList.innerHTML = '<div class="empty-state">No rules yet.</div>';
    return;
  }
  els.rulesList.innerHTML = state.rules.map(rule => `
    <div class="rule-item">
      <div class="section-head tight-head">
        <h3>${escapeHtml(rule.field)} contains “${escapeHtml(rule.value)}”</h3>
        <button class="mini-button" data-action="delete-rule" data-id="${rule.id}">Delete</button>
      </div>
      <div class="meta-row">
        <span class="meta-tag">Project: ${escapeHtml(getProjectName(rule.projectId) || 'No project')}</span>
        <span class="meta-tag">Category: ${escapeHtml(rule.category || 'No category')}</span>
      </div>
    </div>
  `).join('');
}

function renderReports() {
  const activities = sortedActivities();
  if (!activities.length) {
    els.reportSummary.innerHTML = '<div class="empty-state">No data yet.</div>';
    els.reportBreakdowns.innerHTML = '<div class="empty-state">No report data yet.</div>';
    return;
  }

  const topProject = getProjectTotals(activities)[0];
  const topApp = aggregateBy(activities, item => item.app || 'Unknown app')[0];
  const topCategory = aggregateBy(activities, item => item.category || 'Unassigned')[0];
  const longestSession = activities.slice().sort((a, b) => (b.durationMinutes || 0) - (a.durationMinutes || 0))[0];
  const focusBlocks = activities.filter(item => (item.durationMinutes || 0) >= 25).length;
  const unassignedMinutes = Math.round(sumMinutes(activities.filter(item => !item.projectId)));
  const contextSwitches = Math.max(activities.length - 1, 0);
  const suggestedRules = buildSuggestedRules(activities).slice(0, 3);

  els.reportSummary.innerHTML = `
    <p>${escapeHtml(buildDailySummary(activities, topProject))}</p>
    <p class="muted" style="margin-top: 12px;">Longest session: ${escapeHtml(longestSession?.title || '—')} (${Math.round(longestSession?.durationMinutes || 0)} min). ${topApp ? `Most-used app: ${escapeHtml(topApp.key)}.` : ''} ${topCategory ? `Top category: ${escapeHtml(topCategory.key)}.` : ''}</p>
    <p class="muted" style="margin-top: 12px;">Focus blocks (25+ min): ${focusBlocks}. Context switches: ${contextSwitches}. Unassigned time: ${unassignedMinutes} min.</p>
  `;

  const sections = [
    { label: 'Top apps', rows: aggregateBy(activities, item => item.app || 'Unknown app').slice(0, 5) },
    { label: 'Top categories', rows: aggregateBy(activities, item => item.category || 'Unassigned').slice(0, 5) },
    { label: 'Top sources', rows: aggregateBy(activities, item => formatSource(item.source || 'manual')).slice(0, 5) },
    { label: 'Suggested rules', rows: suggestedRules.map(item => ({ key: item.label, totalMinutes: item.minutes })) }
  ];

  els.reportBreakdowns.innerHTML = sections.map(section => `
    <div class="project-item compact-item">
      <h3>${escapeHtml(section.label)}</h3>
      <div class="list-stack mini-list">
        ${section.rows.length ? section.rows.map(row => `
          <div class="summary-row">
            <span>${escapeHtml(row.key)}</span>
            <span class="meta-tag">${row.totalMinutes} min</span>
          </div>
        `).join('') : '<div class="muted">No insights yet.</div>'}
      </div>
    </div>
  `).join('');
}

function renderConnectionStatus() {
  const extensionId = state.settings.extensionId || '';
  const desktopText = state.settings.lastDesktopImportAt ? ` Last desktop import: ${new Date(state.settings.lastDesktopImportAt).toLocaleString()}.` : '';
  const browserText = state.settings.lastBrowserImportAt ? ` Last browser import: ${new Date(state.settings.lastBrowserImportAt).toLocaleString()}.` : '';
  els.extensionStatus.textContent = extensionId
    ? `Saved extension ID: ${extensionId}. Ready to test or import browser sessions.${browserText}`
    : `Install the extension in Chrome, copy its ID from the popup, then connect it here.${browserText}`;
  els.desktopImportStatus.textContent = state.settings.lastDesktopImportAt
    ? `Desktop JSON imported on ${new Date(state.settings.lastDesktopImportAt).toLocaleString()}.${desktopText}`
    : 'No desktop export imported yet.';
}

function renderActivityCard(item, compact = false) {
  const fingerprint = item.fingerprint ? `<span class="meta-tag">${escapeHtml(item.fingerprint.slice(0, 10))}</span>` : '';
  return `
    <div class="activity-item${compact ? ' compact-item' : ''}">
      <div class="section-head tight-head">
        <div>
          <h3>${escapeHtml(item.title || 'Untitled activity')}</h3>
          <p class="muted">${escapeHtml(item.app || 'Unknown app')}${item.domain ? ` · ${escapeHtml(item.domain)}` : ''}</p>
        </div>
        <button class="mini-button" data-action="delete-activity" data-id="${item.id}">Delete</button>
      </div>
      <div class="meta-row">
        <span class="meta-tag">${formatTimeRange(item.start, item.end)}</span>
        <span class="meta-tag">${Math.round(item.durationMinutes || 0)} min</span>
        <span class="meta-tag">${escapeHtml(getProjectName(item.projectId) || 'Unassigned project')}</span>
        <span class="meta-tag">${escapeHtml(item.category || 'Unassigned category')}</span>
        <span class="meta-tag">${escapeHtml(formatSource(item.source || 'manual'))}</span>
        ${fingerprint}
      </div>
      ${item.notes ? `<p class="muted" style="margin-top:10px;">${escapeHtml(item.notes)}</p>` : ''}
    </div>
  `;
}

function sortedActivities() {
  return [...state.activities].sort((a, b) => new Date(b.start) - new Date(a.start));
}

function getProjectTotals(activities) {
  const totals = new Map();
  activities.forEach(item => {
    if (!item.projectId) return;
    const current = totals.get(item.projectId) || { id: item.projectId, name: getProjectName(item.projectId), description: getProjectDescription(item.projectId), totalMinutes: 0, sessionCount: 0 };
    current.totalMinutes += item.durationMinutes || 0;
    current.sessionCount += 1;
    totals.set(item.projectId, current);
  });
  return [...totals.values()].sort((a, b) => b.totalMinutes - a.totalMinutes);
}

function aggregateBy(activities, getter) {
  const map = new Map();
  activities.forEach(item => {
    const key = getter(item) || 'Unknown';
    const current = map.get(key) || { key, count: 0, totalMinutes: 0 };
    current.count += 1;
    current.totalMinutes += item.durationMinutes || 0;
    map.set(key, current);
  });
  return [...map.values()].sort((a, b) => b.totalMinutes - a.totalMinutes);
}

function buildDailySummary(activities, topProject) {
  const totalMinutes = Math.round(sumMinutes(activities));
  const topSource = aggregateBy(activities, item => item.source || 'manual')[0];
  return `You logged ${activities.length} session${activities.length === 1 ? '' : 's'} totaling ${totalMinutes} minutes. ${topProject ? `Top project: ${topProject.name}.` : 'No project has the lead yet.'} ${topSource ? `Most of your data came from ${formatSource(topSource.key)}.` : ''}`;
}

function buildSuggestedRules(activities) {
  const unassigned = activities.filter(item => !item.projectId || !item.category);
  const candidates = [];
  const byDomain = aggregateBy(unassigned.filter(item => item.domain), item => item.domain);
  const byApp = aggregateBy(unassigned.filter(item => item.app), item => item.app);
  if (byDomain[0]) candidates.push({ label: `Create rule for domain "${byDomain[0].key}"`, minutes: byDomain[0].totalMinutes });
  if (byApp[0]) candidates.push({ label: `Create rule for app "${byApp[0].key}"`, minutes: byApp[0].totalMinutes });
  const byTitle = aggregateBy(unassigned.filter(item => item.title), item => item.title.split(' ').slice(0, 3).join(' '));
  if (byTitle[0]) candidates.push({ label: `Create rule for title phrase "${byTitle[0].key}"`, minutes: byTitle[0].totalMinutes });
  return candidates;
}

function applyRulesToAll() {
  state.activities = state.activities.map(item => {
    const next = { ...item, autoTagged: false };
    applyRulesToActivity(next);
    return next;
  });
}

function applyRulesToActivity(activity) {
  for (const rule of state.rules) {
    const value = String(activity[rule.field] || '').toLowerCase();
    if (!value.includes(String(rule.value || '').toLowerCase())) continue;
    if (rule.projectId && !activity.projectId) activity.projectId = rule.projectId;
    if (rule.category && !activity.category) activity.category = rule.category;
    activity.autoTagged = true;
  }
}

function dedupeActivities(activities) {
  const seen = new Set();
  const deduped = [];
  sortedFromAny(activities).forEach(item => {
    const key = item.fingerprint || computeFingerprint(item);
    if (seen.has(key)) return;
    seen.add(key);
    item.fingerprint = key;
    deduped.push(item);
  });
  return deduped;
}

function sortedFromAny(items) {
  return [...items].sort((a, b) => new Date(b.start) - new Date(a.start));
}

function normalizeActivity(activity) {
  if (!activity) return null;
  const start = new Date(activity.start);
  const end = new Date(activity.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  const normalized = {
    id: activity.id || crypto.randomUUID(),
    source: activity.source || 'manual',
    title: activity.title || activity.windowTitle || 'Untitled activity',
    app: activity.app || '',
    domain: activity.domain || safeDomain(activity.url || ''),
    url: activity.url || '',
    start: start.toISOString(),
    end: end.toISOString(),
    durationMinutes: activity.durationMinutes || Math.round(((end - start) / 60000) * 10) / 10,
    projectId: activity.projectId || '',
    category: activity.category || '',
    notes: activity.notes || '',
    createdAt: activity.createdAt || new Date().toISOString(),
    autoTagged: Boolean(activity.autoTagged),
    filePath: activity.filePath || '',
    fingerprint: activity.fingerprint || ''
  };
  normalized.fingerprint = computeFingerprint(normalized);
  return normalized;
}

function computeFingerprint(activity) {
  return [activity.source, activity.title, activity.app, activity.domain, new Date(activity.start).toISOString(), new Date(activity.end).toISOString()].join('::').toLowerCase();
}

function sumMinutes(activities) {
  return activities.reduce((sum, item) => sum + (item.durationMinutes || 0), 0);
}

function getProjectName(projectId) {
  return state.projects.find(project => project.id === projectId)?.name || '';
}

function getProjectDescription(projectId) {
  return state.projects.find(project => project.id === projectId)?.description || '';
}

function formatSource(source) {
  return ({
    manual: 'Manual',
    'browser-extension': 'Browser extension',
    'desktop-companion': 'Desktop companion',
    'imported-json': 'Imported JSON'
  })[source] || source;
}

function formatTimeRange(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function toLocalInputValue(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function safeDomain(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function seedDemoData() {
  const now = Date.now();
  const demo = [
    { title: 'Canvas grading sprint', app: 'Chrome', domain: 'canvas.nku.edu', source: 'browser-extension', start: new Date(now - 1000 * 60 * 185), end: new Date(now - 1000 * 60 * 145), projectId: seedProjects[0].id, category: 'Teaching' },
    { title: 'INF 286 final project launchpad', app: 'VS Code', domain: '', source: 'desktop-companion', start: new Date(now - 1000 * 60 * 140), end: new Date(now - 1000 * 60 * 78), projectId: seedProjects[0].id, category: 'Coding' },
    { title: 'ITSBAD landing page planning', app: 'Canva', domain: 'canva.com', source: 'manual', start: new Date(now - 1000 * 60 * 72), end: new Date(now - 1000 * 60 * 36), projectId: seedProjects[2].id, category: 'Design' },
    { title: 'AI Literacy course notes', app: 'Google Docs', domain: 'docs.google.com', source: 'browser-extension', start: new Date(now - 1000 * 60 * 30), end: new Date(now - 1000 * 60 * 6), projectId: seedProjects[1].id, category: 'Course Design' }
  ].map(item => normalizeActivity({ ...item, id: crypto.randomUUID(), notes: '', createdAt: new Date().toISOString() }));

  state.activities = dedupeActivities([...demo, ...state.activities]);
  applyRulesToAll();
  saveState();
  renderAll();
}

function clearAllData() {
  if (!confirm('Clear all local dashboard data?')) return;
  state = createDefaultState();
  saveState();
  hydrateSettings();
  resetManualFormTimes();
  renderAll();
}

function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: 'worktrail-dashboard',
    version: '7.0.0',
    activities: state.activities,
    projects: state.projects,
    categories: state.categories,
    rules: state.rules
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `worktrail-dashboard-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const incoming = Array.isArray(payload.activities) ? payload.activities.map(normalizeActivity).filter(Boolean) : [];
    const before = state.activities.length;
    state.activities = dedupeActivities([...incoming, ...state.activities]);
    if (Array.isArray(payload.projects)) {
      const projectMap = new Map(state.projects.map(item => [item.name, item]));
      payload.projects.forEach(project => {
        if (!project?.name || projectMap.has(project.name)) return;
        state.projects.push({ id: project.id || crypto.randomUUID(), name: project.name, description: project.description || '' });
      });
    }
    saveState();
    renderAll();
    alert(`Imported ${state.activities.length - before} new activities.`);
  } catch (error) {
    alert(`Import failed: ${error.message}`);
  } finally {
    event.target.value = '';
  }
}

async function importDesktopJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const incoming = Array.isArray(payload.activities) ? payload.activities.map(item => normalizeActivity({ ...item, source: 'desktop-companion' })).filter(Boolean) : [];
    const before = state.activities.length;
    state.activities = dedupeActivities([...incoming, ...state.activities]);
    state.settings.lastDesktopImportAt = new Date().toISOString();
    saveState();
    renderAll();
    alert(`Imported ${state.activities.length - before} new desktop activities.`);
  } catch (error) {
    alert(`Desktop import failed: ${error.message}`);
  } finally {
    event.target.value = '';
  }
}

function saveExtensionId() {
  state.settings.extensionId = els.extensionIdInput.value.trim();
  saveState();
  renderConnectionStatus();
}

async function testExtensionConnection() {
  const extensionId = (els.extensionIdInput.value || state.settings.extensionId || '').trim();
  if (!extensionId) {
    alert('Save your extension ID first.');
    return;
  }
  try {
    const response = await chromeRuntimeSendMessage(extensionId, { type: 'WORKTRAIL_PING' });
    alert(response?.ok ? 'Extension connection works.' : 'Extension responded, but not with the expected payload.');
  } catch (error) {
    alert(`Could not connect to extension: ${error.message}`);
  }
}

async function importFromExtension() {
  const extensionId = (els.extensionIdInput.value || state.settings.extensionId || '').trim();
  if (!extensionId) {
    alert('Save your extension ID first.');
    return;
  }
  try {
    const response = await chromeRuntimeSendMessage(extensionId, { type: 'WORKTRAIL_EXPORT' });
    const incoming = Array.isArray(response?.activities) ? response.activities.map(item => normalizeActivity({ ...item, source: 'browser-extension' })).filter(Boolean) : [];
    const before = state.activities.length;
    state.activities = dedupeActivities([...incoming, ...state.activities]);
    state.settings.lastBrowserImportAt = new Date().toISOString();
    saveState();
    renderAll();
    alert(`Imported ${state.activities.length - before} new browser activities.`);
  } catch (error) {
    alert(`Browser import failed: ${error.message}`);
  }
}

function chromeRuntimeSendMessage(extensionId, payload) {
  return new Promise((resolve, reject) => {
    if (!window.chrome?.runtime?.sendMessage) {
      reject(new Error('This page needs to run in Chrome to message the extension.'));
      return;
    }
    window.chrome.runtime.sendMessage(extensionId, payload, response => {
      const err = window.chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(response);
    });
  });
}
