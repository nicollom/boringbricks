const STORAGE_KEY = "daily-list-app-v2";
const WIDGET_SNAPSHOT_KEY = "daily-list-widget-snapshot-v1";

const starterState = {
  dailyTasks: [
    { id: createId(), title: "Take vitamins" },
    { id: createId(), title: "Drink 3L of water" },
    { id: createId(), title: "Walk 10k steps" }
  ],
  dayData: {}
};

const state = loadState();
let selectedDate = todayKey();

const els = {
  dayTitle: document.querySelector("#dayTitle"),
  dateLabel: document.querySelector("#dateLabel"),
  datePicker: document.querySelector("#datePicker"),
  doneCount: document.querySelector("#doneCount"),
  remainingCount: document.querySelector("#remainingCount"),
  progressBar: document.querySelector("#progressBar"),
  progressLabel: document.querySelector("#progressLabel"),
  snapshotRing: document.querySelector("#snapshotRing"),
  snapshotPercent: document.querySelector("#snapshotPercent"),
  snapshotMeta: document.querySelector("#snapshotMeta"),
  snapshotNextList: document.querySelector("#snapshotNextList"),
  snapshotEmpty: document.querySelector("#snapshotEmpty"),
  dailyForm: document.querySelector("#dailyForm"),
  dailyInput: document.querySelector("#dailyInput"),
  dailyList: document.querySelector("#dailyList"),
  dailyEmpty: document.querySelector("#dailyEmpty"),
  scheduledForm: document.querySelector("#scheduledForm"),
  scheduledInput: document.querySelector("#scheduledInput"),
  scheduledTime: document.querySelector("#scheduledTime"),
  scheduledList: document.querySelector("#scheduledList"),
  scheduledEmpty: document.querySelector("#scheduledEmpty"),
  manageDaily: document.querySelector("#manageDaily"),
  dailyDialog: document.querySelector("#dailyDialog"),
  manageList: document.querySelector("#manageList"),
  clearDone: document.querySelector("#clearDone"),
  prevDay: document.querySelector("#prevDay"),
  nextDay: document.querySelector("#nextDay"),
  todayButton: document.querySelector("#todayButton")
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.dailyTasks && saved?.dayData) return saved;
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      return starterState;
    }
  }
  return starterState;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    return;
  }
}

