"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TimerSidebarPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var VIEW_TYPE_TIMER_SIDEBAR = "jw-timer-sidebar-view";
var STORAGE_VERSION = 1;
var TIMER_RETENTION_MS = 30 * 24 * 60 * 60 * 1e3;
var UI_TEXT = {
  title: "\u23F1\uFE0F",
  empty: "\u2205",
  open: "\u25B6\uFE0F",
  pause: "\u23F8\uFE0F",
  target: "\u{1F3AF}",
  reset: "\u{1F504}",
  delete: "\u{1F5D1}\uFE0F",
  resetAll: "\u267B\uFE0F"
};
function buildTimerId(filePath, heading) {
  const line = heading.position?.start.line ?? 0;
  return `${filePath}::${line}::${heading.heading}`;
}
function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1e3));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
var _TimerSidebarView = class _TimerSidebarView extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.timers = /* @__PURE__ */ new Map();
    this.deletedTimerIds = /* @__PURE__ */ new Set();
    this.timerUiRefs = /* @__PURE__ */ new Map();
    this.currentHeadingIds = [];
    this.currentFilePath = null;
    this.tickHandle = null;
    this.persistHandle = null;
  }
  getViewType() {
    return VIEW_TYPE_TIMER_SIDEBAR;
  }
  getDisplayText() {
    return "JW Timers";
  }
  getIcon() {
    return "timer";
  }
  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("jw-timer-sidebar-root");
    const wrapper = this.contentEl.createDiv({ cls: "jw-timer-wrapper" });
    const titleEl = wrapper.createEl("h2", { text: UI_TEXT.title, cls: "jw-timer-title" });
    titleEl.setAttr("aria-live", "polite");
    titleEl.setAttr("aria-label", "Timers by heading");
    this.listEl = wrapper.createDiv({ cls: "jw-timer-list" });
    this.emptyStateEl = wrapper.createDiv({ cls: "jw-timer-empty" });
    const footerEl = wrapper.createDiv({ cls: "jw-timer-footer" });
    const deleteAllBtn = footerEl.createEl("button", {
      text: UI_TEXT.resetAll,
      cls: "jw-timer-btn jw-timer-btn-danger"
    });
    deleteAllBtn.setAttr("aria-label", "Reset all timers");
    deleteAllBtn.setAttr("title", "Reset all timers");
    deleteAllBtn.addEventListener("click", () => {
      if (this.confirmAction("Reset all timers?")) {
        this.deleteAllTimers();
      }
    });
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => void this.refreshFromActiveFile()));
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (file.path === this.currentFilePath) {
          void this.refreshFromActiveFile();
        }
      })
    );
    this.tickHandle = window.setInterval(() => {
      this.updateTimerDisplays();
    }, 250);
    this.persistHandle = window.setInterval(() => {
      this.persistRunningSnapshots();
    }, 5e3);
    void this.refreshFromActiveFile();
  }
  async onClose() {
    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    if (this.persistHandle !== null) {
      window.clearInterval(this.persistHandle);
      this.persistHandle = null;
    }
    await this.persistAllTimers(true);
    this.contentEl.removeClass("jw-timer-sidebar-root");
    this.timerUiRefs.clear();
  }
  async refreshFromActiveFile() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      this.currentFilePath = null;
      this.currentHeadingIds = [];
      await this.renderList();
      return;
    }
    this.currentFilePath = activeFile.path;
    const fileContent = await this.app.vault.cachedRead(activeFile);
    const fileCache = this.app.metadataCache.getFileCache(activeFile);
    const headings = (fileCache?.headings ?? []).slice().sort((a, b) => {
      const lineA = a.position?.start.line ?? 0;
      const lineB = b.position?.start.line ?? 0;
      return lineA - lineB;
    });
    const rawHeadingTitles = this.extractRawHeadingTitles(fileContent, headings);
    this.deletedTimerIds = this.plugin.getDeletedTimerIdsForFile(activeFile.path);
    const nextHeadingIds = [];
    const allHeadingIds = /* @__PURE__ */ new Set();
    for (const heading of headings) {
      const id = buildTimerId(activeFile.path, heading);
      allHeadingIds.add(id);
      if (this.deletedTimerIds.has(id)) {
        continue;
      }
      const headingLine = heading.position?.start.line ?? 0;
      const headingTitle = rawHeadingTitles.get(headingLine) ?? heading.heading;
      const existing = this.timers.get(id);
      const stored = this.plugin.getStoredTimer(id);
      if (!existing) {
        this.timers.set(id, {
          id,
          title: headingTitle,
          elapsedMs: stored?.elapsedMs ?? 0,
          targetMs: stored?.targetMs ?? null,
          running: false,
          startedAt: null
        });
      } else {
        existing.title = headingTitle;
        if (existing.targetMs === null && stored?.targetMs !== void 0) {
          existing.targetMs = stored.targetMs;
        }
      }
      nextHeadingIds.push(id);
    }
    const nextIdsSet = new Set(nextHeadingIds);
    for (const existingId of [...this.timers.keys()]) {
      if (existingId.startsWith(`${activeFile.path}::`) && !nextIdsSet.has(existingId)) {
        this.timers.delete(existingId);
        void this.plugin.removeStoredTimer(existingId);
      }
    }
    for (const deletedId of [...this.deletedTimerIds]) {
      if (deletedId.startsWith(`${activeFile.path}::`) && !allHeadingIds.has(deletedId)) {
        this.deletedTimerIds.delete(deletedId);
        void this.plugin.removeStoredTimer(deletedId);
      }
    }
    this.currentHeadingIds = nextHeadingIds;
    for (const id of nextHeadingIds) {
      const entry = this.timers.get(id);
      if (entry) {
        this.persistTimer(entry);
      }
    }
    await this.renderList();
  }
  extractRawHeadingTitles(content, headings) {
    const lines = content.split(/\r?\n/);
    const titlesByLine = /* @__PURE__ */ new Map();
    for (const heading of headings) {
      const lineIndex = heading.position?.start.line ?? -1;
      if (lineIndex < 0 || lineIndex >= lines.length) continue;
      const line = lines[lineIndex];
      const match = line.match(/^\s{0,3}#{1,6}\s+(.*)$/);
      if (!match) continue;
      const raw = match[1].replace(/\s+#+\s*$/, "").trim();
      titlesByLine.set(lineIndex, raw.length > 0 ? raw : heading.heading);
    }
    return titlesByLine;
  }
  async renderList() {
    this.listEl.empty();
    this.timerUiRefs.clear();
    if (this.currentHeadingIds.length === 0) {
      this.emptyStateEl.setText(UI_TEXT.empty);
      this.emptyStateEl.setAttr("aria-label", "No headers found in the current note");
      this.emptyStateEl.show();
      return;
    }
    this.emptyStateEl.hide();
    for (const id of this.currentHeadingIds) {
      const entry = this.timers.get(id);
      if (!entry) continue;
      const card = this.listEl.createDiv({ cls: "jw-timer-card" });
      const titleEl = card.createDiv({ cls: "jw-timer-card-title" });
      await this.renderTitleContent(titleEl, entry.title);
      const timerEl = card.createDiv({ cls: "jw-timer-clock", text: formatDuration(this.getElapsed(entry)) });
      const controls = card.createDiv({ cls: "jw-timer-controls" });
      const playStopBtn = controls.createEl("button", {
        cls: "jw-timer-btn",
        text: entry.running ? UI_TEXT.pause : UI_TEXT.open
      });
      playStopBtn.setAttr("aria-label", entry.running ? "Pause timer" : "Start timer");
      playStopBtn.setAttr("title", entry.running ? "Pause timer" : "Start timer");
      const targetBtn = controls.createEl("button", {
        cls: "jw-timer-btn",
        text: UI_TEXT.target
      });
      targetBtn.setAttr("aria-label", "Configure target time");
      const resetBtn = controls.createEl("button", {
        cls: "jw-timer-btn",
        text: UI_TEXT.reset
      });
      resetBtn.setAttr("aria-label", "Reset timer");
      resetBtn.setAttr("title", "Reset timer");
      const deleteBtn = controls.createEl("button", {
        cls: "jw-timer-btn jw-timer-btn-danger",
        text: UI_TEXT.delete
      });
      deleteBtn.setAttr("aria-label", "Delete timer");
      deleteBtn.setAttr("title", "Delete timer");
      playStopBtn.addEventListener("click", () => {
        if (entry.running) {
          this.pauseTimer(entry.id);
        } else {
          this.startTimer(entry.id);
        }
      });
      targetBtn.addEventListener("click", () => {
        this.configureTargetTime(entry.id);
      });
      resetBtn.addEventListener("click", () => {
        this.resetTimer(entry.id);
      });
      deleteBtn.addEventListener("click", () => {
        if (this.confirmAction("Delete this timer?")) {
          this.deleteTimer(entry.id);
        }
      });
      this.timerUiRefs.set(entry.id, { cardEl: card, timerEl, playStopBtn, targetBtn, resetBtn });
    }
    this.updateTimerDisplays();
  }
  getElapsed(entry) {
    if (!entry.running || entry.startedAt === null) {
      return entry.elapsedMs;
    }
    return entry.elapsedMs + (Date.now() - entry.startedAt);
  }
  startTimer(id) {
    const entry = this.timers.get(id);
    if (!entry || entry.running) return;
    entry.running = true;
    entry.startedAt = Date.now();
    this.persistTimer(entry);
    this.updateTimerDisplays();
  }
  pauseTimer(id) {
    const entry = this.timers.get(id);
    if (!entry || !entry.running) return;
    entry.elapsedMs = this.getElapsed(entry);
    entry.running = false;
    entry.startedAt = null;
    this.persistTimer(entry);
    this.updateTimerDisplays();
  }
  resetTimer(id) {
    const entry = this.timers.get(id);
    if (!entry) return;
    entry.elapsedMs = 0;
    entry.running = false;
    entry.startedAt = null;
    this.persistTimer(entry);
    this.updateTimerDisplays();
  }
  configureTargetTime(id) {
    const entry = this.timers.get(id);
    if (!entry) return;
    const currentMinutes = entry.targetMs === null ? "" : (entry.targetMs / 6e4).toString();
    const input = window.prompt("Target minutes (empty = clear)", currentMinutes);
    if (input === null) {
      return;
    }
    const normalized = input.trim().replace(",", ".");
    if (!normalized) {
      entry.targetMs = null;
      this.persistTimer(entry);
      this.updateTimerDisplays();
      return;
    }
    const minutes = Number(normalized);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      window.alert("Invalid target time");
      return;
    }
    entry.targetMs = Math.round(minutes * 60 * 1e3);
    this.persistTimer(entry);
    this.updateTimerDisplays();
  }
  deleteTimer(id) {
    const entry = this.timers.get(id);
    this.deletedTimerIds.add(id);
    this.timers.delete(id);
    void this.plugin.markTimerDeleted(id, entry?.title ?? "", entry?.targetMs ?? null, entry?.elapsedMs ?? 0);
    this.currentHeadingIds = this.currentHeadingIds.filter((headingId) => headingId !== id);
    void this.renderList();
  }
  deleteAllTimers() {
    const filePath = this.currentFilePath;
    this.timers.clear();
    this.deletedTimerIds.clear();
    if (filePath) {
      void this.plugin.clearFileTimers(filePath);
    }
    void this.refreshFromActiveFile();
  }
  confirmAction(message) {
    return window.confirm(message);
  }
  updateTimerDisplays() {
    for (const id of this.currentHeadingIds) {
      const entry = this.timers.get(id);
      const ui = this.timerUiRefs.get(id);
      if (!entry || !ui) continue;
      ui.timerEl.setText(formatDuration(this.getElapsed(entry)));
      ui.playStopBtn.setText(entry.running ? UI_TEXT.pause : UI_TEXT.open);
      ui.playStopBtn.setAttr("aria-label", entry.running ? "Pause timer" : "Start timer");
      ui.playStopBtn.setAttr("title", entry.running ? "Pause timer" : "Start timer");
      const targetMinutes = entry.targetMs === null ? "" : (entry.targetMs / 6e4).toFixed(1).replace(/\.0$/, "");
      ui.targetBtn.setAttr(
        "title",
        entry.targetMs === null ? "Configure target time" : `Target: ${targetMinutes} min`
      );
      const elapsed = this.getElapsed(entry);
      const hasTarget = entry.targetMs !== null;
      const isOverTarget = hasTarget && elapsed > (entry.targetMs ?? 0);
      ui.cardEl.removeClass("jw-timer-card--running", "jw-timer-card--stopped", "jw-timer-card--overdue-running");
      ui.timerEl.removeClass("jw-timer-clock--target-over", "jw-timer-clock--target-ok");
      if (entry.running && isOverTarget) {
        ui.cardEl.addClass("jw-timer-card--overdue-running");
        ui.timerEl.addClass("jw-timer-clock--target-over");
      } else if (entry.running) {
        ui.cardEl.addClass("jw-timer-card--running");
      } else if (elapsed > 0) {
        ui.cardEl.addClass("jw-timer-card--stopped");
      }
      if (!entry.running && hasTarget) {
        if (isOverTarget) {
          ui.timerEl.addClass("jw-timer-clock--target-over");
        } else {
          ui.timerEl.addClass("jw-timer-clock--target-ok");
        }
      }
    }
  }
  persistTimer(entry) {
    const elapsed = this.getElapsed(entry);
    void this.plugin.upsertStoredTimer(entry.id, {
      title: entry.title,
      elapsedMs: elapsed,
      targetMs: entry.targetMs,
      deleted: false
    });
  }
  async persistAllTimers(freezeRunning) {
    const updates = [];
    for (const entry of this.timers.values()) {
      let elapsed = this.getElapsed(entry);
      if (freezeRunning && entry.running) {
        entry.elapsedMs = elapsed;
        entry.running = false;
        entry.startedAt = null;
      } else if (!entry.running) {
        elapsed = entry.elapsedMs;
      }
      updates.push(
        this.plugin.upsertStoredTimer(entry.id, {
          title: entry.title,
          elapsedMs: elapsed,
          targetMs: entry.targetMs,
          deleted: false
        })
      );
    }
    await Promise.all(updates);
  }
  persistRunningSnapshots() {
    for (const entry of this.timers.values()) {
      if (entry.running) {
        this.persistTimer(entry);
      }
    }
  }
  async renderTitleContent(titleEl, rawTitle) {
    const renderedEl = document.createElement("div");
    await import_obsidian.MarkdownRenderer.render(this.app, rawTitle, renderedEl, this.currentFilePath ?? "", this);
    this.restoreInlineHtmlAttributes(renderedEl, rawTitle);
    const plain = (renderedEl.textContent ?? "").replace(/\s+/g, " ").trim();
    if (plain.length > _TimerSidebarView.TITLE_MAX_LENGTH) {
      this.truncateRenderedContent(renderedEl, _TimerSidebarView.TITLE_MAX_LENGTH);
      titleEl.setAttr("title", plain);
      titleEl.setAttr("aria-label", plain);
    }
    titleEl.empty();
    while (renderedEl.firstChild) {
      titleEl.appendChild(renderedEl.firstChild);
    }
  }
  restoreInlineHtmlAttributes(containerEl, rawTitle) {
    const parsedRoot = document.createElement("div");
    parsedRoot.innerHTML = rawTitle;
    const sourceElements = Array.from(parsedRoot.querySelectorAll("*")).filter((element) => {
      const attributeNames = element.getAttributeNames();
      return attributeNames.length > 0;
    });
    this.applyMatchingAttributes(sourceElements, containerEl);
  }
  applyMatchingAttributes(sourceElements, containerEl) {
    const usedTargets = /* @__PURE__ */ new Set();
    for (const sourceEl of sourceElements) {
      const sourceText = sourceEl.textContent?.replace(/\s+/g, " ").trim();
      if (!sourceText) continue;
      const candidateTargets = Array.from(containerEl.querySelectorAll(sourceEl.tagName.toLowerCase()));
      const targetEl = candidateTargets.find((candidate) => {
        if (usedTargets.has(candidate)) {
          return false;
        }
        const candidateText = candidate.textContent?.replace(/\s+/g, " ").trim();
        return candidateText === sourceText;
      });
      if (!targetEl) continue;
      usedTargets.add(targetEl);
      for (const attr of sourceEl.getAttributeNames()) {
        targetEl.setAttribute(attr, sourceEl.getAttribute(attr) ?? "");
      }
    }
  }
  truncateRenderedContent(containerEl, maxLength) {
    const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }
    let usedLength = 0;
    let reachedLimit = false;
    for (const textNode of textNodes) {
      const normalized = textNode.textContent?.replace(/\s+/g, " ") ?? "";
      if (!normalized.trim()) {
        if (reachedLimit) {
          textNode.textContent = "";
        }
        continue;
      }
      if (reachedLimit) {
        textNode.textContent = "";
        continue;
      }
      const remaining = maxLength - usedLength;
      if (normalized.length <= remaining) {
        usedLength += normalized.length;
        textNode.textContent = normalized;
        continue;
      }
      const sliceLength = Math.max(0, remaining - 3);
      const truncatedText = `${normalized.slice(0, sliceLength).trimEnd()}...`;
      textNode.textContent = truncatedText;
      reachedLimit = true;
      usedLength = maxLength;
    }
    this.removeEmptyNodes(containerEl);
  }
  removeEmptyNodes(rootEl) {
    const childNodes = Array.from(rootEl.childNodes);
    for (const childNode of childNodes) {
      if (childNode.nodeType === Node.TEXT_NODE) {
        if (!(childNode.textContent ?? "").trim()) {
          childNode.remove();
        }
        continue;
      }
      if (childNode instanceof HTMLElement) {
        this.removeEmptyNodes(childNode);
        const hasMeaningfulText = (childNode.textContent ?? "").trim().length > 0;
        const hasElementChildren = childNode.children.length > 0;
        if (!hasMeaningfulText && !hasElementChildren) {
          childNode.remove();
        }
      }
    }
  }
};
_TimerSidebarView.TITLE_MAX_LENGTH = 60;
var TimerSidebarView = _TimerSidebarView;
var TimerSidebarPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.storage = { version: STORAGE_VERSION, timers: {} };
    this.saveHandle = null;
  }
  async onload() {
    this.storage = this.normalizeStorageData(await this.loadData());
    if (this.pruneOldTimers()) {
      await this.saveData(this.storage);
    }
    this.registerView(VIEW_TYPE_TIMER_SIDEBAR, (leaf) => new TimerSidebarView(leaf, this));
    this.addRibbonIcon("timer", "Open JW Timer sidebar", () => {
      void this.activateView();
    });
    this.addCommand({
      id: "open-jw-timer-sidebar",
      name: "Open JW Timer sidebar",
      callback: async () => {
        await this.activateView();
      }
    });
    this.app.workspace.onLayoutReady(() => {
      void this.activateView();
    });
  }
  onunload() {
    if (this.saveHandle !== null) {
      window.clearTimeout(this.saveHandle);
      this.saveHandle = null;
      void this.saveData(this.storage);
    }
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_TIMER_SIDEBAR);
  }
  getStoredTimer(id) {
    return this.storage.timers[id];
  }
  getDeletedTimerIdsForFile(filePath) {
    const deletedIds = /* @__PURE__ */ new Set();
    const prefix = `${filePath}::`;
    for (const [id, state] of Object.entries(this.storage.timers)) {
      if (id.startsWith(prefix) && state.deleted) {
        deletedIds.add(id);
      }
    }
    return deletedIds;
  }
  async upsertStoredTimer(id, state) {
    this.storage.timers[id] = {
      title: state.title,
      elapsedMs: Math.max(0, Math.floor(state.elapsedMs)),
      targetMs: state.targetMs,
      deleted: state.deleted,
      updatedAt: Date.now()
    };
    this.scheduleSave();
  }
  async markTimerDeleted(id, title, targetMs, elapsedMs) {
    this.storage.timers[id] = {
      title,
      elapsedMs: Math.max(0, Math.floor(elapsedMs)),
      targetMs,
      deleted: true,
      updatedAt: Date.now()
    };
    this.scheduleSave();
  }
  async removeStoredTimer(id) {
    if (!(id in this.storage.timers)) {
      return;
    }
    delete this.storage.timers[id];
    this.scheduleSave();
  }
  async clearFileTimers(filePath) {
    const prefix = `${filePath}::`;
    let changed = false;
    for (const id of Object.keys(this.storage.timers)) {
      if (id.startsWith(prefix)) {
        delete this.storage.timers[id];
        changed = true;
      }
    }
    if (changed) {
      this.scheduleSave();
    }
  }
  normalizeStorageData(raw) {
    const fallback = { version: STORAGE_VERSION, timers: {} };
    if (!raw || typeof raw !== "object") {
      return fallback;
    }
    const maybeData = raw;
    if (!maybeData.timers || typeof maybeData.timers !== "object") {
      return fallback;
    }
    const normalizedTimers = {};
    for (const [id, value] of Object.entries(maybeData.timers)) {
      if (!value || typeof value !== "object") {
        continue;
      }
      const timer = value;
      normalizedTimers[id] = {
        title: typeof timer.title === "string" ? timer.title : "",
        elapsedMs: Number.isFinite(timer.elapsedMs) ? Math.max(0, Math.floor(timer.elapsedMs ?? 0)) : 0,
        targetMs: timer.targetMs === null || timer.targetMs === void 0 ? null : Number.isFinite(timer.targetMs) ? Math.max(0, Math.floor(timer.targetMs)) : null,
        deleted: Boolean(timer.deleted),
        updatedAt: Number.isFinite(timer.updatedAt) && (timer.updatedAt ?? 0) > 0 ? Math.floor(timer.updatedAt) : Date.now()
      };
    }
    return {
      version: STORAGE_VERSION,
      timers: normalizedTimers
    };
  }
  pruneOldTimers() {
    const now = Date.now();
    let changed = false;
    for (const [id, timer] of Object.entries(this.storage.timers)) {
      if (now - timer.updatedAt > TIMER_RETENTION_MS) {
        delete this.storage.timers[id];
        changed = true;
      }
    }
    return changed;
  }
  scheduleSave() {
    if (this.pruneOldTimers()) {
    }
    if (this.saveHandle !== null) {
      window.clearTimeout(this.saveHandle);
    }
    this.saveHandle = window.setTimeout(() => {
      this.saveHandle = null;
      void this.saveData(this.storage);
    }, 400);
  }
  async activateView() {
    const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TIMER_SIDEBAR);
    if (existingLeaves.length > 0) {
      await this.app.workspace.revealLeaf(existingLeaves[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({
      type: VIEW_TYPE_TIMER_SIDEBAR,
      active: true
    });
    await this.app.workspace.revealLeaf(leaf);
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcbiAgQXBwLFxuICBJdGVtVmlldyxcbiAgTWFya2Rvd25SZW5kZXJlcixcbiAgUGx1Z2luLFxuICBXb3Jrc3BhY2VMZWFmLFxuICBIZWFkaW5nQ2FjaGVcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmNvbnN0IFZJRVdfVFlQRV9USU1FUl9TSURFQkFSID0gXCJqdy10aW1lci1zaWRlYmFyLXZpZXdcIjtcbmNvbnN0IFNUT1JBR0VfVkVSU0lPTiA9IDE7XG5jb25zdCBUSU1FUl9SRVRFTlRJT05fTVMgPSAzMCAqIDI0ICogNjAgKiA2MCAqIDEwMDA7XG5cbmNvbnN0IFVJX1RFWFQgPSB7XG4gIHRpdGxlOiBcIlx1MjNGMVx1RkUwRlwiLFxuICBlbXB0eTogXCJcdTIyMDVcIixcbiAgb3BlbjogXCJcdTI1QjZcdUZFMEZcIixcbiAgcGF1c2U6IFwiXHUyM0Y4XHVGRTBGXCIsXG4gIHRhcmdldDogXCJcdUQ4M0NcdURGQUZcIixcbiAgcmVzZXQ6IFwiXHVEODNEXHVERDA0XCIsXG4gIGRlbGV0ZTogXCJcdUQ4M0RcdURERDFcdUZFMEZcIixcbiAgcmVzZXRBbGw6IFwiXHUyNjdCXHVGRTBGXCJcbn0gYXMgY29uc3Q7XG5cbmludGVyZmFjZSBUaW1lckVudHJ5IHtcbiAgaWQ6IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgZWxhcHNlZE1zOiBudW1iZXI7XG4gIHRhcmdldE1zOiBudW1iZXIgfCBudWxsO1xuICBydW5uaW5nOiBib29sZWFuO1xuICBzdGFydGVkQXQ6IG51bWJlciB8IG51bGw7XG59XG5cbmludGVyZmFjZSBUaW1lclVpUmVmIHtcbiAgY2FyZEVsOiBIVE1MRWxlbWVudDtcbiAgdGltZXJFbDogSFRNTEVsZW1lbnQ7XG4gIHBsYXlTdG9wQnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgdGFyZ2V0QnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgcmVzZXRCdG46IEhUTUxCdXR0b25FbGVtZW50O1xufVxuXG5pbnRlcmZhY2UgU3RvcmVkVGltZXJTdGF0ZSB7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGVsYXBzZWRNczogbnVtYmVyO1xuICB0YXJnZXRNczogbnVtYmVyIHwgbnVsbDtcbiAgZGVsZXRlZDogYm9vbGVhbjtcbiAgdXBkYXRlZEF0OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBUaW1lclN0b3JhZ2VEYXRhIHtcbiAgdmVyc2lvbjogbnVtYmVyO1xuICB0aW1lcnM6IFJlY29yZDxzdHJpbmcsIFN0b3JlZFRpbWVyU3RhdGU+O1xufVxuXG5mdW5jdGlvbiBidWlsZFRpbWVySWQoZmlsZVBhdGg6IHN0cmluZywgaGVhZGluZzogSGVhZGluZ0NhY2hlKTogc3RyaW5nIHtcbiAgY29uc3QgbGluZSA9IGhlYWRpbmcucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gMDtcbiAgcmV0dXJuIGAke2ZpbGVQYXRofTo6JHtsaW5lfTo6JHtoZWFkaW5nLmhlYWRpbmd9YDtcbn1cblxuZnVuY3Rpb24gZm9ybWF0RHVyYXRpb24obXM6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IHRvdGFsU2Vjb25kcyA9IE1hdGgubWF4KDAsIE1hdGguZmxvb3IobXMgLyAxMDAwKSk7XG4gIGNvbnN0IGhvdXJzID0gTWF0aC5mbG9vcih0b3RhbFNlY29uZHMgLyAzNjAwKTtcbiAgY29uc3QgbWludXRlcyA9IE1hdGguZmxvb3IoKHRvdGFsU2Vjb25kcyAlIDM2MDApIC8gNjApO1xuICBjb25zdCBzZWNvbmRzID0gdG90YWxTZWNvbmRzICUgNjA7XG5cbiAgcmV0dXJuIGAke1N0cmluZyhob3VycykucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhtaW51dGVzKS5wYWRTdGFydCgyLCBcIjBcIil9OiR7U3RyaW5nKHNlY29uZHMpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xufVxuXG5jbGFzcyBUaW1lclNpZGViYXJWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIHRpbWVycyA9IG5ldyBNYXA8c3RyaW5nLCBUaW1lckVudHJ5PigpO1xuICBwcml2YXRlIGRlbGV0ZWRUaW1lcklkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBwcml2YXRlIHRpbWVyVWlSZWZzID0gbmV3IE1hcDxzdHJpbmcsIFRpbWVyVWlSZWY+KCk7XG4gIHByaXZhdGUgY3VycmVudEhlYWRpbmdJZHM6IHN0cmluZ1tdID0gW107XG4gIHByaXZhdGUgY3VycmVudEZpbGVQYXRoOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICBwcml2YXRlIGxpc3RFbCE6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGVtcHR5U3RhdGVFbCE6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIHRpY2tIYW5kbGU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHBlcnNpc3RIYW5kbGU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBUSVRMRV9NQVhfTEVOR1RIID0gNjA7XG5cbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZiwgcHJpdmF0ZSByZWFkb25seSBwbHVnaW46IFRpbWVyU2lkZWJhclBsdWdpbikge1xuICAgIHN1cGVyKGxlYWYpO1xuICB9XG5cbiAgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gVklFV19UWVBFX1RJTUVSX1NJREVCQVI7XG4gIH1cblxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcge1xuICAgIHJldHVybiBcIkpXIFRpbWVyc1wiO1xuICB9XG5cbiAgZ2V0SWNvbigpOiBzdHJpbmcge1xuICAgIHJldHVybiBcInRpbWVyXCI7XG4gIH1cblxuICBhc3luYyBvbk9wZW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5jb250ZW50RWwuZW1wdHkoKTtcbiAgICB0aGlzLmNvbnRlbnRFbC5hZGRDbGFzcyhcImp3LXRpbWVyLXNpZGViYXItcm9vdFwiKTtcblxuICAgIGNvbnN0IHdyYXBwZXIgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItd3JhcHBlclwiIH0pO1xuXG4gICAgY29uc3QgdGl0bGVFbCA9IHdyYXBwZXIuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFVJX1RFWFQudGl0bGUsIGNsczogXCJqdy10aW1lci10aXRsZVwiIH0pO1xuICAgIHRpdGxlRWwuc2V0QXR0cihcImFyaWEtbGl2ZVwiLCBcInBvbGl0ZVwiKTtcbiAgICB0aXRsZUVsLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiVGltZXJzIGJ5IGhlYWRpbmdcIik7XG5cbiAgICB0aGlzLmxpc3RFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWxpc3RcIiB9KTtcbiAgICB0aGlzLmVtcHR5U3RhdGVFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWVtcHR5XCIgfSk7XG5cbiAgICBjb25zdCBmb290ZXJFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWZvb3RlclwiIH0pO1xuICAgIGNvbnN0IGRlbGV0ZUFsbEJ0biA9IGZvb3RlckVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgIHRleHQ6IFVJX1RFWFQucmVzZXRBbGwsXG4gICAgICBjbHM6IFwianctdGltZXItYnRuIGp3LXRpbWVyLWJ0bi1kYW5nZXJcIlxuICAgIH0pO1xuICAgIGRlbGV0ZUFsbEJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIlJlc2V0IGFsbCB0aW1lcnNcIik7XG4gICAgZGVsZXRlQWxsQnRuLnNldEF0dHIoXCJ0aXRsZVwiLCBcIlJlc2V0IGFsbCB0aW1lcnNcIik7XG5cbiAgICBkZWxldGVBbGxCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGlmICh0aGlzLmNvbmZpcm1BY3Rpb24oXCJSZXNldCBhbGwgdGltZXJzP1wiKSkge1xuICAgICAgICB0aGlzLmRlbGV0ZUFsbFRpbWVycygpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCAoKSA9PiB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCkpKTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUub24oXCJjaGFuZ2VkXCIsIChmaWxlKSA9PiB7XG4gICAgICAgIGlmIChmaWxlLnBhdGggPT09IHRoaXMuY3VycmVudEZpbGVQYXRoKSB7XG4gICAgICAgICAgdm9pZCB0aGlzLnJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICk7XG5cbiAgICB0aGlzLnRpY2tIYW5kbGUgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gICAgfSwgMjUwKTtcblxuICAgIHRoaXMucGVyc2lzdEhhbmRsZSA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICB0aGlzLnBlcnNpc3RSdW5uaW5nU25hcHNob3RzKCk7XG4gICAgfSwgNTAwMCk7XG5cbiAgICB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCk7XG4gIH1cblxuICBhc3luYyBvbkNsb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLnRpY2tIYW5kbGUgIT09IG51bGwpIHtcbiAgICAgIHdpbmRvdy5jbGVhckludGVydmFsKHRoaXMudGlja0hhbmRsZSk7XG4gICAgICB0aGlzLnRpY2tIYW5kbGUgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5wZXJzaXN0SGFuZGxlICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLnBlcnNpc3RIYW5kbGUpO1xuICAgICAgdGhpcy5wZXJzaXN0SGFuZGxlID0gbnVsbDtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLnBlcnNpc3RBbGxUaW1lcnModHJ1ZSk7XG5cbiAgICB0aGlzLmNvbnRlbnRFbC5yZW1vdmVDbGFzcyhcImp3LXRpbWVyLXNpZGViYXItcm9vdFwiKTtcbiAgICB0aGlzLnRpbWVyVWlSZWZzLmNsZWFyKCk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBhY3RpdmVGaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcblxuICAgIGlmICghYWN0aXZlRmlsZSkge1xuICAgICAgdGhpcy5jdXJyZW50RmlsZVBhdGggPSBudWxsO1xuICAgICAgdGhpcy5jdXJyZW50SGVhZGluZ0lkcyA9IFtdO1xuICAgICAgYXdhaXQgdGhpcy5yZW5kZXJMaXN0KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5jdXJyZW50RmlsZVBhdGggPSBhY3RpdmVGaWxlLnBhdGg7XG4gICAgY29uc3QgZmlsZUNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKGFjdGl2ZUZpbGUpO1xuICAgIGNvbnN0IGZpbGVDYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGFjdGl2ZUZpbGUpO1xuICAgIGNvbnN0IGhlYWRpbmdzID0gKGZpbGVDYWNoZT8uaGVhZGluZ3MgPz8gW10pLnNsaWNlKCkuc29ydCgoYSwgYikgPT4ge1xuICAgICAgY29uc3QgbGluZUEgPSBhLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IDA7XG4gICAgICBjb25zdCBsaW5lQiA9IGIucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gMDtcbiAgICAgIHJldHVybiBsaW5lQSAtIGxpbmVCO1xuICAgIH0pO1xuICAgIGNvbnN0IHJhd0hlYWRpbmdUaXRsZXMgPSB0aGlzLmV4dHJhY3RSYXdIZWFkaW5nVGl0bGVzKGZpbGVDb250ZW50LCBoZWFkaW5ncyk7XG4gICAgdGhpcy5kZWxldGVkVGltZXJJZHMgPSB0aGlzLnBsdWdpbi5nZXREZWxldGVkVGltZXJJZHNGb3JGaWxlKGFjdGl2ZUZpbGUucGF0aCk7XG5cbiAgICBjb25zdCBuZXh0SGVhZGluZ0lkczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBhbGxIZWFkaW5nSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgICBmb3IgKGNvbnN0IGhlYWRpbmcgb2YgaGVhZGluZ3MpIHtcbiAgICAgIGNvbnN0IGlkID0gYnVpbGRUaW1lcklkKGFjdGl2ZUZpbGUucGF0aCwgaGVhZGluZyk7XG4gICAgICBhbGxIZWFkaW5nSWRzLmFkZChpZCk7XG4gICAgICBpZiAodGhpcy5kZWxldGVkVGltZXJJZHMuaGFzKGlkKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgaGVhZGluZ0xpbmUgPSBoZWFkaW5nLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IDA7XG4gICAgICBjb25zdCBoZWFkaW5nVGl0bGUgPSByYXdIZWFkaW5nVGl0bGVzLmdldChoZWFkaW5nTGluZSkgPz8gaGVhZGluZy5oZWFkaW5nO1xuICAgICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgICAgY29uc3Qgc3RvcmVkID0gdGhpcy5wbHVnaW4uZ2V0U3RvcmVkVGltZXIoaWQpO1xuXG4gICAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICAgIHRoaXMudGltZXJzLnNldChpZCwge1xuICAgICAgICAgIGlkLFxuICAgICAgICAgIHRpdGxlOiBoZWFkaW5nVGl0bGUsXG4gICAgICAgICAgZWxhcHNlZE1zOiBzdG9yZWQ/LmVsYXBzZWRNcyA/PyAwLFxuICAgICAgICAgIHRhcmdldE1zOiBzdG9yZWQ/LnRhcmdldE1zID8/IG51bGwsXG4gICAgICAgICAgcnVubmluZzogZmFsc2UsXG4gICAgICAgICAgc3RhcnRlZEF0OiBudWxsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZXhpc3RpbmcudGl0bGUgPSBoZWFkaW5nVGl0bGU7XG4gICAgICAgIGlmIChleGlzdGluZy50YXJnZXRNcyA9PT0gbnVsbCAmJiBzdG9yZWQ/LnRhcmdldE1zICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBleGlzdGluZy50YXJnZXRNcyA9IHN0b3JlZC50YXJnZXRNcztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBuZXh0SGVhZGluZ0lkcy5wdXNoKGlkKTtcbiAgICB9XG5cbiAgICBjb25zdCBuZXh0SWRzU2V0ID0gbmV3IFNldChuZXh0SGVhZGluZ0lkcyk7XG4gICAgZm9yIChjb25zdCBleGlzdGluZ0lkIG9mIFsuLi50aGlzLnRpbWVycy5rZXlzKCldKSB7XG4gICAgICBpZiAoZXhpc3RpbmdJZC5zdGFydHNXaXRoKGAke2FjdGl2ZUZpbGUucGF0aH06OmApICYmICFuZXh0SWRzU2V0LmhhcyhleGlzdGluZ0lkKSkge1xuICAgICAgICB0aGlzLnRpbWVycy5kZWxldGUoZXhpc3RpbmdJZCk7XG4gICAgICAgIHZvaWQgdGhpcy5wbHVnaW4ucmVtb3ZlU3RvcmVkVGltZXIoZXhpc3RpbmdJZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBkZWxldGVkSWQgb2YgWy4uLnRoaXMuZGVsZXRlZFRpbWVySWRzXSkge1xuICAgICAgaWYgKGRlbGV0ZWRJZC5zdGFydHNXaXRoKGAke2FjdGl2ZUZpbGUucGF0aH06OmApICYmICFhbGxIZWFkaW5nSWRzLmhhcyhkZWxldGVkSWQpKSB7XG4gICAgICAgIHRoaXMuZGVsZXRlZFRpbWVySWRzLmRlbGV0ZShkZWxldGVkSWQpO1xuICAgICAgICB2b2lkIHRoaXMucGx1Z2luLnJlbW92ZVN0b3JlZFRpbWVyKGRlbGV0ZWRJZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5jdXJyZW50SGVhZGluZ0lkcyA9IG5leHRIZWFkaW5nSWRzO1xuXG4gICAgZm9yIChjb25zdCBpZCBvZiBuZXh0SGVhZGluZ0lkcykge1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgICAgaWYgKGVudHJ5KSB7XG4gICAgICAgIHRoaXMucGVyc2lzdFRpbWVyKGVudHJ5KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLnJlbmRlckxpc3QoKTtcbiAgfVxuXG4gIHByaXZhdGUgZXh0cmFjdFJhd0hlYWRpbmdUaXRsZXMoY29udGVudDogc3RyaW5nLCBoZWFkaW5nczogSGVhZGluZ0NhY2hlW10pOiBNYXA8bnVtYmVyLCBzdHJpbmc+IHtcbiAgICBjb25zdCBsaW5lcyA9IGNvbnRlbnQuc3BsaXQoL1xccj9cXG4vKTtcbiAgICBjb25zdCB0aXRsZXNCeUxpbmUgPSBuZXcgTWFwPG51bWJlciwgc3RyaW5nPigpO1xuXG4gICAgZm9yIChjb25zdCBoZWFkaW5nIG9mIGhlYWRpbmdzKSB7XG4gICAgICBjb25zdCBsaW5lSW5kZXggPSBoZWFkaW5nLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IC0xO1xuICAgICAgaWYgKGxpbmVJbmRleCA8IDAgfHwgbGluZUluZGV4ID49IGxpbmVzLmxlbmd0aCkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tsaW5lSW5kZXhdO1xuICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzezAsM30jezEsNn1cXHMrKC4qKSQvKTtcbiAgICAgIGlmICghbWF0Y2gpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCByYXcgPSBtYXRjaFsxXS5yZXBsYWNlKC9cXHMrIytcXHMqJC8sIFwiXCIpLnRyaW0oKTtcbiAgICAgIHRpdGxlc0J5TGluZS5zZXQobGluZUluZGV4LCByYXcubGVuZ3RoID4gMCA/IHJhdyA6IGhlYWRpbmcuaGVhZGluZyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRpdGxlc0J5TGluZTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVuZGVyTGlzdCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmxpc3RFbC5lbXB0eSgpO1xuICAgIHRoaXMudGltZXJVaVJlZnMuY2xlYXIoKTtcblxuICAgIGlmICh0aGlzLmN1cnJlbnRIZWFkaW5nSWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5lbXB0eVN0YXRlRWwuc2V0VGV4dChVSV9URVhULmVtcHR5KTtcbiAgICAgIHRoaXMuZW1wdHlTdGF0ZUVsLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiTm8gaGVhZGVycyBmb3VuZCBpbiB0aGUgY3VycmVudCBub3RlXCIpO1xuICAgICAgdGhpcy5lbXB0eVN0YXRlRWwuc2hvdygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuZW1wdHlTdGF0ZUVsLmhpZGUoKTtcblxuICAgIGZvciAoY29uc3QgaWQgb2YgdGhpcy5jdXJyZW50SGVhZGluZ0lkcykge1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgICAgaWYgKCFlbnRyeSkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IGNhcmQgPSB0aGlzLmxpc3RFbC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2FyZFwiIH0pO1xuICAgICAgY29uc3QgdGl0bGVFbCA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNhcmQtdGl0bGVcIiB9KTtcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyVGl0bGVDb250ZW50KHRpdGxlRWwsIGVudHJ5LnRpdGxlKTtcblxuICAgICAgY29uc3QgdGltZXJFbCA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNsb2NrXCIsIHRleHQ6IGZvcm1hdER1cmF0aW9uKHRoaXMuZ2V0RWxhcHNlZChlbnRyeSkpIH0pO1xuXG4gICAgICBjb25zdCBjb250cm9scyA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNvbnRyb2xzXCIgfSk7XG5cbiAgICAgIGNvbnN0IHBsYXlTdG9wQnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwianctdGltZXItYnRuXCIsXG4gICAgICAgIHRleHQ6IGVudHJ5LnJ1bm5pbmcgPyBVSV9URVhULnBhdXNlIDogVUlfVEVYVC5vcGVuXG4gICAgICB9KTtcbiAgICAgIHBsYXlTdG9wQnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIGVudHJ5LnJ1bm5pbmcgPyBcIlBhdXNlIHRpbWVyXCIgOiBcIlN0YXJ0IHRpbWVyXCIpO1xuICAgICAgcGxheVN0b3BCdG4uc2V0QXR0cihcInRpdGxlXCIsIGVudHJ5LnJ1bm5pbmcgPyBcIlBhdXNlIHRpbWVyXCIgOiBcIlN0YXJ0IHRpbWVyXCIpO1xuXG4gICAgICBjb25zdCB0YXJnZXRCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJqdy10aW1lci1idG5cIixcbiAgICAgICAgdGV4dDogVUlfVEVYVC50YXJnZXRcbiAgICAgIH0pO1xuICAgICAgdGFyZ2V0QnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiQ29uZmlndXJlIHRhcmdldCB0aW1lXCIpO1xuXG4gICAgICBjb25zdCByZXNldEJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgICAgY2xzOiBcImp3LXRpbWVyLWJ0blwiLFxuICAgICAgICB0ZXh0OiBVSV9URVhULnJlc2V0XG4gICAgICB9KTtcbiAgICAgIHJlc2V0QnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiUmVzZXQgdGltZXJcIik7XG4gICAgICByZXNldEJ0bi5zZXRBdHRyKFwidGl0bGVcIiwgXCJSZXNldCB0aW1lclwiKTtcblxuICAgICAgY29uc3QgZGVsZXRlQnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwianctdGltZXItYnRuIGp3LXRpbWVyLWJ0bi1kYW5nZXJcIixcbiAgICAgICAgdGV4dDogVUlfVEVYVC5kZWxldGVcbiAgICAgIH0pO1xuICAgICAgZGVsZXRlQnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiRGVsZXRlIHRpbWVyXCIpO1xuICAgICAgZGVsZXRlQnRuLnNldEF0dHIoXCJ0aXRsZVwiLCBcIkRlbGV0ZSB0aW1lclwiKTtcblxuICAgICAgcGxheVN0b3BCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgaWYgKGVudHJ5LnJ1bm5pbmcpIHtcbiAgICAgICAgICB0aGlzLnBhdXNlVGltZXIoZW50cnkuaWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuc3RhcnRUaW1lcihlbnRyeS5pZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICB0YXJnZXRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgdGhpcy5jb25maWd1cmVUYXJnZXRUaW1lKGVudHJ5LmlkKTtcbiAgICAgIH0pO1xuXG4gICAgICByZXNldEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICB0aGlzLnJlc2V0VGltZXIoZW50cnkuaWQpO1xuICAgICAgfSk7XG5cbiAgICAgIGRlbGV0ZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICBpZiAodGhpcy5jb25maXJtQWN0aW9uKFwiRGVsZXRlIHRoaXMgdGltZXI/XCIpKSB7XG4gICAgICAgICAgdGhpcy5kZWxldGVUaW1lcihlbnRyeS5pZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnRpbWVyVWlSZWZzLnNldChlbnRyeS5pZCwgeyBjYXJkRWw6IGNhcmQsIHRpbWVyRWwsIHBsYXlTdG9wQnRuLCB0YXJnZXRCdG4sIHJlc2V0QnRuIH0pO1xuICAgIH1cblxuICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRFbGFwc2VkKGVudHJ5OiBUaW1lckVudHJ5KTogbnVtYmVyIHtcbiAgICBpZiAoIWVudHJ5LnJ1bm5pbmcgfHwgZW50cnkuc3RhcnRlZEF0ID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gZW50cnkuZWxhcHNlZE1zO1xuICAgIH1cblxuICAgIHJldHVybiBlbnRyeS5lbGFwc2VkTXMgKyAoRGF0ZS5ub3coKSAtIGVudHJ5LnN0YXJ0ZWRBdCk7XG4gIH1cblxuICBwcml2YXRlIHN0YXJ0VGltZXIoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICBpZiAoIWVudHJ5IHx8IGVudHJ5LnJ1bm5pbmcpIHJldHVybjtcblxuICAgIGVudHJ5LnJ1bm5pbmcgPSB0cnVlO1xuICAgIGVudHJ5LnN0YXJ0ZWRBdCA9IERhdGUubm93KCk7XG4gICAgdGhpcy5wZXJzaXN0VGltZXIoZW50cnkpO1xuICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICB9XG5cbiAgcHJpdmF0ZSBwYXVzZVRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgaWYgKCFlbnRyeSB8fCAhZW50cnkucnVubmluZykgcmV0dXJuO1xuXG4gICAgZW50cnkuZWxhcHNlZE1zID0gdGhpcy5nZXRFbGFwc2VkKGVudHJ5KTtcbiAgICBlbnRyeS5ydW5uaW5nID0gZmFsc2U7XG4gICAgZW50cnkuc3RhcnRlZEF0ID0gbnVsbDtcbiAgICB0aGlzLnBlcnNpc3RUaW1lcihlbnRyeSk7XG4gICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gIH1cblxuICBwcml2YXRlIHJlc2V0VGltZXIoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICBpZiAoIWVudHJ5KSByZXR1cm47XG5cbiAgICBlbnRyeS5lbGFwc2VkTXMgPSAwO1xuICAgIGVudHJ5LnJ1bm5pbmcgPSBmYWxzZTtcbiAgICBlbnRyeS5zdGFydGVkQXQgPSBudWxsO1xuICAgIHRoaXMucGVyc2lzdFRpbWVyKGVudHJ5KTtcbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgY29uZmlndXJlVGFyZ2V0VGltZShpZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgIGlmICghZW50cnkpIHJldHVybjtcblxuICAgIGNvbnN0IGN1cnJlbnRNaW51dGVzID0gZW50cnkudGFyZ2V0TXMgPT09IG51bGwgPyBcIlwiIDogKGVudHJ5LnRhcmdldE1zIC8gNjAwMDApLnRvU3RyaW5nKCk7XG4gICAgY29uc3QgaW5wdXQgPSB3aW5kb3cucHJvbXB0KFwiVGFyZ2V0IG1pbnV0ZXMgKGVtcHR5ID0gY2xlYXIpXCIsIGN1cnJlbnRNaW51dGVzKTtcbiAgICBpZiAoaW5wdXQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBub3JtYWxpemVkID0gaW5wdXQudHJpbSgpLnJlcGxhY2UoXCIsXCIsIFwiLlwiKTtcbiAgICBpZiAoIW5vcm1hbGl6ZWQpIHtcbiAgICAgIGVudHJ5LnRhcmdldE1zID0gbnVsbDtcbiAgICAgIHRoaXMucGVyc2lzdFRpbWVyKGVudHJ5KTtcbiAgICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG1pbnV0ZXMgPSBOdW1iZXIobm9ybWFsaXplZCk7XG4gICAgaWYgKCFOdW1iZXIuaXNGaW5pdGUobWludXRlcykgfHwgbWludXRlcyA8PSAwKSB7XG4gICAgICB3aW5kb3cuYWxlcnQoXCJJbnZhbGlkIHRhcmdldCB0aW1lXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGVudHJ5LnRhcmdldE1zID0gTWF0aC5yb3VuZChtaW51dGVzICogNjAgKiAxMDAwKTtcbiAgICB0aGlzLnBlcnNpc3RUaW1lcihlbnRyeSk7XG4gICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gIH1cblxuICBwcml2YXRlIGRlbGV0ZVRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgdGhpcy5kZWxldGVkVGltZXJJZHMuYWRkKGlkKTtcbiAgICB0aGlzLnRpbWVycy5kZWxldGUoaWQpO1xuICAgIHZvaWQgdGhpcy5wbHVnaW4ubWFya1RpbWVyRGVsZXRlZChpZCwgZW50cnk/LnRpdGxlID8/IFwiXCIsIGVudHJ5Py50YXJnZXRNcyA/PyBudWxsLCBlbnRyeT8uZWxhcHNlZE1zID8/IDApO1xuICAgIHRoaXMuY3VycmVudEhlYWRpbmdJZHMgPSB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzLmZpbHRlcigoaGVhZGluZ0lkKSA9PiBoZWFkaW5nSWQgIT09IGlkKTtcbiAgICB2b2lkIHRoaXMucmVuZGVyTGlzdCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBkZWxldGVBbGxUaW1lcnMoKTogdm9pZCB7XG4gICAgY29uc3QgZmlsZVBhdGggPSB0aGlzLmN1cnJlbnRGaWxlUGF0aDtcbiAgICB0aGlzLnRpbWVycy5jbGVhcigpO1xuICAgIHRoaXMuZGVsZXRlZFRpbWVySWRzLmNsZWFyKCk7XG4gICAgaWYgKGZpbGVQYXRoKSB7XG4gICAgICB2b2lkIHRoaXMucGx1Z2luLmNsZWFyRmlsZVRpbWVycyhmaWxlUGF0aCk7XG4gICAgfVxuICAgIHZvaWQgdGhpcy5yZWZyZXNoRnJvbUFjdGl2ZUZpbGUoKTtcbiAgfVxuXG4gIHByaXZhdGUgY29uZmlybUFjdGlvbihtZXNzYWdlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gd2luZG93LmNvbmZpcm0obWVzc2FnZSk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZVRpbWVyRGlzcGxheXMoKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBpZCBvZiB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzKSB7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgICBjb25zdCB1aSA9IHRoaXMudGltZXJVaVJlZnMuZ2V0KGlkKTtcbiAgICAgIGlmICghZW50cnkgfHwgIXVpKSBjb250aW51ZTtcblxuICAgICAgdWkudGltZXJFbC5zZXRUZXh0KGZvcm1hdER1cmF0aW9uKHRoaXMuZ2V0RWxhcHNlZChlbnRyeSkpKTtcbiAgICAgIHVpLnBsYXlTdG9wQnRuLnNldFRleHQoZW50cnkucnVubmluZyA/IFVJX1RFWFQucGF1c2UgOiBVSV9URVhULm9wZW4pO1xuICAgICAgdWkucGxheVN0b3BCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgZW50cnkucnVubmluZyA/IFwiUGF1c2UgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG4gICAgICB1aS5wbGF5U3RvcEJ0bi5zZXRBdHRyKFwidGl0bGVcIiwgZW50cnkucnVubmluZyA/IFwiUGF1c2UgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG5cbiAgICAgIGNvbnN0IHRhcmdldE1pbnV0ZXMgPSBlbnRyeS50YXJnZXRNcyA9PT0gbnVsbCA/IFwiXCIgOiAoZW50cnkudGFyZ2V0TXMgLyA2MDAwMCkudG9GaXhlZCgxKS5yZXBsYWNlKC9cXC4wJC8sIFwiXCIpO1xuICAgICAgdWkudGFyZ2V0QnRuLnNldEF0dHIoXG4gICAgICAgIFwidGl0bGVcIixcbiAgICAgICAgZW50cnkudGFyZ2V0TXMgPT09IG51bGwgPyBcIkNvbmZpZ3VyZSB0YXJnZXQgdGltZVwiIDogYFRhcmdldDogJHt0YXJnZXRNaW51dGVzfSBtaW5gXG4gICAgICApO1xuXG4gICAgICBjb25zdCBlbGFwc2VkID0gdGhpcy5nZXRFbGFwc2VkKGVudHJ5KTtcbiAgICAgIGNvbnN0IGhhc1RhcmdldCA9IGVudHJ5LnRhcmdldE1zICE9PSBudWxsO1xuICAgICAgY29uc3QgaXNPdmVyVGFyZ2V0ID0gaGFzVGFyZ2V0ICYmIGVsYXBzZWQgPiAoZW50cnkudGFyZ2V0TXMgPz8gMCk7XG5cbiAgICAgIHVpLmNhcmRFbC5yZW1vdmVDbGFzcyhcImp3LXRpbWVyLWNhcmQtLXJ1bm5pbmdcIiwgXCJqdy10aW1lci1jYXJkLS1zdG9wcGVkXCIsIFwianctdGltZXItY2FyZC0tb3ZlcmR1ZS1ydW5uaW5nXCIpO1xuICAgICAgdWkudGltZXJFbC5yZW1vdmVDbGFzcyhcImp3LXRpbWVyLWNsb2NrLS10YXJnZXQtb3ZlclwiLCBcImp3LXRpbWVyLWNsb2NrLS10YXJnZXQtb2tcIik7XG5cbiAgICAgIGlmIChlbnRyeS5ydW5uaW5nICYmIGlzT3ZlclRhcmdldCkge1xuICAgICAgICB1aS5jYXJkRWwuYWRkQ2xhc3MoXCJqdy10aW1lci1jYXJkLS1vdmVyZHVlLXJ1bm5pbmdcIik7XG4gICAgICAgIHVpLnRpbWVyRWwuYWRkQ2xhc3MoXCJqdy10aW1lci1jbG9jay0tdGFyZ2V0LW92ZXJcIik7XG4gICAgICB9IGVsc2UgaWYgKGVudHJ5LnJ1bm5pbmcpIHtcbiAgICAgICAgdWkuY2FyZEVsLmFkZENsYXNzKFwianctdGltZXItY2FyZC0tcnVubmluZ1wiKTtcbiAgICAgIH0gZWxzZSBpZiAoZWxhcHNlZCA+IDApIHtcbiAgICAgICAgdWkuY2FyZEVsLmFkZENsYXNzKFwianctdGltZXItY2FyZC0tc3RvcHBlZFwiKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFlbnRyeS5ydW5uaW5nICYmIGhhc1RhcmdldCkge1xuICAgICAgICBpZiAoaXNPdmVyVGFyZ2V0KSB7XG4gICAgICAgICAgdWkudGltZXJFbC5hZGRDbGFzcyhcImp3LXRpbWVyLWNsb2NrLS10YXJnZXQtb3ZlclwiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB1aS50aW1lckVsLmFkZENsYXNzKFwianctdGltZXItY2xvY2stLXRhcmdldC1va1wiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcGVyc2lzdFRpbWVyKGVudHJ5OiBUaW1lckVudHJ5KTogdm9pZCB7XG4gICAgY29uc3QgZWxhcHNlZCA9IHRoaXMuZ2V0RWxhcHNlZChlbnRyeSk7XG4gICAgdm9pZCB0aGlzLnBsdWdpbi51cHNlcnRTdG9yZWRUaW1lcihlbnRyeS5pZCwge1xuICAgICAgdGl0bGU6IGVudHJ5LnRpdGxlLFxuICAgICAgZWxhcHNlZE1zOiBlbGFwc2VkLFxuICAgICAgdGFyZ2V0TXM6IGVudHJ5LnRhcmdldE1zLFxuICAgICAgZGVsZXRlZDogZmFsc2VcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcGVyc2lzdEFsbFRpbWVycyhmcmVlemVSdW5uaW5nOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdXBkYXRlczogUHJvbWlzZTx2b2lkPltdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMudGltZXJzLnZhbHVlcygpKSB7XG4gICAgICBsZXQgZWxhcHNlZCA9IHRoaXMuZ2V0RWxhcHNlZChlbnRyeSk7XG4gICAgICBpZiAoZnJlZXplUnVubmluZyAmJiBlbnRyeS5ydW5uaW5nKSB7XG4gICAgICAgIGVudHJ5LmVsYXBzZWRNcyA9IGVsYXBzZWQ7XG4gICAgICAgIGVudHJ5LnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgZW50cnkuc3RhcnRlZEF0ID0gbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAoIWVudHJ5LnJ1bm5pbmcpIHtcbiAgICAgICAgZWxhcHNlZCA9IGVudHJ5LmVsYXBzZWRNcztcbiAgICAgIH1cblxuICAgICAgdXBkYXRlcy5wdXNoKFxuICAgICAgICB0aGlzLnBsdWdpbi51cHNlcnRTdG9yZWRUaW1lcihlbnRyeS5pZCwge1xuICAgICAgICAgIHRpdGxlOiBlbnRyeS50aXRsZSxcbiAgICAgICAgICBlbGFwc2VkTXM6IGVsYXBzZWQsXG4gICAgICAgICAgdGFyZ2V0TXM6IGVudHJ5LnRhcmdldE1zLFxuICAgICAgICAgIGRlbGV0ZWQ6IGZhbHNlXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIGF3YWl0IFByb21pc2UuYWxsKHVwZGF0ZXMpO1xuICB9XG5cbiAgcHJpdmF0ZSBwZXJzaXN0UnVubmluZ1NuYXBzaG90cygpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMudGltZXJzLnZhbHVlcygpKSB7XG4gICAgICBpZiAoZW50cnkucnVubmluZykge1xuICAgICAgICB0aGlzLnBlcnNpc3RUaW1lcihlbnRyeSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZW5kZXJUaXRsZUNvbnRlbnQodGl0bGVFbDogSFRNTEVsZW1lbnQsIHJhd1RpdGxlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByZW5kZXJlZEVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgcmF3VGl0bGUsIHJlbmRlcmVkRWwsIHRoaXMuY3VycmVudEZpbGVQYXRoID8/IFwiXCIsIHRoaXMpO1xuICAgIHRoaXMucmVzdG9yZUlubGluZUh0bWxBdHRyaWJ1dGVzKHJlbmRlcmVkRWwsIHJhd1RpdGxlKTtcblxuICAgIGNvbnN0IHBsYWluID0gKHJlbmRlcmVkRWwudGV4dENvbnRlbnQgPz8gXCJcIikucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xuICAgIGlmIChwbGFpbi5sZW5ndGggPiBUaW1lclNpZGViYXJWaWV3LlRJVExFX01BWF9MRU5HVEgpIHtcbiAgICAgIHRoaXMudHJ1bmNhdGVSZW5kZXJlZENvbnRlbnQocmVuZGVyZWRFbCwgVGltZXJTaWRlYmFyVmlldy5USVRMRV9NQVhfTEVOR1RIKTtcbiAgICAgIHRpdGxlRWwuc2V0QXR0cihcInRpdGxlXCIsIHBsYWluKTtcbiAgICAgIHRpdGxlRWwuc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgcGxhaW4pO1xuICAgIH1cblxuICAgIHRpdGxlRWwuZW1wdHkoKTtcbiAgICB3aGlsZSAocmVuZGVyZWRFbC5maXJzdENoaWxkKSB7XG4gICAgICB0aXRsZUVsLmFwcGVuZENoaWxkKHJlbmRlcmVkRWwuZmlyc3RDaGlsZCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZXN0b3JlSW5saW5lSHRtbEF0dHJpYnV0ZXMoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LCByYXdUaXRsZTogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgcGFyc2VkUm9vdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgcGFyc2VkUm9vdC5pbm5lckhUTUwgPSByYXdUaXRsZTtcblxuICAgIGNvbnN0IHNvdXJjZUVsZW1lbnRzID0gQXJyYXkuZnJvbShwYXJzZWRSb290LnF1ZXJ5U2VsZWN0b3JBbGwoXCIqXCIpKS5maWx0ZXIoKGVsZW1lbnQpID0+IHtcbiAgICAgIGNvbnN0IGF0dHJpYnV0ZU5hbWVzID0gZWxlbWVudC5nZXRBdHRyaWJ1dGVOYW1lcygpO1xuICAgICAgcmV0dXJuIGF0dHJpYnV0ZU5hbWVzLmxlbmd0aCA+IDA7XG4gICAgfSk7XG4gICAgdGhpcy5hcHBseU1hdGNoaW5nQXR0cmlidXRlcyhzb3VyY2VFbGVtZW50cywgY29udGFpbmVyRWwpO1xuICB9XG5cbiAgcHJpdmF0ZSBhcHBseU1hdGNoaW5nQXR0cmlidXRlcyhzb3VyY2VFbGVtZW50czogRWxlbWVudFtdLCBjb250YWluZXJFbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb25zdCB1c2VkVGFyZ2V0cyA9IG5ldyBTZXQ8RWxlbWVudD4oKTtcblxuICAgIGZvciAoY29uc3Qgc291cmNlRWwgb2Ygc291cmNlRWxlbWVudHMpIHtcbiAgICAgIGNvbnN0IHNvdXJjZVRleHQgPSBzb3VyY2VFbC50ZXh0Q29udGVudD8ucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xuICAgICAgaWYgKCFzb3VyY2VUZXh0KSBjb250aW51ZTtcblxuICAgICAgY29uc3QgY2FuZGlkYXRlVGFyZ2V0cyA9IEFycmF5LmZyb20oY29udGFpbmVyRWwucXVlcnlTZWxlY3RvckFsbChzb3VyY2VFbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkpKTtcbiAgICAgIGNvbnN0IHRhcmdldEVsID0gY2FuZGlkYXRlVGFyZ2V0cy5maW5kKChjYW5kaWRhdGUpID0+IHtcbiAgICAgICAgaWYgKHVzZWRUYXJnZXRzLmhhcyhjYW5kaWRhdGUpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2FuZGlkYXRlVGV4dCA9IGNhbmRpZGF0ZS50ZXh0Q29udGVudD8ucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xuICAgICAgICByZXR1cm4gY2FuZGlkYXRlVGV4dCA9PT0gc291cmNlVGV4dDtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXRhcmdldEVsKSBjb250aW51ZTtcblxuICAgICAgdXNlZFRhcmdldHMuYWRkKHRhcmdldEVsKTtcbiAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBzb3VyY2VFbC5nZXRBdHRyaWJ1dGVOYW1lcygpKSB7XG4gICAgICAgIHRhcmdldEVsLnNldEF0dHJpYnV0ZShhdHRyLCBzb3VyY2VFbC5nZXRBdHRyaWJ1dGUoYXR0cikgPz8gXCJcIik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSB0cnVuY2F0ZVJlbmRlcmVkQ29udGVudChjb250YWluZXJFbDogSFRNTEVsZW1lbnQsIG1heExlbmd0aDogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3Qgd2Fsa2VyID0gZG9jdW1lbnQuY3JlYXRlVHJlZVdhbGtlcihjb250YWluZXJFbCwgTm9kZUZpbHRlci5TSE9XX1RFWFQpO1xuICAgIGNvbnN0IHRleHROb2RlczogVGV4dFtdID0gW107XG5cbiAgICB3aGlsZSAod2Fsa2VyLm5leHROb2RlKCkpIHtcbiAgICAgIHRleHROb2Rlcy5wdXNoKHdhbGtlci5jdXJyZW50Tm9kZSBhcyBUZXh0KTtcbiAgICB9XG5cbiAgICBsZXQgdXNlZExlbmd0aCA9IDA7XG4gICAgbGV0IHJlYWNoZWRMaW1pdCA9IGZhbHNlO1xuXG4gICAgZm9yIChjb25zdCB0ZXh0Tm9kZSBvZiB0ZXh0Tm9kZXMpIHtcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSB0ZXh0Tm9kZS50ZXh0Q29udGVudD8ucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikgPz8gXCJcIjtcbiAgICAgIGlmICghbm9ybWFsaXplZC50cmltKCkpIHtcbiAgICAgICAgaWYgKHJlYWNoZWRMaW1pdCkge1xuICAgICAgICAgIHRleHROb2RlLnRleHRDb250ZW50ID0gXCJcIjtcbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlYWNoZWRMaW1pdCkge1xuICAgICAgICB0ZXh0Tm9kZS50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZW1haW5pbmcgPSBtYXhMZW5ndGggLSB1c2VkTGVuZ3RoO1xuICAgICAgaWYgKG5vcm1hbGl6ZWQubGVuZ3RoIDw9IHJlbWFpbmluZykge1xuICAgICAgICB1c2VkTGVuZ3RoICs9IG5vcm1hbGl6ZWQubGVuZ3RoO1xuICAgICAgICB0ZXh0Tm9kZS50ZXh0Q29udGVudCA9IG5vcm1hbGl6ZWQ7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBzbGljZUxlbmd0aCA9IE1hdGgubWF4KDAsIHJlbWFpbmluZyAtIDMpO1xuICAgICAgY29uc3QgdHJ1bmNhdGVkVGV4dCA9IGAke25vcm1hbGl6ZWQuc2xpY2UoMCwgc2xpY2VMZW5ndGgpLnRyaW1FbmQoKX0uLi5gO1xuICAgICAgdGV4dE5vZGUudGV4dENvbnRlbnQgPSB0cnVuY2F0ZWRUZXh0O1xuICAgICAgcmVhY2hlZExpbWl0ID0gdHJ1ZTtcbiAgICAgIHVzZWRMZW5ndGggPSBtYXhMZW5ndGg7XG4gICAgfVxuXG4gICAgdGhpcy5yZW1vdmVFbXB0eU5vZGVzKGNvbnRhaW5lckVsKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVtb3ZlRW1wdHlOb2Rlcyhyb290RWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgY29uc3QgY2hpbGROb2RlcyA9IEFycmF5LmZyb20ocm9vdEVsLmNoaWxkTm9kZXMpO1xuXG4gICAgZm9yIChjb25zdCBjaGlsZE5vZGUgb2YgY2hpbGROb2Rlcykge1xuICAgICAgaWYgKGNoaWxkTm9kZS5ub2RlVHlwZSA9PT0gTm9kZS5URVhUX05PREUpIHtcbiAgICAgICAgaWYgKCEoY2hpbGROb2RlLnRleHRDb250ZW50ID8/IFwiXCIpLnRyaW0oKSkge1xuICAgICAgICAgIGNoaWxkTm9kZS5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNoaWxkTm9kZSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG4gICAgICAgIHRoaXMucmVtb3ZlRW1wdHlOb2RlcyhjaGlsZE5vZGUpO1xuICAgICAgICBjb25zdCBoYXNNZWFuaW5nZnVsVGV4dCA9IChjaGlsZE5vZGUudGV4dENvbnRlbnQgPz8gXCJcIikudHJpbSgpLmxlbmd0aCA+IDA7XG4gICAgICAgIGNvbnN0IGhhc0VsZW1lbnRDaGlsZHJlbiA9IGNoaWxkTm9kZS5jaGlsZHJlbi5sZW5ndGggPiAwO1xuICAgICAgICBpZiAoIWhhc01lYW5pbmdmdWxUZXh0ICYmICFoYXNFbGVtZW50Q2hpbGRyZW4pIHtcbiAgICAgICAgICBjaGlsZE5vZGUucmVtb3ZlKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGltZXJTaWRlYmFyUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgcHJpdmF0ZSBzdG9yYWdlOiBUaW1lclN0b3JhZ2VEYXRhID0geyB2ZXJzaW9uOiBTVE9SQUdFX1ZFUlNJT04sIHRpbWVyczoge30gfTtcbiAgcHJpdmF0ZSBzYXZlSGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5zdG9yYWdlID0gdGhpcy5ub3JtYWxpemVTdG9yYWdlRGF0YShhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICAgIGlmICh0aGlzLnBydW5lT2xkVGltZXJzKCkpIHtcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zdG9yYWdlKTtcbiAgICB9XG5cbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEVfVElNRVJfU0lERUJBUiwgKGxlYWYpID0+IG5ldyBUaW1lclNpZGViYXJWaWV3KGxlYWYsIHRoaXMpKTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcInRpbWVyXCIsIFwiT3BlbiBKVyBUaW1lciBzaWRlYmFyXCIsICgpID0+IHtcbiAgICAgIHZvaWQgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJvcGVuLWp3LXRpbWVyLXNpZGViYXJcIixcbiAgICAgIG5hbWU6IFwiT3BlbiBKVyBUaW1lciBzaWRlYmFyXCIsXG4gICAgICBjYWxsYmFjazogYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLmFjdGl2YXRlVmlldygpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoKCkgPT4ge1xuICAgICAgdm9pZCB0aGlzLmFjdGl2YXRlVmlldygpO1xuICAgIH0pO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuc2F2ZUhhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnNhdmVIYW5kbGUpO1xuICAgICAgdGhpcy5zYXZlSGFuZGxlID0gbnVsbDtcbiAgICAgIHZvaWQgdGhpcy5zYXZlRGF0YSh0aGlzLnN0b3JhZ2UpO1xuICAgIH1cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9USU1FUl9TSURFQkFSKTtcbiAgfVxuXG4gIGdldFN0b3JlZFRpbWVyKGlkOiBzdHJpbmcpOiBTdG9yZWRUaW1lclN0YXRlIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5zdG9yYWdlLnRpbWVyc1tpZF07XG4gIH1cblxuICBnZXREZWxldGVkVGltZXJJZHNGb3JGaWxlKGZpbGVQYXRoOiBzdHJpbmcpOiBTZXQ8c3RyaW5nPiB7XG4gICAgY29uc3QgZGVsZXRlZElkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IHByZWZpeCA9IGAke2ZpbGVQYXRofTo6YDtcblxuICAgIGZvciAoY29uc3QgW2lkLCBzdGF0ZV0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5zdG9yYWdlLnRpbWVycykpIHtcbiAgICAgIGlmIChpZC5zdGFydHNXaXRoKHByZWZpeCkgJiYgc3RhdGUuZGVsZXRlZCkge1xuICAgICAgICBkZWxldGVkSWRzLmFkZChpZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlbGV0ZWRJZHM7XG4gIH1cblxuICBhc3luYyB1cHNlcnRTdG9yZWRUaW1lcihcbiAgICBpZDogc3RyaW5nLFxuICAgIHN0YXRlOiB7IHRpdGxlOiBzdHJpbmc7IGVsYXBzZWRNczogbnVtYmVyOyB0YXJnZXRNczogbnVtYmVyIHwgbnVsbDsgZGVsZXRlZDogYm9vbGVhbiB9XG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc3RvcmFnZS50aW1lcnNbaWRdID0ge1xuICAgICAgdGl0bGU6IHN0YXRlLnRpdGxlLFxuICAgICAgZWxhcHNlZE1zOiBNYXRoLm1heCgwLCBNYXRoLmZsb29yKHN0YXRlLmVsYXBzZWRNcykpLFxuICAgICAgdGFyZ2V0TXM6IHN0YXRlLnRhcmdldE1zLFxuICAgICAgZGVsZXRlZDogc3RhdGUuZGVsZXRlZCxcbiAgICAgIHVwZGF0ZWRBdDogRGF0ZS5ub3coKVxuICAgIH07XG5cbiAgICB0aGlzLnNjaGVkdWxlU2F2ZSgpO1xuICB9XG5cbiAgYXN5bmMgbWFya1RpbWVyRGVsZXRlZChpZDogc3RyaW5nLCB0aXRsZTogc3RyaW5nLCB0YXJnZXRNczogbnVtYmVyIHwgbnVsbCwgZWxhcHNlZE1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnN0b3JhZ2UudGltZXJzW2lkXSA9IHtcbiAgICAgIHRpdGxlLFxuICAgICAgZWxhcHNlZE1zOiBNYXRoLm1heCgwLCBNYXRoLmZsb29yKGVsYXBzZWRNcykpLFxuICAgICAgdGFyZ2V0TXMsXG4gICAgICBkZWxldGVkOiB0cnVlLFxuICAgICAgdXBkYXRlZEF0OiBEYXRlLm5vdygpXG4gICAgfTtcblxuICAgIHRoaXMuc2NoZWR1bGVTYXZlKCk7XG4gIH1cblxuICBhc3luYyByZW1vdmVTdG9yZWRUaW1lcihpZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCEoaWQgaW4gdGhpcy5zdG9yYWdlLnRpbWVycykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBkZWxldGUgdGhpcy5zdG9yYWdlLnRpbWVyc1tpZF07XG4gICAgdGhpcy5zY2hlZHVsZVNhdmUoKTtcbiAgfVxuXG4gIGFzeW5jIGNsZWFyRmlsZVRpbWVycyhmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcHJlZml4ID0gYCR7ZmlsZVBhdGh9OjpgO1xuICAgIGxldCBjaGFuZ2VkID0gZmFsc2U7XG5cbiAgICBmb3IgKGNvbnN0IGlkIG9mIE9iamVjdC5rZXlzKHRoaXMuc3RvcmFnZS50aW1lcnMpKSB7XG4gICAgICBpZiAoaWQuc3RhcnRzV2l0aChwcmVmaXgpKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0b3JhZ2UudGltZXJzW2lkXTtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgIHRoaXMuc2NoZWR1bGVTYXZlKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBub3JtYWxpemVTdG9yYWdlRGF0YShyYXc6IHVua25vd24pOiBUaW1lclN0b3JhZ2VEYXRhIHtcbiAgICBjb25zdCBmYWxsYmFjazogVGltZXJTdG9yYWdlRGF0YSA9IHsgdmVyc2lvbjogU1RPUkFHRV9WRVJTSU9OLCB0aW1lcnM6IHt9IH07XG4gICAgaWYgKCFyYXcgfHwgdHlwZW9mIHJhdyAhPT0gXCJvYmplY3RcIikge1xuICAgICAgcmV0dXJuIGZhbGxiYWNrO1xuICAgIH1cblxuICAgIGNvbnN0IG1heWJlRGF0YSA9IHJhdyBhcyBQYXJ0aWFsPFRpbWVyU3RvcmFnZURhdGE+O1xuICAgIGlmICghbWF5YmVEYXRhLnRpbWVycyB8fCB0eXBlb2YgbWF5YmVEYXRhLnRpbWVycyAhPT0gXCJvYmplY3RcIikge1xuICAgICAgcmV0dXJuIGZhbGxiYWNrO1xuICAgIH1cblxuICAgIGNvbnN0IG5vcm1hbGl6ZWRUaW1lcnM6IFJlY29yZDxzdHJpbmcsIFN0b3JlZFRpbWVyU3RhdGU+ID0ge307XG4gICAgZm9yIChjb25zdCBbaWQsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhtYXliZURhdGEudGltZXJzKSkge1xuICAgICAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHRpbWVyID0gdmFsdWUgYXMgUGFydGlhbDxTdG9yZWRUaW1lclN0YXRlPjtcbiAgICAgIG5vcm1hbGl6ZWRUaW1lcnNbaWRdID0ge1xuICAgICAgICB0aXRsZTogdHlwZW9mIHRpbWVyLnRpdGxlID09PSBcInN0cmluZ1wiID8gdGltZXIudGl0bGUgOiBcIlwiLFxuICAgICAgICBlbGFwc2VkTXM6IE51bWJlci5pc0Zpbml0ZSh0aW1lci5lbGFwc2VkTXMpID8gTWF0aC5tYXgoMCwgTWF0aC5mbG9vcih0aW1lci5lbGFwc2VkTXMgPz8gMCkpIDogMCxcbiAgICAgICAgdGFyZ2V0TXM6XG4gICAgICAgICAgdGltZXIudGFyZ2V0TXMgPT09IG51bGwgfHwgdGltZXIudGFyZ2V0TXMgPT09IHVuZGVmaW5lZFxuICAgICAgICAgICAgPyBudWxsXG4gICAgICAgICAgICA6IE51bWJlci5pc0Zpbml0ZSh0aW1lci50YXJnZXRNcylcbiAgICAgICAgICAgICAgPyBNYXRoLm1heCgwLCBNYXRoLmZsb29yKHRpbWVyLnRhcmdldE1zKSlcbiAgICAgICAgICAgICAgOiBudWxsLFxuICAgICAgICBkZWxldGVkOiBCb29sZWFuKHRpbWVyLmRlbGV0ZWQpLFxuICAgICAgICB1cGRhdGVkQXQ6XG4gICAgICAgICAgTnVtYmVyLmlzRmluaXRlKHRpbWVyLnVwZGF0ZWRBdCkgJiYgKHRpbWVyLnVwZGF0ZWRBdCA/PyAwKSA+IDBcbiAgICAgICAgICAgID8gTWF0aC5mbG9vcih0aW1lci51cGRhdGVkQXQgYXMgbnVtYmVyKVxuICAgICAgICAgICAgOiBEYXRlLm5vdygpXG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICB2ZXJzaW9uOiBTVE9SQUdFX1ZFUlNJT04sXG4gICAgICB0aW1lcnM6IG5vcm1hbGl6ZWRUaW1lcnNcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBwcnVuZU9sZFRpbWVycygpOiBib29sZWFuIHtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIGxldCBjaGFuZ2VkID0gZmFsc2U7XG5cbiAgICBmb3IgKGNvbnN0IFtpZCwgdGltZXJdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuc3RvcmFnZS50aW1lcnMpKSB7XG4gICAgICBpZiAobm93IC0gdGltZXIudXBkYXRlZEF0ID4gVElNRVJfUkVURU5USU9OX01TKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0b3JhZ2UudGltZXJzW2lkXTtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNoYW5nZWQ7XG4gIH1cblxuICBwcml2YXRlIHNjaGVkdWxlU2F2ZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5wcnVuZU9sZFRpbWVycygpKSB7XG4gICAgICAvLyBLZWVwIHN0b3JhZ2UgYm91bmRlZCBiZWZvcmUgcGVyc2lzdGluZyB0byBkaXNrLlxuICAgIH1cblxuICAgIGlmICh0aGlzLnNhdmVIYW5kbGUgIT09IG51bGwpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5zYXZlSGFuZGxlKTtcbiAgICB9XG5cbiAgICB0aGlzLnNhdmVIYW5kbGUgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLnNhdmVIYW5kbGUgPSBudWxsO1xuICAgICAgdm9pZCB0aGlzLnNhdmVEYXRhKHRoaXMuc3RvcmFnZSk7XG4gICAgfSwgNDAwKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgYWN0aXZhdGVWaWV3KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGV4aXN0aW5nTGVhdmVzID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfVElNRVJfU0lERUJBUik7XG4gICAgaWYgKGV4aXN0aW5nTGVhdmVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGV4aXN0aW5nTGVhdmVzWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldFJpZ2h0TGVhZihmYWxzZSk7XG4gICAgaWYgKCFsZWFmKSByZXR1cm47XG5cbiAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7XG4gICAgICB0eXBlOiBWSUVXX1RZUEVfVElNRVJfU0lERUJBUixcbiAgICAgIGFjdGl2ZTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQU9PO0FBRVAsSUFBTSwwQkFBMEI7QUFDaEMsSUFBTSxrQkFBa0I7QUFDeEIsSUFBTSxxQkFBcUIsS0FBSyxLQUFL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
