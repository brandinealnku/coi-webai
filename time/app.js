const STORAGE_KEY = "webai-task-pulse-v1";

const state = {
  sessionStartedAt: Date.now(),
  totalClicks: 0,
  currentTaskId: null,
  currentTaskStartedAt: null,
  paused: false,
  tasks: [],
  activity: []
};

const els = {
  taskNameInput: document.getElementById("taskNameInput"),
  taskKeywordsInput: document.getElementById("taskKeywordsInput"),
  taskNotesInput: document.getElementById("taskNotesInput"),
  addTaskBtn: document.getElementById("addTaskBtn"),
  taskChipWrap: document.getElementById("taskChipWrap"),
  manualTaskSelect: document.getElementById("manualTaskSelect"),
  manualStartBtn: document.getElementById("manualStartBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  totalClicks: document.getElementById("totalClicks"),
  tasksTracked: document.getElementById("tasksTracked"),
  sessionLength: document.getElementById("sessionLength"),
  currentTaskName: document.getElementById("currentTaskName"),
  activeTaskBadge: document.getElementById("activeTaskBadge"),
  activityFeed: document.getElementById("activityFeed"),
  taskSummaryList: document.getElementById("taskSummaryList"),
  resetBtn: document.getElementById("resetBtn"),
  exportBtn: document.getElementById("exportBtn"),
  taskChipTemplate: document.getElementById("taskChipTemplate")
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function formatMs(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function timestampLabel(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.assign(state, parsed);

    if (!Array.isArray(state.tasks)) state.tasks = [];
    if (!Array.isArray(state.activity)) state.activity = [];
  } catch (error) {
    console.warn("Unable to load stored state", error);
  }
}

function addActivity(message) {
  state.activity.unshift({
    id: uid(),
    at: Date.now(),
    message
  });

  state.activity = state.activity.slice(0, 18);
  saveState();
  renderActivity();
}

function addTask(name, keywords = [], notes = "") {
  const cleanName = name.trim();
  if (!cleanName) return;

  const task = {
    id: uid(),
    name: cleanName,
    keywords: keywords.map(k => k.trim().toLowerCase()).filter(Boolean),
    notes: notes.trim(),
    totalMs: 0,
    clickCount: 0,
    lastActivatedAt: null
  };

  state.tasks.push(task);
  addActivity(`Created task profile: ${task.name}`);
  saveState();
  renderAll();
}

function removeTask(taskId) {
  if (state.currentTaskId === taskId) {
    stopCurrentTaskTimer();
    state.currentTaskId = null;
    state.currentTaskStartedAt = null;
  }

  const removed = state.tasks.find(task => task.id === taskId);
  state.tasks = state.tasks.filter(task => task.id !== taskId);

  if (removed) {
    addActivity(`Removed task profile: ${removed.name}`);
  }

  saveState();
  renderAll();
}

function getTaskById(taskId) {
  return state.tasks.find(task => task.id === taskId) || null;
}

function stopCurrentTaskTimer() {
  if (!state.currentTaskId || !state.currentTaskStartedAt) return;

  const task = getTaskById(state.currentTaskId);
  if (task) {
    task.totalMs += Date.now() - state.currentTaskStartedAt;
  }
  state.currentTaskStartedAt = null;
}

function setActiveTask(taskId, source = "manual") {
  if (state.paused) state.paused = false;

  if (state.currentTaskId === taskId) return;

  stopCurrentTaskTimer();

  state.currentTaskId = taskId;
  state.currentTaskStartedAt = taskId ? Date.now() : null;

  const task = getTaskById(taskId);
  if (task) {
    task.lastActivatedAt = Date.now();
    addActivity(`Active task switched to "${task.name}" via ${source}.`);
  } else {
    addActivity("Tracking paused. No active task.");
  }

  saveState();
  renderAll();
}

function pauseTracking() {
  stopCurrentTaskTimer();
  state.currentTaskId = null;
  state.currentTaskStartedAt = null;
  state.paused = true;
  addActivity("Paused task tracking.");
  saveState();
  renderAll();
}

function computeTaskMatchScore(task, context) {
  if (!context) return 0;
  const haystack = context.toLowerCase();
  let score = 0;

  task.keywords.forEach(keyword => {
    if (keyword && haystack.includes(keyword)) {
      score += 1;
    }
  });

  if (task.name && haystack.includes(task.name.toLowerCase())) {
    score += 2;
  }

  return score;
}

function inferTaskFromContext(context) {
  let bestTask = null;
  let bestScore = 0;

  state.tasks.forEach(task => {
    const score = computeTaskMatchScore(task, context);
    if (score > bestScore) {
      bestScore = score;
      bestTask = task;
    }
  });

  return bestScore > 0 ? bestTask : null;
}

function logInteraction(context, label = "interaction") {
  state.totalClicks += 1;
  const task = inferTaskFromContext(context);

  if (task) {
    setActiveTask(task.id, "auto-detect");
    task.clickCount += 1;
  } else if (state.currentTaskId) {
    const currentTask = getTaskById(state.currentTaskId);
    if (currentTask) {
      currentTask.clickCount += 1;
    }
  }

  const activeName = getTaskById(state.currentTaskId)?.name || "unclassified work";
  addActivity(`Captured ${label} → ${activeName}`);
  saveState();
  renderAll();
}

function currentTaskDisplayName() {
  return getTaskById(state.currentTaskId)?.name || "None";
}

function currentTaskElapsedPreview(task) {
  let total = task.totalMs;
  if (state.currentTaskId === task.id && state.currentTaskStartedAt) {
    total += Date.now() - state.currentTaskStartedAt;
  }
  return total;
}

function renderTaskChips() {
  els.taskChipWrap.innerHTML = "";

  if (!state.tasks.length) {
    els.taskChipWrap.innerHTML = '<p class="empty-state">No task profiles yet. Add a few to improve auto-detection.</p>';
    return;
  }

  state.tasks.forEach(task => {
    const fragment = els.taskChipTemplate.content.cloneNode(true);
    fragment.querySelector(".task-chip-name").textContent = task.name;
    fragment.querySelector(".task-chip-keywords").textContent =
      task.keywords.length ? `Keywords: ${task.keywords.join(", ")}` : "No keywords added yet.";
    fragment.querySelector(".chip-delete-btn").addEventListener("click", () => removeTask(task.id));
    els.taskChipWrap.appendChild(fragment);
  });
}

function renderTaskSelect() {
  els.manualTaskSelect.innerHTML = '<option value="">Choose a task...</option>';
  state.tasks.forEach(task => {
    const option = document.createElement("option");
    option.value = task.id;
    option.textContent = task.name;
    els.manualTaskSelect.appendChild(option);
  });

  if (state.currentTaskId) {
    els.manualTaskSelect.value = state.currentTaskId;
  }
}

function renderStats() {
  els.totalClicks.textContent = state.totalClicks;
  els.tasksTracked.textContent = state.tasks.length;
  els.sessionLength.textContent = formatMs(Date.now() - state.sessionStartedAt);
  els.currentTaskName.textContent = currentTaskDisplayName();
  els.activeTaskBadge.textContent = state.paused ? "Tracking paused" : (state.currentTaskId ? `Active: ${currentTaskDisplayName()}` : "No active task");
}

function renderActivity() {
  els.activityFeed.innerHTML = "";
  if (!state.activity.length) {
    els.activityFeed.innerHTML = '<li>No activity yet. Click around the workspace to begin tracking.</li>';
    return;
  }

  state.activity.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${timestampLabel(item.at)} — ${item.message}`;
    els.activityFeed.appendChild(li);
  });
}

function renderSummary() {
  els.taskSummaryList.innerHTML = "";

  if (!state.tasks.length) {
    els.taskSummaryList.innerHTML = '<p class="empty-state">Once tasks are added and clicks are captured, a summary will appear here.</p>';
    return;
  }

  const rankedTasks = [...state.tasks].sort((a, b) => currentTaskElapsedPreview(b) - currentTaskElapsedPreview(a));

  rankedTasks.forEach(task => {
    const totalMs = currentTaskElapsedPreview(task);
    const share = state.totalClicks ? Math.round((task.clickCount / state.totalClicks) * 100) : 0;

    const card = document.createElement("article");
    card.className = "summary-card";
    card.innerHTML = `
      <div>
        <h3>${task.name}</h3>
        <p class="supporting-copy">${task.notes || "No notes added for this task."}</p>
      </div>
      <div class="summary-meta">
        <div class="summary-pill">Time: ${formatMs(totalMs)}</div>
        <div class="summary-pill">Clicks: ${task.clickCount}</div>
        <div class="summary-pill">Share: ${share}%</div>
      </div>
    `;
    els.taskSummaryList.appendChild(card);
  });
}

function renderAll() {
  renderTaskChips();
  renderTaskSelect();
  renderStats();
  renderActivity();
  renderSummary();
}

function exportSession() {
  const payload = {
    exportedAt: new Date().toISOString(),
    sessionStartedAt: new Date(state.sessionStartedAt).toISOString(),
    totalClicks: state.totalClicks,
    currentTask: currentTaskDisplayName(),
    tasks: state.tasks.map(task => ({
      name: task.name,
      keywords: task.keywords,
      notes: task.notes,
      totalMs: currentTaskElapsedPreview(task),
      totalFormatted: formatMs(currentTaskElapsedPreview(task)),
      clickCount: task.clickCount,
      lastActivatedAt: task.lastActivatedAt ? new Date(task.lastActivatedAt).toISOString() : null
    })),
    activity: state.activity
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `task-pulse-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  addActivity("Exported session JSON.");
}

function resetSession() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

function bindEvents() {
  els.addTaskBtn.addEventListener("click", () => {
    const name = els.taskNameInput.value;
    const keywords = els.taskKeywordsInput.value.split(",");
    const notes = els.taskNotesInput.value;

    if (!name.trim()) {
      alert("Please enter a task name first.");
      return;
    }

    addTask(name, keywords, notes);
    els.taskNameInput.value = "";
    els.taskKeywordsInput.value = "";
    els.taskNotesInput.value = "";
  });

  els.manualStartBtn.addEventListener("click", () => {
    const selectedId = els.manualTaskSelect.value;
    if (!selectedId) {
      alert("Choose a task to activate.");
      return;
    }
    setActiveTask(selectedId, "manual selection");
  });

  els.pauseBtn.addEventListener("click", pauseTracking);
  els.exportBtn.addEventListener("click", exportSession);
  els.resetBtn.addEventListener("click", resetSession);

  document.querySelectorAll("[data-task-context]").forEach(element => {
    element.addEventListener("click", event => {
      const context = event.currentTarget.dataset.taskContext || "";
      const label = event.currentTarget.textContent.trim();
      logInteraction(context, label);
    });
  });

  document.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("button, input, textarea, select, label")) return;

    const text = [target.innerText, target.getAttribute("data-task-context"), target.id, target.className]
      .filter(Boolean)
      .join(" ");
    if (text.trim()) {
      logInteraction(text, "general page click");
    }
  });

  window.addEventListener("beforeunload", () => {
    stopCurrentTaskTimer();
    saveState();
  });
}

function seedDemoTasksIfEmpty() {
  if (state.tasks.length) return;
  addTask("Design polish", ["design", "ui", "styling", "layout", "visual"], "Refining the look and feel of the interface.");
  addTask("Frontend logic", ["javascript", "logic", "debug", "click", "handler", "feature"], "Building interactions and fixing behavior.");
  addTask("Content writing", ["content", "copy", "headline", "cta", "writing"], "Improving messaging and student-facing text.");
  addTask("Quality assurance", ["testing", "qa", "mobile", "browser", "validation"], "Checking that the experience works across devices.");
}

function tick() {
  renderStats();
  renderSummary();
}

loadState();
seedDemoTasksIfEmpty();
bindEvents();
renderAll();
setInterval(tick, 1000);
