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
          running: false,
          startedAt: null
        });
      } else {
        existing.title = headingTitle;
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
      resetBtn.addEventListener("click", () => {
        this.resetTimer(entry.id);
      });
      deleteBtn.addEventListener("click", () => {
        if (this.confirmAction("Delete this timer?")) {
          this.deleteTimer(entry.id);
        }
      });
      this.timerUiRefs.set(entry.id, { cardEl: card, timerEl, playStopBtn, resetBtn });
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
  deleteTimer(id) {
    const entry = this.timers.get(id);
    this.deletedTimerIds.add(id);
    this.timers.delete(id);
    void this.plugin.markTimerDeleted(id, entry?.title ?? "", null, entry?.elapsedMs ?? 0);
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
      const elapsed = this.getElapsed(entry);
      ui.cardEl.removeClass("jw-timer-card--running", "jw-timer-card--stopped");
      if (entry.running) {
        ui.cardEl.addClass("jw-timer-card--running");
      } else if (elapsed > 0) {
        ui.cardEl.addClass("jw-timer-card--stopped");
      }
    }
  }
  persistTimer(entry) {
    const elapsed = this.getElapsed(entry);
    void this.plugin.upsertStoredTimer(entry.id, {
      title: entry.title,
      elapsedMs: elapsed,
      targetMs: null,
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
          targetMs: null,
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcbiAgQXBwLFxuICBJdGVtVmlldyxcbiAgTWFya2Rvd25SZW5kZXJlcixcbiAgUGx1Z2luLFxuICBXb3Jrc3BhY2VMZWFmLFxuICBIZWFkaW5nQ2FjaGVcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmNvbnN0IFZJRVdfVFlQRV9USU1FUl9TSURFQkFSID0gXCJqdy10aW1lci1zaWRlYmFyLXZpZXdcIjtcbmNvbnN0IFNUT1JBR0VfVkVSU0lPTiA9IDE7XG5jb25zdCBUSU1FUl9SRVRFTlRJT05fTVMgPSAzMCAqIDI0ICogNjAgKiA2MCAqIDEwMDA7XG5cbmNvbnN0IFVJX1RFWFQgPSB7XG4gIHRpdGxlOiBcIlx1MjNGMVx1RkUwRlwiLFxuICBlbXB0eTogXCJcdTIyMDVcIixcbiAgb3BlbjogXCJcdTI1QjZcdUZFMEZcIixcbiAgcGF1c2U6IFwiXHUyM0Y4XHVGRTBGXCIsXG4gIHJlc2V0OiBcIlx1RDgzRFx1REQwNFwiLFxuICBkZWxldGU6IFwiXHVEODNEXHVEREQxXHVGRTBGXCIsXG4gIHJlc2V0QWxsOiBcIlx1MjY3Qlx1RkUwRlwiXG59IGFzIGNvbnN0O1xuXG5pbnRlcmZhY2UgVGltZXJFbnRyeSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGVsYXBzZWRNczogbnVtYmVyO1xuICBydW5uaW5nOiBib29sZWFuO1xuICBzdGFydGVkQXQ6IG51bWJlciB8IG51bGw7XG59XG5cbmludGVyZmFjZSBUaW1lclVpUmVmIHtcbiAgY2FyZEVsOiBIVE1MRWxlbWVudDtcbiAgdGltZXJFbDogSFRNTEVsZW1lbnQ7XG4gIHBsYXlTdG9wQnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgcmVzZXRCdG46IEhUTUxCdXR0b25FbGVtZW50O1xufVxuXG5pbnRlcmZhY2UgU3RvcmVkVGltZXJTdGF0ZSB7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGVsYXBzZWRNczogbnVtYmVyO1xuICB0YXJnZXRNczogbnVtYmVyIHwgbnVsbDtcbiAgZGVsZXRlZDogYm9vbGVhbjtcbiAgdXBkYXRlZEF0OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBUaW1lclN0b3JhZ2VEYXRhIHtcbiAgdmVyc2lvbjogbnVtYmVyO1xuICB0aW1lcnM6IFJlY29yZDxzdHJpbmcsIFN0b3JlZFRpbWVyU3RhdGU+O1xufVxuXG5mdW5jdGlvbiBidWlsZFRpbWVySWQoZmlsZVBhdGg6IHN0cmluZywgaGVhZGluZzogSGVhZGluZ0NhY2hlKTogc3RyaW5nIHtcbiAgY29uc3QgbGluZSA9IGhlYWRpbmcucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gMDtcbiAgcmV0dXJuIGAke2ZpbGVQYXRofTo6JHtsaW5lfTo6JHtoZWFkaW5nLmhlYWRpbmd9YDtcbn1cblxuZnVuY3Rpb24gZm9ybWF0RHVyYXRpb24obXM6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IHRvdGFsU2Vjb25kcyA9IE1hdGgubWF4KDAsIE1hdGguZmxvb3IobXMgLyAxMDAwKSk7XG4gIGNvbnN0IGhvdXJzID0gTWF0aC5mbG9vcih0b3RhbFNlY29uZHMgLyAzNjAwKTtcbiAgY29uc3QgbWludXRlcyA9IE1hdGguZmxvb3IoKHRvdGFsU2Vjb25kcyAlIDM2MDApIC8gNjApO1xuICBjb25zdCBzZWNvbmRzID0gdG90YWxTZWNvbmRzICUgNjA7XG5cbiAgcmV0dXJuIGAke1N0cmluZyhob3VycykucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhtaW51dGVzKS5wYWRTdGFydCgyLCBcIjBcIil9OiR7U3RyaW5nKHNlY29uZHMpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xufVxuXG5jbGFzcyBUaW1lclNpZGViYXJWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIHRpbWVycyA9IG5ldyBNYXA8c3RyaW5nLCBUaW1lckVudHJ5PigpO1xuICBwcml2YXRlIGRlbGV0ZWRUaW1lcklkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBwcml2YXRlIHRpbWVyVWlSZWZzID0gbmV3IE1hcDxzdHJpbmcsIFRpbWVyVWlSZWY+KCk7XG4gIHByaXZhdGUgY3VycmVudEhlYWRpbmdJZHM6IHN0cmluZ1tdID0gW107XG4gIHByaXZhdGUgY3VycmVudEZpbGVQYXRoOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICBwcml2YXRlIGxpc3RFbCE6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGVtcHR5U3RhdGVFbCE6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIHRpY2tIYW5kbGU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHBlcnNpc3RIYW5kbGU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBUSVRMRV9NQVhfTEVOR1RIID0gNjA7XG5cbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZiwgcHJpdmF0ZSByZWFkb25seSBwbHVnaW46IFRpbWVyU2lkZWJhclBsdWdpbikge1xuICAgIHN1cGVyKGxlYWYpO1xuICB9XG5cbiAgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gVklFV19UWVBFX1RJTUVSX1NJREVCQVI7XG4gIH1cblxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcge1xuICAgIHJldHVybiBcIkpXIFRpbWVyc1wiO1xuICB9XG5cbiAgZ2V0SWNvbigpOiBzdHJpbmcge1xuICAgIHJldHVybiBcInRpbWVyXCI7XG4gIH1cblxuICBhc3luYyBvbk9wZW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5jb250ZW50RWwuZW1wdHkoKTtcbiAgICB0aGlzLmNvbnRlbnRFbC5hZGRDbGFzcyhcImp3LXRpbWVyLXNpZGViYXItcm9vdFwiKTtcblxuICAgIGNvbnN0IHdyYXBwZXIgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItd3JhcHBlclwiIH0pO1xuXG4gICAgY29uc3QgdGl0bGVFbCA9IHdyYXBwZXIuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFVJX1RFWFQudGl0bGUsIGNsczogXCJqdy10aW1lci10aXRsZVwiIH0pO1xuICAgIHRpdGxlRWwuc2V0QXR0cihcImFyaWEtbGl2ZVwiLCBcInBvbGl0ZVwiKTtcbiAgICB0aXRsZUVsLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiVGltZXJzIGJ5IGhlYWRpbmdcIik7XG5cbiAgICB0aGlzLmxpc3RFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWxpc3RcIiB9KTtcbiAgICB0aGlzLmVtcHR5U3RhdGVFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWVtcHR5XCIgfSk7XG5cbiAgICBjb25zdCBmb290ZXJFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWZvb3RlclwiIH0pO1xuICAgIGNvbnN0IGRlbGV0ZUFsbEJ0biA9IGZvb3RlckVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgIHRleHQ6IFVJX1RFWFQucmVzZXRBbGwsXG4gICAgICBjbHM6IFwianctdGltZXItYnRuIGp3LXRpbWVyLWJ0bi1kYW5nZXJcIlxuICAgIH0pO1xuICAgIGRlbGV0ZUFsbEJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIlJlc2V0IGFsbCB0aW1lcnNcIik7XG4gICAgZGVsZXRlQWxsQnRuLnNldEF0dHIoXCJ0aXRsZVwiLCBcIlJlc2V0IGFsbCB0aW1lcnNcIik7XG5cbiAgICBkZWxldGVBbGxCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGlmICh0aGlzLmNvbmZpcm1BY3Rpb24oXCJSZXNldCBhbGwgdGltZXJzP1wiKSkge1xuICAgICAgICB0aGlzLmRlbGV0ZUFsbFRpbWVycygpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCAoKSA9PiB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCkpKTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUub24oXCJjaGFuZ2VkXCIsIChmaWxlKSA9PiB7XG4gICAgICAgIGlmIChmaWxlLnBhdGggPT09IHRoaXMuY3VycmVudEZpbGVQYXRoKSB7XG4gICAgICAgICAgdm9pZCB0aGlzLnJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICk7XG5cbiAgICB0aGlzLnRpY2tIYW5kbGUgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gICAgfSwgMjUwKTtcblxuICAgIHRoaXMucGVyc2lzdEhhbmRsZSA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICB0aGlzLnBlcnNpc3RSdW5uaW5nU25hcHNob3RzKCk7XG4gICAgfSwgNTAwMCk7XG5cbiAgICB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCk7XG4gIH1cblxuICBhc3luYyBvbkNsb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLnRpY2tIYW5kbGUgIT09IG51bGwpIHtcbiAgICAgIHdpbmRvdy5jbGVhckludGVydmFsKHRoaXMudGlja0hhbmRsZSk7XG4gICAgICB0aGlzLnRpY2tIYW5kbGUgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5wZXJzaXN0SGFuZGxlICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLnBlcnNpc3RIYW5kbGUpO1xuICAgICAgdGhpcy5wZXJzaXN0SGFuZGxlID0gbnVsbDtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLnBlcnNpc3RBbGxUaW1lcnModHJ1ZSk7XG5cbiAgICB0aGlzLmNvbnRlbnRFbC5yZW1vdmVDbGFzcyhcImp3LXRpbWVyLXNpZGViYXItcm9vdFwiKTtcbiAgICB0aGlzLnRpbWVyVWlSZWZzLmNsZWFyKCk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBhY3RpdmVGaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcblxuICAgIGlmICghYWN0aXZlRmlsZSkge1xuICAgICAgdGhpcy5jdXJyZW50RmlsZVBhdGggPSBudWxsO1xuICAgICAgdGhpcy5jdXJyZW50SGVhZGluZ0lkcyA9IFtdO1xuICAgICAgYXdhaXQgdGhpcy5yZW5kZXJMaXN0KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5jdXJyZW50RmlsZVBhdGggPSBhY3RpdmVGaWxlLnBhdGg7XG4gICAgY29uc3QgZmlsZUNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jYWNoZWRSZWFkKGFjdGl2ZUZpbGUpO1xuICAgIGNvbnN0IGZpbGVDYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGFjdGl2ZUZpbGUpO1xuICAgIGNvbnN0IGhlYWRpbmdzID0gKGZpbGVDYWNoZT8uaGVhZGluZ3MgPz8gW10pLnNsaWNlKCkuc29ydCgoYSwgYikgPT4ge1xuICAgICAgY29uc3QgbGluZUEgPSBhLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IDA7XG4gICAgICBjb25zdCBsaW5lQiA9IGIucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gMDtcbiAgICAgIHJldHVybiBsaW5lQSAtIGxpbmVCO1xuICAgIH0pO1xuICAgIGNvbnN0IHJhd0hlYWRpbmdUaXRsZXMgPSB0aGlzLmV4dHJhY3RSYXdIZWFkaW5nVGl0bGVzKGZpbGVDb250ZW50LCBoZWFkaW5ncyk7XG4gICAgdGhpcy5kZWxldGVkVGltZXJJZHMgPSB0aGlzLnBsdWdpbi5nZXREZWxldGVkVGltZXJJZHNGb3JGaWxlKGFjdGl2ZUZpbGUucGF0aCk7XG5cbiAgICBjb25zdCBuZXh0SGVhZGluZ0lkczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCBhbGxIZWFkaW5nSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgICBmb3IgKGNvbnN0IGhlYWRpbmcgb2YgaGVhZGluZ3MpIHtcbiAgICAgIGNvbnN0IGlkID0gYnVpbGRUaW1lcklkKGFjdGl2ZUZpbGUucGF0aCwgaGVhZGluZyk7XG4gICAgICBhbGxIZWFkaW5nSWRzLmFkZChpZCk7XG4gICAgICBpZiAodGhpcy5kZWxldGVkVGltZXJJZHMuaGFzKGlkKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgaGVhZGluZ0xpbmUgPSBoZWFkaW5nLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IDA7XG4gICAgICBjb25zdCBoZWFkaW5nVGl0bGUgPSByYXdIZWFkaW5nVGl0bGVzLmdldChoZWFkaW5nTGluZSkgPz8gaGVhZGluZy5oZWFkaW5nO1xuICAgICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgICAgY29uc3Qgc3RvcmVkID0gdGhpcy5wbHVnaW4uZ2V0U3RvcmVkVGltZXIoaWQpO1xuXG4gICAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICAgIHRoaXMudGltZXJzLnNldChpZCwge1xuICAgICAgICAgIGlkLFxuICAgICAgICAgIHRpdGxlOiBoZWFkaW5nVGl0bGUsXG4gICAgICAgICAgZWxhcHNlZE1zOiBzdG9yZWQ/LmVsYXBzZWRNcyA/PyAwLFxuICAgICAgICAgIHJ1bm5pbmc6IGZhbHNlLFxuICAgICAgICAgIHN0YXJ0ZWRBdDogbnVsbFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGV4aXN0aW5nLnRpdGxlID0gaGVhZGluZ1RpdGxlO1xuICAgICAgfVxuXG4gICAgICBuZXh0SGVhZGluZ0lkcy5wdXNoKGlkKTtcbiAgICB9XG5cbiAgICBjb25zdCBuZXh0SWRzU2V0ID0gbmV3IFNldChuZXh0SGVhZGluZ0lkcyk7XG4gICAgZm9yIChjb25zdCBleGlzdGluZ0lkIG9mIFsuLi50aGlzLnRpbWVycy5rZXlzKCldKSB7XG4gICAgICBpZiAoZXhpc3RpbmdJZC5zdGFydHNXaXRoKGAke2FjdGl2ZUZpbGUucGF0aH06OmApICYmICFuZXh0SWRzU2V0LmhhcyhleGlzdGluZ0lkKSkge1xuICAgICAgICB0aGlzLnRpbWVycy5kZWxldGUoZXhpc3RpbmdJZCk7XG4gICAgICAgIHZvaWQgdGhpcy5wbHVnaW4ucmVtb3ZlU3RvcmVkVGltZXIoZXhpc3RpbmdJZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBkZWxldGVkSWQgb2YgWy4uLnRoaXMuZGVsZXRlZFRpbWVySWRzXSkge1xuICAgICAgaWYgKGRlbGV0ZWRJZC5zdGFydHNXaXRoKGAke2FjdGl2ZUZpbGUucGF0aH06OmApICYmICFhbGxIZWFkaW5nSWRzLmhhcyhkZWxldGVkSWQpKSB7XG4gICAgICAgIHRoaXMuZGVsZXRlZFRpbWVySWRzLmRlbGV0ZShkZWxldGVkSWQpO1xuICAgICAgICB2b2lkIHRoaXMucGx1Z2luLnJlbW92ZVN0b3JlZFRpbWVyKGRlbGV0ZWRJZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5jdXJyZW50SGVhZGluZ0lkcyA9IG5leHRIZWFkaW5nSWRzO1xuXG4gICAgZm9yIChjb25zdCBpZCBvZiBuZXh0SGVhZGluZ0lkcykge1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgICAgaWYgKGVudHJ5KSB7XG4gICAgICAgIHRoaXMucGVyc2lzdFRpbWVyKGVudHJ5KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLnJlbmRlckxpc3QoKTtcbiAgfVxuXG4gIHByaXZhdGUgZXh0cmFjdFJhd0hlYWRpbmdUaXRsZXMoY29udGVudDogc3RyaW5nLCBoZWFkaW5nczogSGVhZGluZ0NhY2hlW10pOiBNYXA8bnVtYmVyLCBzdHJpbmc+IHtcbiAgICBjb25zdCBsaW5lcyA9IGNvbnRlbnQuc3BsaXQoL1xccj9cXG4vKTtcbiAgICBjb25zdCB0aXRsZXNCeUxpbmUgPSBuZXcgTWFwPG51bWJlciwgc3RyaW5nPigpO1xuXG4gICAgZm9yIChjb25zdCBoZWFkaW5nIG9mIGhlYWRpbmdzKSB7XG4gICAgICBjb25zdCBsaW5lSW5kZXggPSBoZWFkaW5nLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IC0xO1xuICAgICAgaWYgKGxpbmVJbmRleCA8IDAgfHwgbGluZUluZGV4ID49IGxpbmVzLmxlbmd0aCkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tsaW5lSW5kZXhdO1xuICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzezAsM30jezEsNn1cXHMrKC4qKSQvKTtcbiAgICAgIGlmICghbWF0Y2gpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCByYXcgPSBtYXRjaFsxXS5yZXBsYWNlKC9cXHMrIytcXHMqJC8sIFwiXCIpLnRyaW0oKTtcbiAgICAgIHRpdGxlc0J5TGluZS5zZXQobGluZUluZGV4LCByYXcubGVuZ3RoID4gMCA/IHJhdyA6IGhlYWRpbmcuaGVhZGluZyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRpdGxlc0J5TGluZTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVuZGVyTGlzdCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmxpc3RFbC5lbXB0eSgpO1xuICAgIHRoaXMudGltZXJVaVJlZnMuY2xlYXIoKTtcblxuICAgIGlmICh0aGlzLmN1cnJlbnRIZWFkaW5nSWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5lbXB0eVN0YXRlRWwuc2V0VGV4dChVSV9URVhULmVtcHR5KTtcbiAgICAgIHRoaXMuZW1wdHlTdGF0ZUVsLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiTm8gaGVhZGVycyBmb3VuZCBpbiB0aGUgY3VycmVudCBub3RlXCIpO1xuICAgICAgdGhpcy5lbXB0eVN0YXRlRWwuc2hvdygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuZW1wdHlTdGF0ZUVsLmhpZGUoKTtcblxuICAgIGZvciAoY29uc3QgaWQgb2YgdGhpcy5jdXJyZW50SGVhZGluZ0lkcykge1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgICAgaWYgKCFlbnRyeSkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IGNhcmQgPSB0aGlzLmxpc3RFbC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2FyZFwiIH0pO1xuICAgICAgY29uc3QgdGl0bGVFbCA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNhcmQtdGl0bGVcIiB9KTtcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyVGl0bGVDb250ZW50KHRpdGxlRWwsIGVudHJ5LnRpdGxlKTtcblxuICAgICAgY29uc3QgdGltZXJFbCA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNsb2NrXCIsIHRleHQ6IGZvcm1hdER1cmF0aW9uKHRoaXMuZ2V0RWxhcHNlZChlbnRyeSkpIH0pO1xuXG4gICAgICBjb25zdCBjb250cm9scyA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNvbnRyb2xzXCIgfSk7XG5cbiAgICAgIGNvbnN0IHBsYXlTdG9wQnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwianctdGltZXItYnRuXCIsXG4gICAgICAgIHRleHQ6IGVudHJ5LnJ1bm5pbmcgPyBVSV9URVhULnBhdXNlIDogVUlfVEVYVC5vcGVuXG4gICAgICB9KTtcbiAgICAgIHBsYXlTdG9wQnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIGVudHJ5LnJ1bm5pbmcgPyBcIlBhdXNlIHRpbWVyXCIgOiBcIlN0YXJ0IHRpbWVyXCIpO1xuICAgICAgcGxheVN0b3BCdG4uc2V0QXR0cihcInRpdGxlXCIsIGVudHJ5LnJ1bm5pbmcgPyBcIlBhdXNlIHRpbWVyXCIgOiBcIlN0YXJ0IHRpbWVyXCIpO1xuXG4gICAgICBjb25zdCByZXNldEJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgICAgY2xzOiBcImp3LXRpbWVyLWJ0blwiLFxuICAgICAgICB0ZXh0OiBVSV9URVhULnJlc2V0XG4gICAgICB9KTtcbiAgICAgIHJlc2V0QnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiUmVzZXQgdGltZXJcIik7XG4gICAgICByZXNldEJ0bi5zZXRBdHRyKFwidGl0bGVcIiwgXCJSZXNldCB0aW1lclwiKTtcblxuICAgICAgY29uc3QgZGVsZXRlQnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwianctdGltZXItYnRuIGp3LXRpbWVyLWJ0bi1kYW5nZXJcIixcbiAgICAgICAgdGV4dDogVUlfVEVYVC5kZWxldGVcbiAgICAgIH0pO1xuICAgICAgZGVsZXRlQnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiRGVsZXRlIHRpbWVyXCIpO1xuICAgICAgZGVsZXRlQnRuLnNldEF0dHIoXCJ0aXRsZVwiLCBcIkRlbGV0ZSB0aW1lclwiKTtcblxuICAgICAgcGxheVN0b3BCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgaWYgKGVudHJ5LnJ1bm5pbmcpIHtcbiAgICAgICAgICB0aGlzLnBhdXNlVGltZXIoZW50cnkuaWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuc3RhcnRUaW1lcihlbnRyeS5pZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICByZXNldEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICB0aGlzLnJlc2V0VGltZXIoZW50cnkuaWQpO1xuICAgICAgfSk7XG5cbiAgICAgIGRlbGV0ZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICBpZiAodGhpcy5jb25maXJtQWN0aW9uKFwiRGVsZXRlIHRoaXMgdGltZXI/XCIpKSB7XG4gICAgICAgICAgdGhpcy5kZWxldGVUaW1lcihlbnRyeS5pZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnRpbWVyVWlSZWZzLnNldChlbnRyeS5pZCwgeyBjYXJkRWw6IGNhcmQsIHRpbWVyRWwsIHBsYXlTdG9wQnRuLCByZXNldEJ0biB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0RWxhcHNlZChlbnRyeTogVGltZXJFbnRyeSk6IG51bWJlciB7XG4gICAgaWYgKCFlbnRyeS5ydW5uaW5nIHx8IGVudHJ5LnN0YXJ0ZWRBdCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGVudHJ5LmVsYXBzZWRNcztcbiAgICB9XG5cbiAgICByZXR1cm4gZW50cnkuZWxhcHNlZE1zICsgKERhdGUubm93KCkgLSBlbnRyeS5zdGFydGVkQXQpO1xuICB9XG5cbiAgcHJpdmF0ZSBzdGFydFRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgaWYgKCFlbnRyeSB8fCBlbnRyeS5ydW5uaW5nKSByZXR1cm47XG5cbiAgICBlbnRyeS5ydW5uaW5nID0gdHJ1ZTtcbiAgICBlbnRyeS5zdGFydGVkQXQgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMucGVyc2lzdFRpbWVyKGVudHJ5KTtcbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgcGF1c2VUaW1lcihpZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgIGlmICghZW50cnkgfHwgIWVudHJ5LnJ1bm5pbmcpIHJldHVybjtcblxuICAgIGVudHJ5LmVsYXBzZWRNcyA9IHRoaXMuZ2V0RWxhcHNlZChlbnRyeSk7XG4gICAgZW50cnkucnVubmluZyA9IGZhbHNlO1xuICAgIGVudHJ5LnN0YXJ0ZWRBdCA9IG51bGw7XG4gICAgdGhpcy5wZXJzaXN0VGltZXIoZW50cnkpO1xuICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICB9XG5cbiAgcHJpdmF0ZSByZXNldFRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgaWYgKCFlbnRyeSkgcmV0dXJuO1xuXG4gICAgZW50cnkuZWxhcHNlZE1zID0gMDtcbiAgICBlbnRyeS5ydW5uaW5nID0gZmFsc2U7XG4gICAgZW50cnkuc3RhcnRlZEF0ID0gbnVsbDtcbiAgICB0aGlzLnBlcnNpc3RUaW1lcihlbnRyeSk7XG4gICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gIH1cblxuICBwcml2YXRlIGRlbGV0ZVRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgdGhpcy5kZWxldGVkVGltZXJJZHMuYWRkKGlkKTtcbiAgICB0aGlzLnRpbWVycy5kZWxldGUoaWQpO1xuICAgIHZvaWQgdGhpcy5wbHVnaW4ubWFya1RpbWVyRGVsZXRlZChpZCwgZW50cnk/LnRpdGxlID8/IFwiXCIsIG51bGwsIGVudHJ5Py5lbGFwc2VkTXMgPz8gMCk7XG4gICAgdGhpcy5jdXJyZW50SGVhZGluZ0lkcyA9IHRoaXMuY3VycmVudEhlYWRpbmdJZHMuZmlsdGVyKChoZWFkaW5nSWQpID0+IGhlYWRpbmdJZCAhPT0gaWQpO1xuICAgIHZvaWQgdGhpcy5yZW5kZXJMaXN0KCk7XG4gIH1cblxuICBwcml2YXRlIGRlbGV0ZUFsbFRpbWVycygpOiB2b2lkIHtcbiAgICBjb25zdCBmaWxlUGF0aCA9IHRoaXMuY3VycmVudEZpbGVQYXRoO1xuICAgIHRoaXMudGltZXJzLmNsZWFyKCk7XG4gICAgdGhpcy5kZWxldGVkVGltZXJJZHMuY2xlYXIoKTtcbiAgICBpZiAoZmlsZVBhdGgpIHtcbiAgICAgIHZvaWQgdGhpcy5wbHVnaW4uY2xlYXJGaWxlVGltZXJzKGZpbGVQYXRoKTtcbiAgICB9XG4gICAgdm9pZCB0aGlzLnJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb25maXJtQWN0aW9uKG1lc3NhZ2U6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB3aW5kb3cuY29uZmlybShtZXNzYWdlKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlVGltZXJEaXNwbGF5cygpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGlkIG9mIHRoaXMuY3VycmVudEhlYWRpbmdJZHMpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICAgIGNvbnN0IHVpID0gdGhpcy50aW1lclVpUmVmcy5nZXQoaWQpO1xuICAgICAgaWYgKCFlbnRyeSB8fCAhdWkpIGNvbnRpbnVlO1xuXG4gICAgICB1aS50aW1lckVsLnNldFRleHQoZm9ybWF0RHVyYXRpb24odGhpcy5nZXRFbGFwc2VkKGVudHJ5KSkpO1xuICAgICAgdWkucGxheVN0b3BCdG4uc2V0VGV4dChlbnRyeS5ydW5uaW5nID8gVUlfVEVYVC5wYXVzZSA6IFVJX1RFWFQub3Blbik7XG4gICAgICB1aS5wbGF5U3RvcEJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBlbnRyeS5ydW5uaW5nID8gXCJQYXVzZSB0aW1lclwiIDogXCJTdGFydCB0aW1lclwiKTtcbiAgICAgIHVpLnBsYXlTdG9wQnRuLnNldEF0dHIoXCJ0aXRsZVwiLCBlbnRyeS5ydW5uaW5nID8gXCJQYXVzZSB0aW1lclwiIDogXCJTdGFydCB0aW1lclwiKTtcblxuICAgICAgY29uc3QgZWxhcHNlZCA9IHRoaXMuZ2V0RWxhcHNlZChlbnRyeSk7XG4gICAgICB1aS5jYXJkRWwucmVtb3ZlQ2xhc3MoXCJqdy10aW1lci1jYXJkLS1ydW5uaW5nXCIsIFwianctdGltZXItY2FyZC0tc3RvcHBlZFwiKTtcblxuICAgICAgaWYgKGVudHJ5LnJ1bm5pbmcpIHtcbiAgICAgICAgdWkuY2FyZEVsLmFkZENsYXNzKFwianctdGltZXItY2FyZC0tcnVubmluZ1wiKTtcbiAgICAgIH0gZWxzZSBpZiAoZWxhcHNlZCA+IDApIHtcbiAgICAgICAgdWkuY2FyZEVsLmFkZENsYXNzKFwianctdGltZXItY2FyZC0tc3RvcHBlZFwiKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHBlcnNpc3RUaW1lcihlbnRyeTogVGltZXJFbnRyeSk6IHZvaWQge1xuICAgIGNvbnN0IGVsYXBzZWQgPSB0aGlzLmdldEVsYXBzZWQoZW50cnkpO1xuICAgIHZvaWQgdGhpcy5wbHVnaW4udXBzZXJ0U3RvcmVkVGltZXIoZW50cnkuaWQsIHtcbiAgICAgIHRpdGxlOiBlbnRyeS50aXRsZSxcbiAgICAgIGVsYXBzZWRNczogZWxhcHNlZCxcbiAgICAgIHRhcmdldE1zOiBudWxsLFxuICAgICAgZGVsZXRlZDogZmFsc2VcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcGVyc2lzdEFsbFRpbWVycyhmcmVlemVSdW5uaW5nOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdXBkYXRlczogUHJvbWlzZTx2b2lkPltdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMudGltZXJzLnZhbHVlcygpKSB7XG4gICAgICBsZXQgZWxhcHNlZCA9IHRoaXMuZ2V0RWxhcHNlZChlbnRyeSk7XG4gICAgICBpZiAoZnJlZXplUnVubmluZyAmJiBlbnRyeS5ydW5uaW5nKSB7XG4gICAgICAgIGVudHJ5LmVsYXBzZWRNcyA9IGVsYXBzZWQ7XG4gICAgICAgIGVudHJ5LnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgZW50cnkuc3RhcnRlZEF0ID0gbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAoIWVudHJ5LnJ1bm5pbmcpIHtcbiAgICAgICAgZWxhcHNlZCA9IGVudHJ5LmVsYXBzZWRNcztcbiAgICAgIH1cblxuICAgICAgdXBkYXRlcy5wdXNoKFxuICAgICAgICB0aGlzLnBsdWdpbi51cHNlcnRTdG9yZWRUaW1lcihlbnRyeS5pZCwge1xuICAgICAgICAgIHRpdGxlOiBlbnRyeS50aXRsZSxcbiAgICAgICAgICBlbGFwc2VkTXM6IGVsYXBzZWQsXG4gICAgICAgICAgdGFyZ2V0TXM6IG51bGwsXG4gICAgICAgICAgZGVsZXRlZDogZmFsc2VcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwodXBkYXRlcyk7XG4gIH1cblxuICBwcml2YXRlIHBlcnNpc3RSdW5uaW5nU25hcHNob3RzKCk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy50aW1lcnMudmFsdWVzKCkpIHtcbiAgICAgIGlmIChlbnRyeS5ydW5uaW5nKSB7XG4gICAgICAgIHRoaXMucGVyc2lzdFRpbWVyKGVudHJ5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlclRpdGxlQ29udGVudCh0aXRsZUVsOiBIVE1MRWxlbWVudCwgcmF3VGl0bGU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJlbmRlcmVkRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIGF3YWl0IE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKHRoaXMuYXBwLCByYXdUaXRsZSwgcmVuZGVyZWRFbCwgdGhpcy5jdXJyZW50RmlsZVBhdGggPz8gXCJcIiwgdGhpcyk7XG4gICAgdGhpcy5yZXN0b3JlSW5saW5lSHRtbEF0dHJpYnV0ZXMocmVuZGVyZWRFbCwgcmF3VGl0bGUpO1xuXG4gICAgY29uc3QgcGxhaW4gPSAocmVuZGVyZWRFbC50ZXh0Q29udGVudCA/PyBcIlwiKS5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gICAgaWYgKHBsYWluLmxlbmd0aCA+IFRpbWVyU2lkZWJhclZpZXcuVElUTEVfTUFYX0xFTkdUSCkge1xuICAgICAgdGhpcy50cnVuY2F0ZVJlbmRlcmVkQ29udGVudChyZW5kZXJlZEVsLCBUaW1lclNpZGViYXJWaWV3LlRJVExFX01BWF9MRU5HVEgpO1xuICAgICAgdGl0bGVFbC5zZXRBdHRyKFwidGl0bGVcIiwgcGxhaW4pO1xuICAgICAgdGl0bGVFbC5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBwbGFpbik7XG4gICAgfVxuXG4gICAgdGl0bGVFbC5lbXB0eSgpO1xuICAgIHdoaWxlIChyZW5kZXJlZEVsLmZpcnN0Q2hpbGQpIHtcbiAgICAgIHRpdGxlRWwuYXBwZW5kQ2hpbGQocmVuZGVyZWRFbC5maXJzdENoaWxkKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHJlc3RvcmVJbmxpbmVIdG1sQXR0cmlidXRlcyhjb250YWluZXJFbDogSFRNTEVsZW1lbnQsIHJhd1RpdGxlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBwYXJzZWRSb290ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBwYXJzZWRSb290LmlubmVySFRNTCA9IHJhd1RpdGxlO1xuXG4gICAgY29uc3Qgc291cmNlRWxlbWVudHMgPSBBcnJheS5mcm9tKHBhcnNlZFJvb3QucXVlcnlTZWxlY3RvckFsbChcIipcIikpLmZpbHRlcigoZWxlbWVudCkgPT4ge1xuICAgICAgY29uc3QgYXR0cmlidXRlTmFtZXMgPSBlbGVtZW50LmdldEF0dHJpYnV0ZU5hbWVzKCk7XG4gICAgICByZXR1cm4gYXR0cmlidXRlTmFtZXMubGVuZ3RoID4gMDtcbiAgICB9KTtcbiAgICB0aGlzLmFwcGx5TWF0Y2hpbmdBdHRyaWJ1dGVzKHNvdXJjZUVsZW1lbnRzLCBjb250YWluZXJFbCk7XG4gIH1cblxuICBwcml2YXRlIGFwcGx5TWF0Y2hpbmdBdHRyaWJ1dGVzKHNvdXJjZUVsZW1lbnRzOiBFbGVtZW50W10sIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGNvbnN0IHVzZWRUYXJnZXRzID0gbmV3IFNldDxFbGVtZW50PigpO1xuXG4gICAgZm9yIChjb25zdCBzb3VyY2VFbCBvZiBzb3VyY2VFbGVtZW50cykge1xuICAgICAgY29uc3Qgc291cmNlVGV4dCA9IHNvdXJjZUVsLnRleHRDb250ZW50Py5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gICAgICBpZiAoIXNvdXJjZVRleHQpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBjYW5kaWRhdGVUYXJnZXRzID0gQXJyYXkuZnJvbShjb250YWluZXJFbC5xdWVyeVNlbGVjdG9yQWxsKHNvdXJjZUVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKSkpO1xuICAgICAgY29uc3QgdGFyZ2V0RWwgPSBjYW5kaWRhdGVUYXJnZXRzLmZpbmQoKGNhbmRpZGF0ZSkgPT4ge1xuICAgICAgICBpZiAodXNlZFRhcmdldHMuaGFzKGNhbmRpZGF0ZSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjYW5kaWRhdGVUZXh0ID0gY2FuZGlkYXRlLnRleHRDb250ZW50Py5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gICAgICAgIHJldHVybiBjYW5kaWRhdGVUZXh0ID09PSBzb3VyY2VUZXh0O1xuICAgICAgfSk7XG5cbiAgICAgIGlmICghdGFyZ2V0RWwpIGNvbnRpbnVlO1xuXG4gICAgICB1c2VkVGFyZ2V0cy5hZGQodGFyZ2V0RWwpO1xuICAgICAgZm9yIChjb25zdCBhdHRyIG9mIHNvdXJjZUVsLmdldEF0dHJpYnV0ZU5hbWVzKCkpIHtcbiAgICAgICAgdGFyZ2V0RWwuc2V0QXR0cmlidXRlKGF0dHIsIHNvdXJjZUVsLmdldEF0dHJpYnV0ZShhdHRyKSA/PyBcIlwiKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHRydW5jYXRlUmVuZGVyZWRDb250ZW50KGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCwgbWF4TGVuZ3RoOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCB3YWxrZXIgPSBkb2N1bWVudC5jcmVhdGVUcmVlV2Fsa2VyKGNvbnRhaW5lckVsLCBOb2RlRmlsdGVyLlNIT1dfVEVYVCk7XG4gICAgY29uc3QgdGV4dE5vZGVzOiBUZXh0W10gPSBbXTtcblxuICAgIHdoaWxlICh3YWxrZXIubmV4dE5vZGUoKSkge1xuICAgICAgdGV4dE5vZGVzLnB1c2god2Fsa2VyLmN1cnJlbnROb2RlIGFzIFRleHQpO1xuICAgIH1cblxuICAgIGxldCB1c2VkTGVuZ3RoID0gMDtcbiAgICBsZXQgcmVhY2hlZExpbWl0ID0gZmFsc2U7XG5cbiAgICBmb3IgKGNvbnN0IHRleHROb2RlIG9mIHRleHROb2Rlcykge1xuICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IHRleHROb2RlLnRleHRDb250ZW50Py5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKSA/PyBcIlwiO1xuICAgICAgaWYgKCFub3JtYWxpemVkLnRyaW0oKSkge1xuICAgICAgICBpZiAocmVhY2hlZExpbWl0KSB7XG4gICAgICAgICAgdGV4dE5vZGUudGV4dENvbnRlbnQgPSBcIlwiO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVhY2hlZExpbWl0KSB7XG4gICAgICAgIHRleHROb2RlLnRleHRDb250ZW50ID0gXCJcIjtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlbWFpbmluZyA9IG1heExlbmd0aCAtIHVzZWRMZW5ndGg7XG4gICAgICBpZiAobm9ybWFsaXplZC5sZW5ndGggPD0gcmVtYWluaW5nKSB7XG4gICAgICAgIHVzZWRMZW5ndGggKz0gbm9ybWFsaXplZC5sZW5ndGg7XG4gICAgICAgIHRleHROb2RlLnRleHRDb250ZW50ID0gbm9ybWFsaXplZDtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNsaWNlTGVuZ3RoID0gTWF0aC5tYXgoMCwgcmVtYWluaW5nIC0gMyk7XG4gICAgICBjb25zdCB0cnVuY2F0ZWRUZXh0ID0gYCR7bm9ybWFsaXplZC5zbGljZSgwLCBzbGljZUxlbmd0aCkudHJpbUVuZCgpfS4uLmA7XG4gICAgICB0ZXh0Tm9kZS50ZXh0Q29udGVudCA9IHRydW5jYXRlZFRleHQ7XG4gICAgICByZWFjaGVkTGltaXQgPSB0cnVlO1xuICAgICAgdXNlZExlbmd0aCA9IG1heExlbmd0aDtcbiAgICB9XG5cbiAgICB0aGlzLnJlbW92ZUVtcHR5Tm9kZXMoY29udGFpbmVyRWwpO1xuICB9XG5cbiAgcHJpdmF0ZSByZW1vdmVFbXB0eU5vZGVzKHJvb3RFbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb25zdCBjaGlsZE5vZGVzID0gQXJyYXkuZnJvbShyb290RWwuY2hpbGROb2Rlcyk7XG5cbiAgICBmb3IgKGNvbnN0IGNoaWxkTm9kZSBvZiBjaGlsZE5vZGVzKSB7XG4gICAgICBpZiAoY2hpbGROb2RlLm5vZGVUeXBlID09PSBOb2RlLlRFWFRfTk9ERSkge1xuICAgICAgICBpZiAoIShjaGlsZE5vZGUudGV4dENvbnRlbnQgPz8gXCJcIikudHJpbSgpKSB7XG4gICAgICAgICAgY2hpbGROb2RlLnJlbW92ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2hpbGROb2RlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVFbXB0eU5vZGVzKGNoaWxkTm9kZSk7XG4gICAgICAgIGNvbnN0IGhhc01lYW5pbmdmdWxUZXh0ID0gKGNoaWxkTm9kZS50ZXh0Q29udGVudCA/PyBcIlwiKS50cmltKCkubGVuZ3RoID4gMDtcbiAgICAgICAgY29uc3QgaGFzRWxlbWVudENoaWxkcmVuID0gY2hpbGROb2RlLmNoaWxkcmVuLmxlbmd0aCA+IDA7XG4gICAgICAgIGlmICghaGFzTWVhbmluZ2Z1bFRleHQgJiYgIWhhc0VsZW1lbnRDaGlsZHJlbikge1xuICAgICAgICAgIGNoaWxkTm9kZS5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUaW1lclNpZGViYXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBwcml2YXRlIHN0b3JhZ2U6IFRpbWVyU3RvcmFnZURhdGEgPSB7IHZlcnNpb246IFNUT1JBR0VfVkVSU0lPTiwgdGltZXJzOiB7fSB9O1xuICBwcml2YXRlIHNhdmVIYW5kbGU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnN0b3JhZ2UgPSB0aGlzLm5vcm1hbGl6ZVN0b3JhZ2VEYXRhKGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XG4gICAgaWYgKHRoaXMucHJ1bmVPbGRUaW1lcnMoKSkge1xuICAgICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnN0b3JhZ2UpO1xuICAgIH1cblxuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFZJRVdfVFlQRV9USU1FUl9TSURFQkFSLCAobGVhZikgPT4gbmV3IFRpbWVyU2lkZWJhclZpZXcobGVhZiwgdGhpcykpO1xuXG4gICAgdGhpcy5hZGRSaWJib25JY29uKFwidGltZXJcIiwgXCJPcGVuIEpXIFRpbWVyIHNpZGViYXJcIiwgKCkgPT4ge1xuICAgICAgdm9pZCB0aGlzLmFjdGl2YXRlVmlldygpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm9wZW4tanctdGltZXItc2lkZWJhclwiLFxuICAgICAgbmFtZTogXCJPcGVuIEpXIFRpbWVyIHNpZGViYXJcIixcbiAgICAgIGNhbGxiYWNrOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMuYWN0aXZhdGVWaWV3KCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB7XG4gICAgICB2b2lkIHRoaXMuYWN0aXZhdGVWaWV3KCk7XG4gICAgfSk7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zYXZlSGFuZGxlICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuc2F2ZUhhbmRsZSk7XG4gICAgICB0aGlzLnNhdmVIYW5kbGUgPSBudWxsO1xuICAgICAgdm9pZCB0aGlzLnNhdmVEYXRhKHRoaXMuc3RvcmFnZSk7XG4gICAgfVxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoVklFV19UWVBFX1RJTUVSX1NJREVCQVIpO1xuICB9XG5cbiAgZ2V0U3RvcmVkVGltZXIoaWQ6IHN0cmluZyk6IFN0b3JlZFRpbWVyU3RhdGUgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLnN0b3JhZ2UudGltZXJzW2lkXTtcbiAgfVxuXG4gIGdldERlbGV0ZWRUaW1lcklkc0ZvckZpbGUoZmlsZVBhdGg6IHN0cmluZyk6IFNldDxzdHJpbmc+IHtcbiAgICBjb25zdCBkZWxldGVkSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgcHJlZml4ID0gYCR7ZmlsZVBhdGh9OjpgO1xuXG4gICAgZm9yIChjb25zdCBbaWQsIHN0YXRlXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLnN0b3JhZ2UudGltZXJzKSkge1xuICAgICAgaWYgKGlkLnN0YXJ0c1dpdGgocHJlZml4KSAmJiBzdGF0ZS5kZWxldGVkKSB7XG4gICAgICAgIGRlbGV0ZWRJZHMuYWRkKGlkKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZGVsZXRlZElkcztcbiAgfVxuXG4gIGFzeW5jIHVwc2VydFN0b3JlZFRpbWVyKFxuICAgIGlkOiBzdHJpbmcsXG4gICAgc3RhdGU6IHsgdGl0bGU6IHN0cmluZzsgZWxhcHNlZE1zOiBudW1iZXI7IHRhcmdldE1zOiBudW1iZXIgfCBudWxsOyBkZWxldGVkOiBib29sZWFuIH1cbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5zdG9yYWdlLnRpbWVyc1tpZF0gPSB7XG4gICAgICB0aXRsZTogc3RhdGUudGl0bGUsXG4gICAgICBlbGFwc2VkTXM6IE1hdGgubWF4KDAsIE1hdGguZmxvb3Ioc3RhdGUuZWxhcHNlZE1zKSksXG4gICAgICB0YXJnZXRNczogc3RhdGUudGFyZ2V0TXMsXG4gICAgICBkZWxldGVkOiBzdGF0ZS5kZWxldGVkLFxuICAgICAgdXBkYXRlZEF0OiBEYXRlLm5vdygpXG4gICAgfTtcblxuICAgIHRoaXMuc2NoZWR1bGVTYXZlKCk7XG4gIH1cblxuICBhc3luYyBtYXJrVGltZXJEZWxldGVkKGlkOiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIHRhcmdldE1zOiBudW1iZXIgfCBudWxsLCBlbGFwc2VkTXM6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc3RvcmFnZS50aW1lcnNbaWRdID0ge1xuICAgICAgdGl0bGUsXG4gICAgICBlbGFwc2VkTXM6IE1hdGgubWF4KDAsIE1hdGguZmxvb3IoZWxhcHNlZE1zKSksXG4gICAgICB0YXJnZXRNcyxcbiAgICAgIGRlbGV0ZWQ6IHRydWUsXG4gICAgICB1cGRhdGVkQXQ6IERhdGUubm93KClcbiAgICB9O1xuXG4gICAgdGhpcy5zY2hlZHVsZVNhdmUoKTtcbiAgfVxuXG4gIGFzeW5jIHJlbW92ZVN0b3JlZFRpbWVyKGlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIShpZCBpbiB0aGlzLnN0b3JhZ2UudGltZXJzKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGRlbGV0ZSB0aGlzLnN0b3JhZ2UudGltZXJzW2lkXTtcbiAgICB0aGlzLnNjaGVkdWxlU2F2ZSgpO1xuICB9XG5cbiAgYXN5bmMgY2xlYXJGaWxlVGltZXJzKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBwcmVmaXggPSBgJHtmaWxlUGF0aH06OmA7XG4gICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcblxuICAgIGZvciAoY29uc3QgaWQgb2YgT2JqZWN0LmtleXModGhpcy5zdG9yYWdlLnRpbWVycykpIHtcbiAgICAgIGlmIChpZC5zdGFydHNXaXRoKHByZWZpeCkpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RvcmFnZS50aW1lcnNbaWRdO1xuICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgdGhpcy5zY2hlZHVsZVNhdmUoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG5vcm1hbGl6ZVN0b3JhZ2VEYXRhKHJhdzogdW5rbm93bik6IFRpbWVyU3RvcmFnZURhdGEge1xuICAgIGNvbnN0IGZhbGxiYWNrOiBUaW1lclN0b3JhZ2VEYXRhID0geyB2ZXJzaW9uOiBTVE9SQUdFX1ZFUlNJT04sIHRpbWVyczoge30gfTtcbiAgICBpZiAoIXJhdyB8fCB0eXBlb2YgcmF3ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICByZXR1cm4gZmFsbGJhY2s7XG4gICAgfVxuXG4gICAgY29uc3QgbWF5YmVEYXRhID0gcmF3IGFzIFBhcnRpYWw8VGltZXJTdG9yYWdlRGF0YT47XG4gICAgaWYgKCFtYXliZURhdGEudGltZXJzIHx8IHR5cGVvZiBtYXliZURhdGEudGltZXJzICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICByZXR1cm4gZmFsbGJhY2s7XG4gICAgfVxuXG4gICAgY29uc3Qgbm9ybWFsaXplZFRpbWVyczogUmVjb3JkPHN0cmluZywgU3RvcmVkVGltZXJTdGF0ZT4gPSB7fTtcbiAgICBmb3IgKGNvbnN0IFtpZCwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKG1heWJlRGF0YS50aW1lcnMpKSB7XG4gICAgICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdGltZXIgPSB2YWx1ZSBhcyBQYXJ0aWFsPFN0b3JlZFRpbWVyU3RhdGU+O1xuICAgICAgbm9ybWFsaXplZFRpbWVyc1tpZF0gPSB7XG4gICAgICAgIHRpdGxlOiB0eXBlb2YgdGltZXIudGl0bGUgPT09IFwic3RyaW5nXCIgPyB0aW1lci50aXRsZSA6IFwiXCIsXG4gICAgICAgIGVsYXBzZWRNczogTnVtYmVyLmlzRmluaXRlKHRpbWVyLmVsYXBzZWRNcykgPyBNYXRoLm1heCgwLCBNYXRoLmZsb29yKHRpbWVyLmVsYXBzZWRNcyA/PyAwKSkgOiAwLFxuICAgICAgICB0YXJnZXRNczpcbiAgICAgICAgICB0aW1lci50YXJnZXRNcyA9PT0gbnVsbCB8fCB0aW1lci50YXJnZXRNcyA9PT0gdW5kZWZpbmVkXG4gICAgICAgICAgICA/IG51bGxcbiAgICAgICAgICAgIDogTnVtYmVyLmlzRmluaXRlKHRpbWVyLnRhcmdldE1zKVxuICAgICAgICAgICAgICA/IE1hdGgubWF4KDAsIE1hdGguZmxvb3IodGltZXIudGFyZ2V0TXMpKVxuICAgICAgICAgICAgICA6IG51bGwsXG4gICAgICAgIGRlbGV0ZWQ6IEJvb2xlYW4odGltZXIuZGVsZXRlZCksXG4gICAgICAgIHVwZGF0ZWRBdDpcbiAgICAgICAgICBOdW1iZXIuaXNGaW5pdGUodGltZXIudXBkYXRlZEF0KSAmJiAodGltZXIudXBkYXRlZEF0ID8/IDApID4gMFxuICAgICAgICAgICAgPyBNYXRoLmZsb29yKHRpbWVyLnVwZGF0ZWRBdCBhcyBudW1iZXIpXG4gICAgICAgICAgICA6IERhdGUubm93KClcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHZlcnNpb246IFNUT1JBR0VfVkVSU0lPTixcbiAgICAgIHRpbWVyczogbm9ybWFsaXplZFRpbWVyc1xuICAgIH07XG4gIH1cblxuICBwcml2YXRlIHBydW5lT2xkVGltZXJzKCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcblxuICAgIGZvciAoY29uc3QgW2lkLCB0aW1lcl0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5zdG9yYWdlLnRpbWVycykpIHtcbiAgICAgIGlmIChub3cgLSB0aW1lci51cGRhdGVkQXQgPiBUSU1FUl9SRVRFTlRJT05fTVMpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RvcmFnZS50aW1lcnNbaWRdO1xuICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY2hhbmdlZDtcbiAgfVxuXG4gIHByaXZhdGUgc2NoZWR1bGVTYXZlKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnBydW5lT2xkVGltZXJzKCkpIHtcbiAgICAgIC8vIEtlZXAgc3RvcmFnZSBib3VuZGVkIGJlZm9yZSBwZXJzaXN0aW5nIHRvIGRpc2suXG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc2F2ZUhhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnNhdmVIYW5kbGUpO1xuICAgIH1cblxuICAgIHRoaXMuc2F2ZUhhbmRsZSA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuc2F2ZUhhbmRsZSA9IG51bGw7XG4gICAgICB2b2lkIHRoaXMuc2F2ZURhdGEodGhpcy5zdG9yYWdlKTtcbiAgICB9LCA0MDApO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBhY3RpdmF0ZVZpZXcoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZXhpc3RpbmdMZWF2ZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9USU1FUl9TSURFQkFSKTtcbiAgICBpZiAoZXhpc3RpbmdMZWF2ZXMubGVuZ3RoID4gMCkge1xuICAgICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYoZXhpc3RpbmdMZWF2ZXNbMF0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKTtcbiAgICBpZiAoIWxlYWYpIHJldHVybjtcblxuICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHtcbiAgICAgIHR5cGU6IFZJRVdfVFlQRV9USU1FUl9TSURFQkFSLFxuICAgICAgYWN0aXZlOiB0cnVlXG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBT087QUFFUCxJQUFNLDBCQUEwQjtBQUNoQyxJQUFNLGtCQUFrQjtBQUN4QixJQUFNLHFCQUFxQixLQUFLLEtBQUssS0FBSyxLQUFLO0FBRS9DLElBQU0sVUFBVTtBQUFBLEVBQ2QsT0FBTztBQUFBLEVBQ1AsT0FBTztBQUFBLEVBQ1AsTUFBTTtBQUFBLEVBQ04sT0FBTztBQUFBLEVBQ1AsT0FBTztBQUFBLEVBQ1AsUUFBUTtBQUFBLEVBQ1IsVUFBVTtBQUNaO0FBOEJBLFNBQVMsYUFBYSxVQUFrQixTQUErQjtBQUNyRSxRQUFNLE9BQU8sUUFBUSxVQUFVLE1BQU0sUUFBUTtBQUM3QyxTQUFPLEdBQUcsUUFBUSxLQUFLLElBQUksS0FBSyxRQUFRLE9BQU87QUFDakQ7QUFFQSxTQUFTLGVBQWUsSUFBb0I7QUFDMUMsUUFBTSxlQUFlLEtBQUssSUFBSSxHQUFHLEtBQUssTUFBTSxLQUFLLEdBQUksQ0FBQztBQUN0RCxRQUFNLFFBQVEsS0FBSyxNQUFNLGVBQWUsSUFBSTtBQUM1QyxRQUFNLFVBQVUsS0FBSyxNQUFPLGVBQWUsT0FBUSxFQUFFO0FBQ3JELFFBQU0sVUFBVSxlQUFlO0FBRS9CLFNBQU8sR0FBRyxPQUFPLEtBQUssRUFBRSxTQUFTLEdBQUcsR0FBRyxDQUFDLElBQUksT0FBTyxPQUFPLEVBQUUsU0FBUyxHQUFHLEdBQUcsQ0FBQyxJQUFJLE9BQU8sT0FBTyxFQUFFLFNBQVMsR0FBRyxHQUFHLENBQUM7QUFDbEg7QUFFQSxJQUFNLG9CQUFOLE1BQU0sMEJBQXlCLHlCQUFTO0FBQUEsRUFhdEMsWUFBWSxNQUFzQyxRQUE0QjtBQUM1RSxVQUFN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