function saveWidgetSnapshot(snapshot) {
  try {
    localStorage.setItem(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // The in-app preview still works if storage is unavailable.
  }
}

function todayKey() {
  return toDateKey(new Date());
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toDateKey(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function getDay(dateKey = selectedDate) {
  if (!state.dayData[dateKey]) {
    state.dayData[dateKey] = { completedDaily: [], scheduledTasks: [] };
  }
  return state.dayData[dateKey];
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDate(days) {
  const date = parseDateKey(selectedDate);
  date.setDate(date.getDate() + days);
  selectedDate = toDateKey(date);
  render();
}

function formatDate(dateKey) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(parseDateKey(dateKey));
}

function dayTitle(dateKey) {
  const today = todayKey();
  const tomorrow = parseDateKey(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = parseDateKey(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateKey === today) return "Today";
  if (dateKey === toDateKey(tomorrow)) return "Tomorrow";
  if (dateKey === toDateKey(yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(parseDateKey(dateKey));
}

function addDailyTask(title) {
  state.dailyTasks.push({ id: createId(), title });
  saveState();
  render();
}

function removeDailyTask(id) {
  state.dailyTasks = state.dailyTasks.filter((task) => task.id !== id);
  Object.values(state.dayData).forEach((day) => {
    day.completedDaily = day.completedDaily.filter((taskId) => taskId !== id);
  });
  saveState();
  render();
}

function toggleDailyTask(id) {
  const day = getDay();
  day.completedDaily = day.completedDaily.includes(id)
    ? day.completedDaily.filter((taskId) => taskId !== id)
    : [...day.completedDaily, id];
  saveState();
  render();
}

function addScheduledTask(title, time) {
  getDay().scheduledTasks.push({
    id: createId(),
    title,
    time,
    done: false
  });
  saveState();
  render();
}

function toggleScheduledTask(id) {
  const task = getDay().scheduledTasks.find((item) => item.id === id);
  if (!task) return;
  task.done = !task.done;
  saveState();
  render();
}

function removeScheduledTask(id) {
  const day = getDay();
  day.scheduledTasks = day.scheduledTasks.filter((task) => task.id !== id);
  saveState();
  render();
}

function clearCompletedScheduled() {
  const day = getDay();
  day.scheduledTasks = day.scheduledTasks.filter((task) => !task.done);
  saveState();
  render();
}

function getSortedScheduledTasks(dateKey = selectedDate) {
  return [...getDay(dateKey).scheduledTasks].sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });
}

function buildDayStats(dateKey = selectedDate) {
  const day = getDay(dateKey);
  const dailyDone = state.dailyTasks.filter((task) => day.completedDaily.includes(task.id)).length;
  const scheduledDone = day.scheduledTasks.filter((task) => task.done).length;
  const total = state.dailyTasks.length + day.scheduledTasks.length;
  const done = dailyDone + scheduledDone;
  const remaining = Math.max(total - done, 0);
  const percent = total ? Math.round((done / total) * 100) : 0;

  return { dailyDone, scheduledDone, total, done, remaining, percent };
}

function getNextTasks(dateKey = selectedDate, limit = 3) {
  const day = getDay(dateKey);
  const scheduled = getSortedScheduledTasks(dateKey)
    .filter((task) => !task.done)
    .map((task) => ({
      title: task.title,
      meta: task.time || "Scheduled",
      source: "scheduled"
    }));

  const daily = state.dailyTasks
    .filter((task) => !day.completedDaily.includes(task.id))
    .map((task) => ({
      title: task.title,
      meta: "Daily",
      source: "daily"
    }));

  return [...scheduled, ...daily].slice(0, limit);
}

function buildWidgetSnapshot(dateKey = selectedDate) {
  const stats = buildDayStats(dateKey);
  const nextTasks = getNextTasks(dateKey, 3);

  return {
    date: dateKey,
    title: dayTitle(dateKey),
    progress: stats.percent,
    done: stats.done,
    remaining: stats.remaining,
    nextTasks
  };
}

function createTaskItem({ id, title, done, meta, onToggle, onDelete }) {
  const item = document.createElement("li");
  item.className = `task-item${done ? " done" : ""}`;

  const check = document.createElement("button");
  check.className = "task-check";
  check.type = "button";
  check.textContent = "✓";
  check.setAttribute("aria-pressed", String(done));
  check.setAttribute("aria-label", done ? `Mark ${title} incomplete` : `Mark ${title} done`);
  check.addEventListener("click", onToggle);

  const content = document.createElement("div");
  const name = document.createElement("div");
  name.className = "task-title";
  name.textContent = title;
  content.append(name);

  if (meta) {
    const detail = document.createElement("div");
    detail.className = "task-meta";
    detail.textContent = meta;
    content.append(detail);
  }

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const remove = document.createElement("button");
  remove.className = "small-button delete-button";
  remove.type = "button";
  remove.textContent = "×";
  remove.title = "Delete";
  remove.setAttribute("aria-label", `Delete ${title}`);
  remove.addEventListener("click", onDelete);
  actions.append(remove);

  item.append(check, content, actions);
  return item;
}

function renderDailyTasks() {
  const day = getDay();
  els.dailyList.replaceChildren();

  state.dailyTasks.forEach((task) => {
    els.dailyList.append(
      createTaskItem({
        ...task,
        done: day.completedDaily.includes(task.id),
        onToggle: () => toggleDailyTask(task.id),
        onDelete: () => removeDailyTask(task.id)
      })
    );
  });

  els.dailyEmpty.classList.toggle("visible", state.dailyTasks.length === 0);
}

function renderScheduledTasks() {
  const scheduled = getSortedScheduledTasks();

  els.scheduledList.replaceChildren();
  scheduled.forEach((task) => {
    els.scheduledList.append(
      createTaskItem({
        ...task,
        done: task.done,
        meta: task.time || "",
        onToggle: () => toggleScheduledTask(task.id),
        onDelete: () => removeScheduledTask(task.id)
      })
    );
  });

  els.scheduledEmpty.classList.toggle("visible", scheduled.length === 0);
}

function renderManageList() {
  els.manageList.replaceChildren();
  state.dailyTasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = "manage-item";

    const title = document.createElement("span");
    title.textContent = task.title;

    const remove = document.createElement("button");
    remove.className = "small-button delete-button";
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Delete";
    remove.setAttribute("aria-label", `Delete ${task.title}`);
    remove.addEventListener("click", () => removeDailyTask(task.id));

    item.append(title, remove);
    els.manageList.append(item);
  });
}

function renderSummary() {
  const stats = buildDayStats();

  els.doneCount.textContent = stats.done;
  els.remainingCount.textContent = stats.remaining;
  els.progressBar.style.width = `${stats.percent}%`;
  els.progressLabel.textContent = `${stats.percent}%`;
}

function renderSnapshot() {
  const snapshot = buildWidgetSnapshot();
  els.snapshotPercent.textContent = `${snapshot.progress}%`;
  els.snapshotMeta.textContent = `${snapshot.done} done, ${snapshot.remaining} left`;
  els.snapshotRing.style.setProperty("--snapshot-progress", `${snapshot.progress}%`);
  els.snapshotRing.setAttribute("aria-label", `${snapshot.progress}% complete`);
  els.snapshotNextList.replaceChildren();

  snapshot.nextTasks.forEach((task) => {
    const item = document.createElement("li");
    const title = document.createElement("span");
    const meta = document.createElement("small");

    title.textContent = task.title;
    meta.textContent = task.meta;
    item.append(title, meta);
    els.snapshotNextList.append(item);
  });

  els.snapshotEmpty.classList.toggle("visible", snapshot.nextTasks.length === 0);
  saveWidgetSnapshot(snapshot);
}

function render() {
  els.dayTitle.textContent = dayTitle(selectedDate);
  els.dateLabel.textContent = formatDate(selectedDate);
  els.datePicker.value = selectedDate;
  renderDailyTasks();
  renderScheduledTasks();
  renderManageList();
  renderSummary();
  renderSnapshot();
}

window.DailyList = {
  getTodaySnapshot: () => buildWidgetSnapshot(todayKey()),
  getSelectedSnapshot: () => buildWidgetSnapshot(selectedDate)
};

els.dailyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = els.dailyInput.value.trim();
  if (!title) return;
  addDailyTask(title);
  els.dailyInput.value = "";
});

els.scheduledForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = els.scheduledInput.value.trim();
  if (!title) return;
  addScheduledTask(title, els.scheduledTime.value);
  els.scheduledInput.value = "";
  els.scheduledTime.value = "";
});

els.datePicker.addEventListener("change", () => {
  selectedDate = els.datePicker.value || todayKey();
  render();
});

els.prevDay.addEventListener("click", () => shiftDate(-1));
els.nextDay.addEventListener("click", () => shiftDate(1));
els.todayButton.addEventListener("click", () => {
  selectedDate = todayKey();
  render();
});
els.manageDaily.addEventListener("click", () => els.dailyDialog.showModal());
els.clearDone.addEventListener("click", clearCompletedScheduled);

render();
