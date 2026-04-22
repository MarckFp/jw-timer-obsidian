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
var TimerSidebarView = class extends import_obsidian.ItemView {
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
    new TargetTimeModal(this.app, entry.targetMs, (newTargetMs) => {
      entry.targetMs = newTargetMs;
      this.persistTimer(entry);
      this.updateTimerDisplays();
    }).open();
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
};
TimerSidebarView.TITLE_MAX_LENGTH = 60;
var TargetTimeModal = class extends import_obsidian.Modal {
  constructor(app, currentTargetMs, onSubmit) {
    super(app);
    this.currentTargetMs = currentTargetMs;
    this.onSubmit = onSubmit;
    this.inputValue = currentTargetMs === null ? "" : (currentTargetMs / 6e4).toString();
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Set target time" });
    new import_obsidian.Setting(contentEl).setName("Target (minutes)").setDesc("Leave empty to remove the target. Decimals allowed (e.g. 1.5 = 1 min 30 s).").addText((text) => {
      text.setValue(this.inputValue);
      text.inputEl.setAttribute("type", "number");
      text.inputEl.setAttribute("min", "0");
      text.inputEl.setAttribute("step", "0.5");
      text.inputEl.style.width = "6rem";
      text.onChange((value) => {
        this.inputValue = value;
      });
      text.inputEl.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") {
          this.submit();
        }
      });
      window.setTimeout(() => text.inputEl.focus(), 50);
    });
    const btnRow = contentEl.createDiv({ cls: "modal-button-container" });
    btnRow.createEl("button", { text: "Clear target", cls: "mod-warning" }).addEventListener("click", () => {
      this.onSubmit(null);
      this.close();
    });
    btnRow.createEl("button", { text: "Save", cls: "mod-cta" }).addEventListener("click", () => {
      this.submit();
    });
  }
  submit() {
    const normalized = this.inputValue.trim().replace(",", ".");
    if (!normalized) {
      this.onSubmit(null);
      this.close();
      return;
    }
    const minutes = Number(normalized);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      const errorEl = this.contentEl.querySelector(".jw-target-error") ?? (() => {
        const el = this.contentEl.createEl("p", { cls: "jw-target-error" });
        el.style.color = "var(--color-red)";
        return el;
      })();
      errorEl.setText("Enter a positive number of minutes.");
      return;
    }
    this.onSubmit(Math.round(minutes * 60 * 1e3));
    this.close();
  }
  onClose() {
    this.contentEl.empty();
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
    if (plain.length > TimerSidebarView.TITLE_MAX_LENGTH) {
      this.truncateRenderedContent(renderedEl, TimerSidebarView.TITLE_MAX_LENGTH);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcbiAgQXBwLFxuICBJdGVtVmlldyxcbiAgTWFya2Rvd25SZW5kZXJlcixcbiAgTW9kYWwsXG4gIFBsdWdpbixcbiAgU2V0dGluZyxcbiAgV29ya3NwYWNlTGVhZixcbiAgSGVhZGluZ0NhY2hlXG59IGZyb20gXCJvYnNpZGlhblwiO1xuXG5jb25zdCBWSUVXX1RZUEVfVElNRVJfU0lERUJBUiA9IFwianctdGltZXItc2lkZWJhci12aWV3XCI7XG5jb25zdCBTVE9SQUdFX1ZFUlNJT04gPSAxO1xuY29uc3QgVElNRVJfUkVURU5USU9OX01TID0gMzAgKiAyNCAqIDYwICogNjAgKiAxMDAwO1xuXG5jb25zdCBVSV9URVhUID0ge1xuICB0aXRsZTogXCJcdTIzRjFcdUZFMEZcIixcbiAgZW1wdHk6IFwiXHUyMjA1XCIsXG4gIG9wZW46IFwiXHUyNUI2XHVGRTBGXCIsXG4gIHBhdXNlOiBcIlx1MjNGOFx1RkUwRlwiLFxuICB0YXJnZXQ6IFwiXHVEODNDXHVERkFGXCIsXG4gIHJlc2V0OiBcIlx1RDgzRFx1REQwNFwiLFxuICBkZWxldGU6IFwiXHVEODNEXHVEREQxXHVGRTBGXCIsXG4gIHJlc2V0QWxsOiBcIlx1MjY3Qlx1RkUwRlwiXG59IGFzIGNvbnN0O1xuXG5pbnRlcmZhY2UgVGltZXJFbnRyeSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGVsYXBzZWRNczogbnVtYmVyO1xuICB0YXJnZXRNczogbnVtYmVyIHwgbnVsbDtcbiAgcnVubmluZzogYm9vbGVhbjtcbiAgc3RhcnRlZEF0OiBudW1iZXIgfCBudWxsO1xufVxuXG5pbnRlcmZhY2UgVGltZXJVaVJlZiB7XG4gIGNhcmRFbDogSFRNTEVsZW1lbnQ7XG4gIHRpbWVyRWw6IEhUTUxFbGVtZW50O1xuICBwbGF5U3RvcEJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHRhcmdldEJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHJlc2V0QnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbn1cblxuaW50ZXJmYWNlIFN0b3JlZFRpbWVyU3RhdGUge1xuICB0aXRsZTogc3RyaW5nO1xuICBlbGFwc2VkTXM6IG51bWJlcjtcbiAgdGFyZ2V0TXM6IG51bWJlciB8IG51bGw7XG4gIGRlbGV0ZWQ6IGJvb2xlYW47XG4gIHVwZGF0ZWRBdDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgVGltZXJTdG9yYWdlRGF0YSB7XG4gIHZlcnNpb246IG51bWJlcjtcbiAgdGltZXJzOiBSZWNvcmQ8c3RyaW5nLCBTdG9yZWRUaW1lclN0YXRlPjtcbn1cblxuZnVuY3Rpb24gYnVpbGRUaW1lcklkKGZpbGVQYXRoOiBzdHJpbmcsIGhlYWRpbmc6IEhlYWRpbmdDYWNoZSk6IHN0cmluZyB7XG4gIGNvbnN0IGxpbmUgPSBoZWFkaW5nLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IDA7XG4gIHJldHVybiBgJHtmaWxlUGF0aH06OiR7bGluZX06OiR7aGVhZGluZy5oZWFkaW5nfWA7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdER1cmF0aW9uKG1zOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCB0b3RhbFNlY29uZHMgPSBNYXRoLm1heCgwLCBNYXRoLmZsb29yKG1zIC8gMTAwMCkpO1xuICBjb25zdCBob3VycyA9IE1hdGguZmxvb3IodG90YWxTZWNvbmRzIC8gMzYwMCk7XG4gIGNvbnN0IG1pbnV0ZXMgPSBNYXRoLmZsb29yKCh0b3RhbFNlY29uZHMgJSAzNjAwKSAvIDYwKTtcbiAgY29uc3Qgc2Vjb25kcyA9IHRvdGFsU2Vjb25kcyAlIDYwO1xuXG4gIHJldHVybiBgJHtTdHJpbmcoaG91cnMpLnBhZFN0YXJ0KDIsIFwiMFwiKX06JHtTdHJpbmcobWludXRlcykucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhzZWNvbmRzKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbn1cblxuY2xhc3MgVGltZXJTaWRlYmFyVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgcHJpdmF0ZSB0aW1lcnMgPSBuZXcgTWFwPHN0cmluZywgVGltZXJFbnRyeT4oKTtcbiAgcHJpdmF0ZSBkZWxldGVkVGltZXJJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcHJpdmF0ZSB0aW1lclVpUmVmcyA9IG5ldyBNYXA8c3RyaW5nLCBUaW1lclVpUmVmPigpO1xuICBwcml2YXRlIGN1cnJlbnRIZWFkaW5nSWRzOiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIGN1cnJlbnRGaWxlUGF0aDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbiAgcHJpdmF0ZSBsaXN0RWwhOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBlbXB0eVN0YXRlRWwhOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSB0aWNrSGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBwZXJzaXN0SGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgVElUTEVfTUFYX0xFTkdUSCA9IDYwO1xuXG4gIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHByaXZhdGUgcmVhZG9ubHkgcGx1Z2luOiBUaW1lclNpZGViYXJQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIFZJRVdfVFlQRV9USU1FUl9TSURFQkFSO1xuICB9XG5cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gXCJKVyBUaW1lcnNcIjtcbiAgfVxuXG4gIGdldEljb24oKTogc3RyaW5nIHtcbiAgICByZXR1cm4gXCJ0aW1lclwiO1xuICB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG4gICAgdGhpcy5jb250ZW50RWwuYWRkQ2xhc3MoXCJqdy10aW1lci1zaWRlYmFyLXJvb3RcIik7XG5cbiAgICBjb25zdCB3cmFwcGVyID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLXdyYXBwZXJcIiB9KTtcblxuICAgIGNvbnN0IHRpdGxlRWwgPSB3cmFwcGVyLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBVSV9URVhULnRpdGxlLCBjbHM6IFwianctdGltZXItdGl0bGVcIiB9KTtcbiAgICB0aXRsZUVsLnNldEF0dHIoXCJhcmlhLWxpdmVcIiwgXCJwb2xpdGVcIik7XG4gICAgdGl0bGVFbC5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIlRpbWVycyBieSBoZWFkaW5nXCIpO1xuXG4gICAgdGhpcy5saXN0RWwgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1saXN0XCIgfSk7XG4gICAgdGhpcy5lbXB0eVN0YXRlRWwgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1lbXB0eVwiIH0pO1xuXG4gICAgY29uc3QgZm9vdGVyRWwgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1mb290ZXJcIiB9KTtcbiAgICBjb25zdCBkZWxldGVBbGxCdG4gPSBmb290ZXJFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICB0ZXh0OiBVSV9URVhULnJlc2V0QWxsLFxuICAgICAgY2xzOiBcImp3LXRpbWVyLWJ0biBqdy10aW1lci1idG4tZGFuZ2VyXCJcbiAgICB9KTtcbiAgICBkZWxldGVBbGxCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJSZXNldCBhbGwgdGltZXJzXCIpO1xuICAgIGRlbGV0ZUFsbEJ0bi5zZXRBdHRyKFwidGl0bGVcIiwgXCJSZXNldCBhbGwgdGltZXJzXCIpO1xuXG4gICAgZGVsZXRlQWxsQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBpZiAodGhpcy5jb25maXJtQWN0aW9uKFwiUmVzZXQgYWxsIHRpbWVycz9cIikpIHtcbiAgICAgICAgdGhpcy5kZWxldGVBbGxUaW1lcnMoKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJhY3RpdmUtbGVhZi1jaGFuZ2VcIiwgKCkgPT4gdm9pZCB0aGlzLnJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpKSk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLm9uKFwiY2hhbmdlZFwiLCAoZmlsZSkgPT4ge1xuICAgICAgICBpZiAoZmlsZS5wYXRoID09PSB0aGlzLmN1cnJlbnRGaWxlUGF0aCkge1xuICAgICAgICAgIHZvaWQgdGhpcy5yZWZyZXNoRnJvbUFjdGl2ZUZpbGUoKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICApO1xuXG4gICAgdGhpcy50aWNrSGFuZGxlID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICAgIH0sIDI1MCk7XG5cbiAgICB0aGlzLnBlcnNpc3RIYW5kbGUgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgdGhpcy5wZXJzaXN0UnVubmluZ1NuYXBzaG90cygpO1xuICAgIH0sIDUwMDApO1xuXG4gICAgdm9pZCB0aGlzLnJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpO1xuICB9XG5cbiAgYXN5bmMgb25DbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy50aWNrSGFuZGxlICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLnRpY2tIYW5kbGUpO1xuICAgICAgdGhpcy50aWNrSGFuZGxlID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMucGVyc2lzdEhhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy5wZXJzaXN0SGFuZGxlKTtcbiAgICAgIHRoaXMucGVyc2lzdEhhbmRsZSA9IG51bGw7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5wZXJzaXN0QWxsVGltZXJzKHRydWUpO1xuXG4gICAgdGhpcy5jb250ZW50RWwucmVtb3ZlQ2xhc3MoXCJqdy10aW1lci1zaWRlYmFyLXJvb3RcIik7XG4gICAgdGhpcy50aW1lclVpUmVmcy5jbGVhcigpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZWZyZXNoRnJvbUFjdGl2ZUZpbGUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cbiAgICBpZiAoIWFjdGl2ZUZpbGUpIHtcbiAgICAgIHRoaXMuY3VycmVudEZpbGVQYXRoID0gbnVsbDtcbiAgICAgIHRoaXMuY3VycmVudEhlYWRpbmdJZHMgPSBbXTtcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyTGlzdCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuY3VycmVudEZpbGVQYXRoID0gYWN0aXZlRmlsZS5wYXRoO1xuICAgIGNvbnN0IGZpbGVDb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChhY3RpdmVGaWxlKTtcbiAgICBjb25zdCBmaWxlQ2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShhY3RpdmVGaWxlKTtcbiAgICBjb25zdCBoZWFkaW5ncyA9IChmaWxlQ2FjaGU/LmhlYWRpbmdzID8/IFtdKS5zbGljZSgpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGNvbnN0IGxpbmVBID0gYS5wb3NpdGlvbj8uc3RhcnQubGluZSA/PyAwO1xuICAgICAgY29uc3QgbGluZUIgPSBiLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IDA7XG4gICAgICByZXR1cm4gbGluZUEgLSBsaW5lQjtcbiAgICB9KTtcbiAgICBjb25zdCByYXdIZWFkaW5nVGl0bGVzID0gdGhpcy5leHRyYWN0UmF3SGVhZGluZ1RpdGxlcyhmaWxlQ29udGVudCwgaGVhZGluZ3MpO1xuICAgIHRoaXMuZGVsZXRlZFRpbWVySWRzID0gdGhpcy5wbHVnaW4uZ2V0RGVsZXRlZFRpbWVySWRzRm9yRmlsZShhY3RpdmVGaWxlLnBhdGgpO1xuXG4gICAgY29uc3QgbmV4dEhlYWRpbmdJZHM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgYWxsSGVhZGluZ0lkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgZm9yIChjb25zdCBoZWFkaW5nIG9mIGhlYWRpbmdzKSB7XG4gICAgICBjb25zdCBpZCA9IGJ1aWxkVGltZXJJZChhY3RpdmVGaWxlLnBhdGgsIGhlYWRpbmcpO1xuICAgICAgYWxsSGVhZGluZ0lkcy5hZGQoaWQpO1xuICAgICAgaWYgKHRoaXMuZGVsZXRlZFRpbWVySWRzLmhhcyhpZCkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGhlYWRpbmdMaW5lID0gaGVhZGluZy5wb3NpdGlvbj8uc3RhcnQubGluZSA/PyAwO1xuICAgICAgY29uc3QgaGVhZGluZ1RpdGxlID0gcmF3SGVhZGluZ1RpdGxlcy5nZXQoaGVhZGluZ0xpbmUpID8/IGhlYWRpbmcuaGVhZGluZztcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICAgIGNvbnN0IHN0b3JlZCA9IHRoaXMucGx1Z2luLmdldFN0b3JlZFRpbWVyKGlkKTtcblxuICAgICAgaWYgKCFleGlzdGluZykge1xuICAgICAgICB0aGlzLnRpbWVycy5zZXQoaWQsIHtcbiAgICAgICAgICBpZCxcbiAgICAgICAgICB0aXRsZTogaGVhZGluZ1RpdGxlLFxuICAgICAgICAgIGVsYXBzZWRNczogc3RvcmVkPy5lbGFwc2VkTXMgPz8gMCxcbiAgICAgICAgICB0YXJnZXRNczogc3RvcmVkPy50YXJnZXRNcyA/PyBudWxsLFxuICAgICAgICAgIHJ1bm5pbmc6IGZhbHNlLFxuICAgICAgICAgIHN0YXJ0ZWRBdDogbnVsbFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGV4aXN0aW5nLnRpdGxlID0gaGVhZGluZ1RpdGxlO1xuICAgICAgICBpZiAoZXhpc3RpbmcudGFyZ2V0TXMgPT09IG51bGwgJiYgc3RvcmVkPy50YXJnZXRNcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZXhpc3RpbmcudGFyZ2V0TXMgPSBzdG9yZWQudGFyZ2V0TXM7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbmV4dEhlYWRpbmdJZHMucHVzaChpZCk7XG4gICAgfVxuXG4gICAgY29uc3QgbmV4dElkc1NldCA9IG5ldyBTZXQobmV4dEhlYWRpbmdJZHMpO1xuICAgIGZvciAoY29uc3QgZXhpc3RpbmdJZCBvZiBbLi4udGhpcy50aW1lcnMua2V5cygpXSkge1xuICAgICAgaWYgKGV4aXN0aW5nSWQuc3RhcnRzV2l0aChgJHthY3RpdmVGaWxlLnBhdGh9OjpgKSAmJiAhbmV4dElkc1NldC5oYXMoZXhpc3RpbmdJZCkpIHtcbiAgICAgICAgdGhpcy50aW1lcnMuZGVsZXRlKGV4aXN0aW5nSWQpO1xuICAgICAgICB2b2lkIHRoaXMucGx1Z2luLnJlbW92ZVN0b3JlZFRpbWVyKGV4aXN0aW5nSWQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3QgZGVsZXRlZElkIG9mIFsuLi50aGlzLmRlbGV0ZWRUaW1lcklkc10pIHtcbiAgICAgIGlmIChkZWxldGVkSWQuc3RhcnRzV2l0aChgJHthY3RpdmVGaWxlLnBhdGh9OjpgKSAmJiAhYWxsSGVhZGluZ0lkcy5oYXMoZGVsZXRlZElkKSkge1xuICAgICAgICB0aGlzLmRlbGV0ZWRUaW1lcklkcy5kZWxldGUoZGVsZXRlZElkKTtcbiAgICAgICAgdm9pZCB0aGlzLnBsdWdpbi5yZW1vdmVTdG9yZWRUaW1lcihkZWxldGVkSWQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuY3VycmVudEhlYWRpbmdJZHMgPSBuZXh0SGVhZGluZ0lkcztcblxuICAgIGZvciAoY29uc3QgaWQgb2YgbmV4dEhlYWRpbmdJZHMpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICAgIGlmIChlbnRyeSkge1xuICAgICAgICB0aGlzLnBlcnNpc3RUaW1lcihlbnRyeSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5yZW5kZXJMaXN0KCk7XG4gIH1cblxuICBwcml2YXRlIGV4dHJhY3RSYXdIZWFkaW5nVGl0bGVzKGNvbnRlbnQ6IHN0cmluZywgaGVhZGluZ3M6IEhlYWRpbmdDYWNoZVtdKTogTWFwPG51bWJlciwgc3RyaW5nPiB7XG4gICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KC9cXHI/XFxuLyk7XG4gICAgY29uc3QgdGl0bGVzQnlMaW5lID0gbmV3IE1hcDxudW1iZXIsIHN0cmluZz4oKTtcblxuICAgIGZvciAoY29uc3QgaGVhZGluZyBvZiBoZWFkaW5ncykge1xuICAgICAgY29uc3QgbGluZUluZGV4ID0gaGVhZGluZy5wb3NpdGlvbj8uc3RhcnQubGluZSA/PyAtMTtcbiAgICAgIGlmIChsaW5lSW5kZXggPCAwIHx8IGxpbmVJbmRleCA+PSBsaW5lcy5sZW5ndGgpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBsaW5lID0gbGluZXNbbGluZUluZGV4XTtcbiAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXlxcc3swLDN9I3sxLDZ9XFxzKyguKikkLyk7XG4gICAgICBpZiAoIW1hdGNoKSBjb250aW51ZTtcblxuICAgICAgY29uc3QgcmF3ID0gbWF0Y2hbMV0ucmVwbGFjZSgvXFxzKyMrXFxzKiQvLCBcIlwiKS50cmltKCk7XG4gICAgICB0aXRsZXNCeUxpbmUuc2V0KGxpbmVJbmRleCwgcmF3Lmxlbmd0aCA+IDAgPyByYXcgOiBoZWFkaW5nLmhlYWRpbmcpO1xuICAgIH1cblxuICAgIHJldHVybiB0aXRsZXNCeUxpbmU7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckxpc3QoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5saXN0RWwuZW1wdHkoKTtcbiAgICB0aGlzLnRpbWVyVWlSZWZzLmNsZWFyKCk7XG5cbiAgICBpZiAodGhpcy5jdXJyZW50SGVhZGluZ0lkcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuZW1wdHlTdGF0ZUVsLnNldFRleHQoVUlfVEVYVC5lbXB0eSk7XG4gICAgICB0aGlzLmVtcHR5U3RhdGVFbC5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIk5vIGhlYWRlcnMgZm91bmQgaW4gdGhlIGN1cnJlbnQgbm90ZVwiKTtcbiAgICAgIHRoaXMuZW1wdHlTdGF0ZUVsLnNob3coKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmVtcHR5U3RhdGVFbC5oaWRlKCk7XG5cbiAgICBmb3IgKGNvbnN0IGlkIG9mIHRoaXMuY3VycmVudEhlYWRpbmdJZHMpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICAgIGlmICghZW50cnkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBjYXJkID0gdGhpcy5saXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNhcmRcIiB9KTtcbiAgICAgIGNvbnN0IHRpdGxlRWwgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jYXJkLXRpdGxlXCIgfSk7XG4gICAgICBhd2FpdCB0aGlzLnJlbmRlclRpdGxlQ29udGVudCh0aXRsZUVsLCBlbnRyeS50aXRsZSk7XG5cbiAgICAgIGNvbnN0IHRpbWVyRWwgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jbG9ja1wiLCB0ZXh0OiBmb3JtYXREdXJhdGlvbih0aGlzLmdldEVsYXBzZWQoZW50cnkpKSB9KTtcblxuICAgICAgY29uc3QgY29udHJvbHMgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jb250cm9sc1wiIH0pO1xuXG4gICAgICBjb25zdCBwbGF5U3RvcEJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgICAgY2xzOiBcImp3LXRpbWVyLWJ0blwiLFxuICAgICAgICB0ZXh0OiBlbnRyeS5ydW5uaW5nID8gVUlfVEVYVC5wYXVzZSA6IFVJX1RFWFQub3BlblxuICAgICAgfSk7XG4gICAgICBwbGF5U3RvcEJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBlbnRyeS5ydW5uaW5nID8gXCJQYXVzZSB0aW1lclwiIDogXCJTdGFydCB0aW1lclwiKTtcbiAgICAgIHBsYXlTdG9wQnRuLnNldEF0dHIoXCJ0aXRsZVwiLCBlbnRyeS5ydW5uaW5nID8gXCJQYXVzZSB0aW1lclwiIDogXCJTdGFydCB0aW1lclwiKTtcblxuICAgICAgY29uc3QgdGFyZ2V0QnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwianctdGltZXItYnRuXCIsXG4gICAgICAgIHRleHQ6IFVJX1RFWFQudGFyZ2V0XG4gICAgICB9KTtcbiAgICAgIHRhcmdldEJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIkNvbmZpZ3VyZSB0YXJnZXQgdGltZVwiKTtcblxuICAgICAgY29uc3QgcmVzZXRCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJqdy10aW1lci1idG5cIixcbiAgICAgICAgdGV4dDogVUlfVEVYVC5yZXNldFxuICAgICAgfSk7XG4gICAgICByZXNldEJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIlJlc2V0IHRpbWVyXCIpO1xuICAgICAgcmVzZXRCdG4uc2V0QXR0cihcInRpdGxlXCIsIFwiUmVzZXQgdGltZXJcIik7XG5cbiAgICAgIGNvbnN0IGRlbGV0ZUJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgICAgY2xzOiBcImp3LXRpbWVyLWJ0biBqdy10aW1lci1idG4tZGFuZ2VyXCIsXG4gICAgICAgIHRleHQ6IFVJX1RFWFQuZGVsZXRlXG4gICAgICB9KTtcbiAgICAgIGRlbGV0ZUJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIkRlbGV0ZSB0aW1lclwiKTtcbiAgICAgIGRlbGV0ZUJ0bi5zZXRBdHRyKFwidGl0bGVcIiwgXCJEZWxldGUgdGltZXJcIik7XG5cbiAgICAgIHBsYXlTdG9wQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIGlmIChlbnRyeS5ydW5uaW5nKSB7XG4gICAgICAgICAgdGhpcy5wYXVzZVRpbWVyKGVudHJ5LmlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnN0YXJ0VGltZXIoZW50cnkuaWQpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGFyZ2V0QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuY29uZmlndXJlVGFyZ2V0VGltZShlbnRyeS5pZCk7XG4gICAgICB9KTtcblxuICAgICAgcmVzZXRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgdGhpcy5yZXNldFRpbWVyKGVudHJ5LmlkKTtcbiAgICAgIH0pO1xuXG4gICAgICBkZWxldGVCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuY29uZmlybUFjdGlvbihcIkRlbGV0ZSB0aGlzIHRpbWVyP1wiKSkge1xuICAgICAgICAgIHRoaXMuZGVsZXRlVGltZXIoZW50cnkuaWQpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGhpcy50aW1lclVpUmVmcy5zZXQoZW50cnkuaWQsIHsgY2FyZEVsOiBjYXJkLCB0aW1lckVsLCBwbGF5U3RvcEJ0biwgdGFyZ2V0QnRuLCByZXNldEJ0biB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0RWxhcHNlZChlbnRyeTogVGltZXJFbnRyeSk6IG51bWJlciB7XG4gICAgaWYgKCFlbnRyeS5ydW5uaW5nIHx8IGVudHJ5LnN0YXJ0ZWRBdCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGVudHJ5LmVsYXBzZWRNcztcbiAgICB9XG5cbiAgICByZXR1cm4gZW50cnkuZWxhcHNlZE1zICsgKERhdGUubm93KCkgLSBlbnRyeS5zdGFydGVkQXQpO1xuICB9XG5cbiAgcHJpdmF0ZSBzdGFydFRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgaWYgKCFlbnRyeSB8fCBlbnRyeS5ydW5uaW5nKSByZXR1cm47XG5cbiAgICBlbnRyeS5ydW5uaW5nID0gdHJ1ZTtcbiAgICBlbnRyeS5zdGFydGVkQXQgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMucGVyc2lzdFRpbWVyKGVudHJ5KTtcbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgcGF1c2VUaW1lcihpZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgIGlmICghZW50cnkgfHwgIWVudHJ5LnJ1bm5pbmcpIHJldHVybjtcblxuICAgIGVudHJ5LmVsYXBzZWRNcyA9IHRoaXMuZ2V0RWxhcHNlZChlbnRyeSk7XG4gICAgZW50cnkucnVubmluZyA9IGZhbHNlO1xuICAgIGVudHJ5LnN0YXJ0ZWRBdCA9IG51bGw7XG4gICAgdGhpcy5wZXJzaXN0VGltZXIoZW50cnkpO1xuICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICB9XG5cbiAgcHJpdmF0ZSByZXNldFRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgaWYgKCFlbnRyeSkgcmV0dXJuO1xuXG4gICAgZW50cnkuZWxhcHNlZE1zID0gMDtcbiAgICBlbnRyeS5ydW5uaW5nID0gZmFsc2U7XG4gICAgZW50cnkuc3RhcnRlZEF0ID0gbnVsbDtcbiAgICB0aGlzLnBlcnNpc3RUaW1lcihlbnRyeSk7XG4gICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gIH1cblxuICBwcml2YXRlIGNvbmZpZ3VyZVRhcmdldFRpbWUoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICBpZiAoIWVudHJ5KSByZXR1cm47XG5cbiAgICBuZXcgVGFyZ2V0VGltZU1vZGFsKHRoaXMuYXBwLCBlbnRyeS50YXJnZXRNcywgKG5ld1RhcmdldE1zKSA9PiB7XG4gICAgICBlbnRyeS50YXJnZXRNcyA9IG5ld1RhcmdldE1zO1xuICAgICAgdGhpcy5wZXJzaXN0VGltZXIoZW50cnkpO1xuICAgICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG5cbiAgcHJpdmF0ZSBkZWxldGVUaW1lcihpZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgIHRoaXMuZGVsZXRlZFRpbWVySWRzLmFkZChpZCk7XG4gICAgdGhpcy50aW1lcnMuZGVsZXRlKGlkKTtcbiAgICB2b2lkIHRoaXMucGx1Z2luLm1hcmtUaW1lckRlbGV0ZWQoaWQsIGVudHJ5Py50aXRsZSA/PyBcIlwiLCBlbnRyeT8udGFyZ2V0TXMgPz8gbnVsbCwgZW50cnk/LmVsYXBzZWRNcyA/PyAwKTtcbiAgICB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzID0gdGhpcy5jdXJyZW50SGVhZGluZ0lkcy5maWx0ZXIoKGhlYWRpbmdJZCkgPT4gaGVhZGluZ0lkICE9PSBpZCk7XG4gICAgdm9pZCB0aGlzLnJlbmRlckxpc3QoKTtcbiAgfVxuXG4gIHByaXZhdGUgZGVsZXRlQWxsVGltZXJzKCk6IHZvaWQge1xuICAgIGNvbnN0IGZpbGVQYXRoID0gdGhpcy5jdXJyZW50RmlsZVBhdGg7XG4gICAgdGhpcy50aW1lcnMuY2xlYXIoKTtcbiAgICB0aGlzLmRlbGV0ZWRUaW1lcklkcy5jbGVhcigpO1xuICAgIGlmIChmaWxlUGF0aCkge1xuICAgICAgdm9pZCB0aGlzLnBsdWdpbi5jbGVhckZpbGVUaW1lcnMoZmlsZVBhdGgpO1xuICAgIH1cbiAgICB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCk7XG4gIH1cblxuICBwcml2YXRlIGNvbmZpcm1BY3Rpb24obWVzc2FnZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHdpbmRvdy5jb25maXJtKG1lc3NhZ2UpO1xuICB9XG59XG5cbmNsYXNzIFRhcmdldFRpbWVNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgcHJpdmF0ZSBpbnB1dFZhbHVlOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSByZWFkb25seSBjdXJyZW50VGFyZ2V0TXM6IG51bWJlciB8IG51bGwsXG4gICAgcHJpdmF0ZSByZWFkb25seSBvblN1Ym1pdDogKHRhcmdldE1zOiBudW1iZXIgfCBudWxsKSA9PiB2b2lkXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5pbnB1dFZhbHVlID0gY3VycmVudFRhcmdldE1zID09PSBudWxsID8gXCJcIiA6IChjdXJyZW50VGFyZ2V0TXMgLyA2MDAwMCkudG9TdHJpbmcoKTtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IFwiU2V0IHRhcmdldCB0aW1lXCIgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250ZW50RWwpXG4gICAgICAuc2V0TmFtZShcIlRhcmdldCAobWludXRlcylcIilcbiAgICAgIC5zZXREZXNjKFwiTGVhdmUgZW1wdHkgdG8gcmVtb3ZlIHRoZSB0YXJnZXQuIERlY2ltYWxzIGFsbG93ZWQgKGUuZy4gMS41ID0gMSBtaW4gMzAgcykuXCIpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT4ge1xuICAgICAgICB0ZXh0LnNldFZhbHVlKHRoaXMuaW5wdXRWYWx1ZSk7XG4gICAgICAgIHRleHQuaW5wdXRFbC5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsIFwibnVtYmVyXCIpO1xuICAgICAgICB0ZXh0LmlucHV0RWwuc2V0QXR0cmlidXRlKFwibWluXCIsIFwiMFwiKTtcbiAgICAgICAgdGV4dC5pbnB1dEVsLnNldEF0dHJpYnV0ZShcInN0ZXBcIiwgXCIwLjVcIik7XG4gICAgICAgIHRleHQuaW5wdXRFbC5zdHlsZS53aWR0aCA9IFwiNnJlbVwiO1xuICAgICAgICB0ZXh0Lm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMuaW5wdXRWYWx1ZSA9IHZhbHVlO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gU3VibWl0IG9uIEVudGVyXG4gICAgICAgIHRleHQuaW5wdXRFbC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZ0KSA9PiB7XG4gICAgICAgICAgaWYgKGV2dC5rZXkgPT09IFwiRW50ZXJcIikge1xuICAgICAgICAgICAgdGhpcy5zdWJtaXQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICAvLyBBdXRvLWZvY3VzXG4gICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRleHQuaW5wdXRFbC5mb2N1cygpLCA1MCk7XG4gICAgICB9KTtcblxuICAgIGNvbnN0IGJ0blJvdyA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwibW9kYWwtYnV0dG9uLWNvbnRhaW5lclwiIH0pO1xuICAgIGJ0blJvdy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiQ2xlYXIgdGFyZ2V0XCIsIGNsczogXCJtb2Qtd2FybmluZ1wiIH0pLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICB0aGlzLm9uU3VibWl0KG51bGwpO1xuICAgICAgdGhpcy5jbG9zZSgpO1xuICAgIH0pO1xuICAgIGJ0blJvdy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiU2F2ZVwiLCBjbHM6IFwibW9kLWN0YVwiIH0pLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICB0aGlzLnN1Ym1pdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBzdWJtaXQoKTogdm9pZCB7XG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IHRoaXMuaW5wdXRWYWx1ZS50cmltKCkucmVwbGFjZShcIixcIiwgXCIuXCIpO1xuICAgIGlmICghbm9ybWFsaXplZCkge1xuICAgICAgdGhpcy5vblN1Ym1pdChudWxsKTtcbiAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbWludXRlcyA9IE51bWJlcihub3JtYWxpemVkKTtcbiAgICBpZiAoIU51bWJlci5pc0Zpbml0ZShtaW51dGVzKSB8fCBtaW51dGVzIDw9IDApIHtcbiAgICAgIGNvbnN0IGVycm9yRWwgPSB0aGlzLmNvbnRlbnRFbC5xdWVyeVNlbGVjdG9yKFwiLmp3LXRhcmdldC1lcnJvclwiKSBhcyBIVE1MRWxlbWVudCB8IG51bGwgPz8gKCgpID0+IHtcbiAgICAgICAgY29uc3QgZWwgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVFbChcInBcIiwgeyBjbHM6IFwianctdGFyZ2V0LWVycm9yXCIgfSk7XG4gICAgICAgIGVsLnN0eWxlLmNvbG9yID0gXCJ2YXIoLS1jb2xvci1yZWQpXCI7XG4gICAgICAgIHJldHVybiBlbDtcbiAgICAgIH0pKCk7XG4gICAgICBlcnJvckVsLnNldFRleHQoXCJFbnRlciBhIHBvc2l0aXZlIG51bWJlciBvZiBtaW51dGVzLlwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5vblN1Ym1pdChNYXRoLnJvdW5kKG1pbnV0ZXMgKiA2MCAqIDEwMDApKTtcbiAgICB0aGlzLmNsb3NlKCk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQge1xuICAgIHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZVRpbWVyRGlzcGxheXMoKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBpZCBvZiB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzKSB7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgICBjb25zdCB1aSA9IHRoaXMudGltZXJVaVJlZnMuZ2V0KGlkKTtcbiAgICAgIGlmICghZW50cnkgfHwgIXVpKSBjb250aW51ZTtcblxuICAgICAgdWkudGltZXJFbC5zZXRUZXh0KGZvcm1hdER1cmF0aW9uKHRoaXMuZ2V0RWxhcHNlZChlbnRyeSkpKTtcbiAgICAgIHVpLnBsYXlTdG9wQnRuLnNldFRleHQoZW50cnkucnVubmluZyA/IFVJX1RFWFQucGF1c2UgOiBVSV9URVhULm9wZW4pO1xuICAgICAgdWkucGxheVN0b3BCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgZW50cnkucnVubmluZyA/IFwiUGF1c2UgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG4gICAgICB1aS5wbGF5U3RvcEJ0bi5zZXRBdHRyKFwidGl0bGVcIiwgZW50cnkucnVubmluZyA/IFwiUGF1c2UgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG5cbiAgICAgIGNvbnN0IHRhcmdldE1pbnV0ZXMgPSBlbnRyeS50YXJnZXRNcyA9PT0gbnVsbCA/IFwiXCIgOiAoZW50cnkudGFyZ2V0TXMgLyA2MDAwMCkudG9GaXhlZCgxKS5yZXBsYWNlKC9cXC4wJC8sIFwiXCIpO1xuICAgICAgdWkudGFyZ2V0QnRuLnNldEF0dHIoXG4gICAgICAgIFwidGl0bGVcIixcbiAgICAgICAgZW50cnkudGFyZ2V0TXMgPT09IG51bGwgPyBcIkNvbmZpZ3VyZSB0YXJnZXQgdGltZVwiIDogYFRhcmdldDogJHt0YXJnZXRNaW51dGVzfSBtaW5gXG4gICAgICApO1xuXG4gICAgICBjb25zdCBlbGFwc2VkID0gdGhpcy5nZXRFbGFwc2VkKGVudHJ5KTtcbiAgICAgIGNvbnN0IGhhc1RhcmdldCA9IGVudHJ5LnRhcmdldE1zICE9PSBudWxsO1xuICAgICAgY29uc3QgaXNPdmVyVGFyZ2V0ID0gaGFzVGFyZ2V0ICYmIGVsYXBzZWQgPiAoZW50cnkudGFyZ2V0TXMgPz8gMCk7XG5cbiAgICAgIHVpLmNhcmRFbC5yZW1vdmVDbGFzcyhcImp3LXRpbWVyLWNhcmQtLXJ1bm5pbmdcIiwgXCJqdy10aW1lci1jYXJkLS1zdG9wcGVkXCIsIFwianctdGltZXItY2FyZC0tb3ZlcmR1ZS1ydW5uaW5nXCIpO1xuICAgICAgdWkudGltZXJFbC5yZW1vdmVDbGFzcyhcImp3LXRpbWVyLWNsb2NrLS10YXJnZXQtb3ZlclwiLCBcImp3LXRpbWVyLWNsb2NrLS10YXJnZXQtb2tcIik7XG5cbiAgICAgIGlmIChlbnRyeS5ydW5uaW5nICYmIGlzT3ZlclRhcmdldCkge1xuICAgICAgICB1aS5jYXJkRWwuYWRkQ2xhc3MoXCJqdy10aW1lci1jYXJkLS1vdmVyZHVlLXJ1bm5pbmdcIik7XG4gICAgICAgIHVpLnRpbWVyRWwuYWRkQ2xhc3MoXCJqdy10aW1lci1jbG9jay0tdGFyZ2V0LW92ZXJcIik7XG4gICAgICB9IGVsc2UgaWYgKGVudHJ5LnJ1bm5pbmcpIHtcbiAgICAgICAgdWkuY2FyZEVsLmFkZENsYXNzKFwianctdGltZXItY2FyZC0tcnVubmluZ1wiKTtcbiAgICAgIH0gZWxzZSBpZiAoZWxhcHNlZCA+IDApIHtcbiAgICAgICAgdWkuY2FyZEVsLmFkZENsYXNzKFwianctdGltZXItY2FyZC0tc3RvcHBlZFwiKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFlbnRyeS5ydW5uaW5nICYmIGhhc1RhcmdldCkge1xuICAgICAgICBpZiAoaXNPdmVyVGFyZ2V0KSB7XG4gICAgICAgICAgdWkudGltZXJFbC5hZGRDbGFzcyhcImp3LXRpbWVyLWNsb2NrLS10YXJnZXQtb3ZlclwiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB1aS50aW1lckVsLmFkZENsYXNzKFwianctdGltZXItY2xvY2stLXRhcmdldC1va1wiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcGVyc2lzdFRpbWVyKGVudHJ5OiBUaW1lckVudHJ5KTogdm9pZCB7XG4gICAgY29uc3QgZWxhcHNlZCA9IHRoaXMuZ2V0RWxhcHNlZChlbnRyeSk7XG4gICAgdm9pZCB0aGlzLnBsdWdpbi51cHNlcnRTdG9yZWRUaW1lcihlbnRyeS5pZCwge1xuICAgICAgdGl0bGU6IGVudHJ5LnRpdGxlLFxuICAgICAgZWxhcHNlZE1zOiBlbGFwc2VkLFxuICAgICAgdGFyZ2V0TXM6IGVudHJ5LnRhcmdldE1zLFxuICAgICAgZGVsZXRlZDogZmFsc2VcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcGVyc2lzdEFsbFRpbWVycyhmcmVlemVSdW5uaW5nOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdXBkYXRlczogUHJvbWlzZTx2b2lkPltdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMudGltZXJzLnZhbHVlcygpKSB7XG4gICAgICBsZXQgZWxhcHNlZCA9IHRoaXMuZ2V0RWxhcHNlZChlbnRyeSk7XG4gICAgICBpZiAoZnJlZXplUnVubmluZyAmJiBlbnRyeS5ydW5uaW5nKSB7XG4gICAgICAgIGVudHJ5LmVsYXBzZWRNcyA9IGVsYXBzZWQ7XG4gICAgICAgIGVudHJ5LnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgZW50cnkuc3RhcnRlZEF0ID0gbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAoIWVudHJ5LnJ1bm5pbmcpIHtcbiAgICAgICAgZWxhcHNlZCA9IGVudHJ5LmVsYXBzZWRNcztcbiAgICAgIH1cblxuICAgICAgdXBkYXRlcy5wdXNoKFxuICAgICAgICB0aGlzLnBsdWdpbi51cHNlcnRTdG9yZWRUaW1lcihlbnRyeS5pZCwge1xuICAgICAgICAgIHRpdGxlOiBlbnRyeS50aXRsZSxcbiAgICAgICAgICBlbGFwc2VkTXM6IGVsYXBzZWQsXG4gICAgICAgICAgdGFyZ2V0TXM6IGVudHJ5LnRhcmdldE1zLFxuICAgICAgICAgIGRlbGV0ZWQ6IGZhbHNlXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIGF3YWl0IFByb21pc2UuYWxsKHVwZGF0ZXMpO1xuICB9XG5cbiAgcHJpdmF0ZSBwZXJzaXN0UnVubmluZ1NuYXBzaG90cygpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMudGltZXJzLnZhbHVlcygpKSB7XG4gICAgICBpZiAoZW50cnkucnVubmluZykge1xuICAgICAgICB0aGlzLnBlcnNpc3RUaW1lcihlbnRyeSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZW5kZXJUaXRsZUNvbnRlbnQodGl0bGVFbDogSFRNTEVsZW1lbnQsIHJhd1RpdGxlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByZW5kZXJlZEVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgcmF3VGl0bGUsIHJlbmRlcmVkRWwsIHRoaXMuY3VycmVudEZpbGVQYXRoID8/IFwiXCIsIHRoaXMpO1xuICAgIHRoaXMucmVzdG9yZUlubGluZUh0bWxBdHRyaWJ1dGVzKHJlbmRlcmVkRWwsIHJhd1RpdGxlKTtcblxuICAgIGNvbnN0IHBsYWluID0gKHJlbmRlcmVkRWwudGV4dENvbnRlbnQgPz8gXCJcIikucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xuICAgIGlmIChwbGFpbi5sZW5ndGggPiBUaW1lclNpZGViYXJWaWV3LlRJVExFX01BWF9MRU5HVEgpIHtcbiAgICAgIHRoaXMudHJ1bmNhdGVSZW5kZXJlZENvbnRlbnQocmVuZGVyZWRFbCwgVGltZXJTaWRlYmFyVmlldy5USVRMRV9NQVhfTEVOR1RIKTtcbiAgICAgIHRpdGxlRWwuc2V0QXR0cihcInRpdGxlXCIsIHBsYWluKTtcbiAgICAgIHRpdGxlRWwuc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgcGxhaW4pO1xuICAgIH1cblxuICAgIHRpdGxlRWwuZW1wdHkoKTtcbiAgICB3aGlsZSAocmVuZGVyZWRFbC5maXJzdENoaWxkKSB7XG4gICAgICB0aXRsZUVsLmFwcGVuZENoaWxkKHJlbmRlcmVkRWwuZmlyc3RDaGlsZCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZXN0b3JlSW5saW5lSHRtbEF0dHJpYnV0ZXMoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LCByYXdUaXRsZTogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgcGFyc2VkUm9vdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgcGFyc2VkUm9vdC5pbm5lckhUTUwgPSByYXdUaXRsZTtcblxuICAgIGNvbnN0IHNvdXJjZUVsZW1lbnRzID0gQXJyYXkuZnJvbShwYXJzZWRSb290LnF1ZXJ5U2VsZWN0b3JBbGwoXCIqXCIpKS5maWx0ZXIoKGVsZW1lbnQpID0+IHtcbiAgICAgIGNvbnN0IGF0dHJpYnV0ZU5hbWVzID0gZWxlbWVudC5nZXRBdHRyaWJ1dGVOYW1lcygpO1xuICAgICAgcmV0dXJuIGF0dHJpYnV0ZU5hbWVzLmxlbmd0aCA+IDA7XG4gICAgfSk7XG4gICAgdGhpcy5hcHBseU1hdGNoaW5nQXR0cmlidXRlcyhzb3VyY2VFbGVtZW50cywgY29udGFpbmVyRWwpO1xuICB9XG5cbiAgcHJpdmF0ZSBhcHBseU1hdGNoaW5nQXR0cmlidXRlcyhzb3VyY2VFbGVtZW50czogRWxlbWVudFtdLCBjb250YWluZXJFbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb25zdCB1c2VkVGFyZ2V0cyA9IG5ldyBTZXQ8RWxlbWVudD4oKTtcblxuICAgIGZvciAoY29uc3Qgc291cmNlRWwgb2Ygc291cmNlRWxlbWVudHMpIHtcbiAgICAgIGNvbnN0IHNvdXJjZVRleHQgPSBzb3VyY2VFbC50ZXh0Q29udGVudD8ucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xuICAgICAgaWYgKCFzb3VyY2VUZXh0KSBjb250aW51ZTtcblxuICAgICAgY29uc3QgY2FuZGlkYXRlVGFyZ2V0cyA9IEFycmF5LmZyb20oY29udGFpbmVyRWwucXVlcnlTZWxlY3RvckFsbChzb3VyY2VFbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkpKTtcbiAgICAgIGNvbnN0IHRhcmdldEVsID0gY2FuZGlkYXRlVGFyZ2V0cy5maW5kKChjYW5kaWRhdGUpID0+IHtcbiAgICAgICAgaWYgKHVzZWRUYXJnZXRzLmhhcyhjYW5kaWRhdGUpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2FuZGlkYXRlVGV4dCA9IGNhbmRpZGF0ZS50ZXh0Q29udGVudD8ucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xuICAgICAgICByZXR1cm4gY2FuZGlkYXRlVGV4dCA9PT0gc291cmNlVGV4dDtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXRhcmdldEVsKSBjb250aW51ZTtcblxuICAgICAgdXNlZFRhcmdldHMuYWRkKHRhcmdldEVsKTtcbiAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBzb3VyY2VFbC5nZXRBdHRyaWJ1dGVOYW1lcygpKSB7XG4gICAgICAgIHRhcmdldEVsLnNldEF0dHJpYnV0ZShhdHRyLCBzb3VyY2VFbC5nZXRBdHRyaWJ1dGUoYXR0cikgPz8gXCJcIik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSB0cnVuY2F0ZVJlbmRlcmVkQ29udGVudChjb250YWluZXJFbDogSFRNTEVsZW1lbnQsIG1heExlbmd0aDogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3Qgd2Fsa2VyID0gZG9jdW1lbnQuY3JlYXRlVHJlZVdhbGtlcihjb250YWluZXJFbCwgTm9kZUZpbHRlci5TSE9XX1RFWFQpO1xuICAgIGNvbnN0IHRleHROb2RlczogVGV4dFtdID0gW107XG5cbiAgICB3aGlsZSAod2Fsa2VyLm5leHROb2RlKCkpIHtcbiAgICAgIHRleHROb2Rlcy5wdXNoKHdhbGtlci5jdXJyZW50Tm9kZSBhcyBUZXh0KTtcbiAgICB9XG5cbiAgICBsZXQgdXNlZExlbmd0aCA9IDA7XG4gICAgbGV0IHJlYWNoZWRMaW1pdCA9IGZhbHNlO1xuXG4gICAgZm9yIChjb25zdCB0ZXh0Tm9kZSBvZiB0ZXh0Tm9kZXMpIHtcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSB0ZXh0Tm9kZS50ZXh0Q29udGVudD8ucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikgPz8gXCJcIjtcbiAgICAgIGlmICghbm9ybWFsaXplZC50cmltKCkpIHtcbiAgICAgICAgaWYgKHJlYWNoZWRMaW1pdCkge1xuICAgICAgICAgIHRleHROb2RlLnRleHRDb250ZW50ID0gXCJcIjtcbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlYWNoZWRMaW1pdCkge1xuICAgICAgICB0ZXh0Tm9kZS50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZW1haW5pbmcgPSBtYXhMZW5ndGggLSB1c2VkTGVuZ3RoO1xuICAgICAgaWYgKG5vcm1hbGl6ZWQubGVuZ3RoIDw9IHJlbWFpbmluZykge1xuICAgICAgICB1c2VkTGVuZ3RoICs9IG5vcm1hbGl6ZWQubGVuZ3RoO1xuICAgICAgICB0ZXh0Tm9kZS50ZXh0Q29udGVudCA9IG5vcm1hbGl6ZWQ7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBzbGljZUxlbmd0aCA9IE1hdGgubWF4KDAsIHJlbWFpbmluZyAtIDMpO1xuICAgICAgY29uc3QgdHJ1bmNhdGVkVGV4dCA9IGAke25vcm1hbGl6ZWQuc2xpY2UoMCwgc2xpY2VMZW5ndGgpLnRyaW1FbmQoKX0uLi5gO1xuICAgICAgdGV4dE5vZGUudGV4dENvbnRlbnQgPSB0cnVuY2F0ZWRUZXh0O1xuICAgICAgcmVhY2hlZExpbWl0ID0gdHJ1ZTtcbiAgICAgIHVzZWRMZW5ndGggPSBtYXhMZW5ndGg7XG4gICAgfVxuXG4gICAgdGhpcy5yZW1vdmVFbXB0eU5vZGVzKGNvbnRhaW5lckVsKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVtb3ZlRW1wdHlOb2Rlcyhyb290RWw6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgY29uc3QgY2hpbGROb2RlcyA9IEFycmF5LmZyb20ocm9vdEVsLmNoaWxkTm9kZXMpO1xuXG4gICAgZm9yIChjb25zdCBjaGlsZE5vZGUgb2YgY2hpbGROb2Rlcykge1xuICAgICAgaWYgKGNoaWxkTm9kZS5ub2RlVHlwZSA9PT0gTm9kZS5URVhUX05PREUpIHtcbiAgICAgICAgaWYgKCEoY2hpbGROb2RlLnRleHRDb250ZW50ID8/IFwiXCIpLnRyaW0oKSkge1xuICAgICAgICAgIGNoaWxkTm9kZS5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNoaWxkTm9kZSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG4gICAgICAgIHRoaXMucmVtb3ZlRW1wdHlOb2RlcyhjaGlsZE5vZGUpO1xuICAgICAgICBjb25zdCBoYXNNZWFuaW5nZnVsVGV4dCA9IChjaGlsZE5vZGUudGV4dENvbnRlbnQgPz8gXCJcIikudHJpbSgpLmxlbmd0aCA+IDA7XG4gICAgICAgIGNvbnN0IGhhc0VsZW1lbnRDaGlsZHJlbiA9IGNoaWxkTm9kZS5jaGlsZHJlbi5sZW5ndGggPiAwO1xuICAgICAgICBpZiAoIWhhc01lYW5pbmdmdWxUZXh0ICYmICFoYXNFbGVtZW50Q2hpbGRyZW4pIHtcbiAgICAgICAgICBjaGlsZE5vZGUucmVtb3ZlKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGltZXJTaWRlYmFyUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgcHJpdmF0ZSBzdG9yYWdlOiBUaW1lclN0b3JhZ2VEYXRhID0geyB2ZXJzaW9uOiBTVE9SQUdFX1ZFUlNJT04sIHRpbWVyczoge30gfTtcbiAgcHJpdmF0ZSBzYXZlSGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5zdG9yYWdlID0gdGhpcy5ub3JtYWxpemVTdG9yYWdlRGF0YShhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICAgIGlmICh0aGlzLnBydW5lT2xkVGltZXJzKCkpIHtcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zdG9yYWdlKTtcbiAgICB9XG5cbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEVfVElNRVJfU0lERUJBUiwgKGxlYWYpID0+IG5ldyBUaW1lclNpZGViYXJWaWV3KGxlYWYsIHRoaXMpKTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcInRpbWVyXCIsIFwiT3BlbiBKVyBUaW1lciBzaWRlYmFyXCIsICgpID0+IHtcbiAgICAgIHZvaWQgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJvcGVuLWp3LXRpbWVyLXNpZGViYXJcIixcbiAgICAgIG5hbWU6IFwiT3BlbiBKVyBUaW1lciBzaWRlYmFyXCIsXG4gICAgICBjYWxsYmFjazogYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLmFjdGl2YXRlVmlldygpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoKCkgPT4ge1xuICAgICAgdm9pZCB0aGlzLmFjdGl2YXRlVmlldygpO1xuICAgIH0pO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuc2F2ZUhhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnNhdmVIYW5kbGUpO1xuICAgICAgdGhpcy5zYXZlSGFuZGxlID0gbnVsbDtcbiAgICAgIHZvaWQgdGhpcy5zYXZlRGF0YSh0aGlzLnN0b3JhZ2UpO1xuICAgIH1cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9USU1FUl9TSURFQkFSKTtcbiAgfVxuXG4gIGdldFN0b3JlZFRpbWVyKGlkOiBzdHJpbmcpOiBTdG9yZWRUaW1lclN0YXRlIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5zdG9yYWdlLnRpbWVyc1tpZF07XG4gIH1cblxuICBnZXREZWxldGVkVGltZXJJZHNGb3JGaWxlKGZpbGVQYXRoOiBzdHJpbmcpOiBTZXQ8c3RyaW5nPiB7XG4gICAgY29uc3QgZGVsZXRlZElkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IHByZWZpeCA9IGAke2ZpbGVQYXRofTo6YDtcblxuICAgIGZvciAoY29uc3QgW2lkLCBzdGF0ZV0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5zdG9yYWdlLnRpbWVycykpIHtcbiAgICAgIGlmIChpZC5zdGFydHNXaXRoKHByZWZpeCkgJiYgc3RhdGUuZGVsZXRlZCkge1xuICAgICAgICBkZWxldGVkSWRzLmFkZChpZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlbGV0ZWRJZHM7XG4gIH1cblxuICBhc3luYyB1cHNlcnRTdG9yZWRUaW1lcihcbiAgICBpZDogc3RyaW5nLFxuICAgIHN0YXRlOiB7IHRpdGxlOiBzdHJpbmc7IGVsYXBzZWRNczogbnVtYmVyOyB0YXJnZXRNczogbnVtYmVyIHwgbnVsbDsgZGVsZXRlZDogYm9vbGVhbiB9XG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc3RvcmFnZS50aW1lcnNbaWRdID0ge1xuICAgICAgdGl0bGU6IHN0YXRlLnRpdGxlLFxuICAgICAgZWxhcHNlZE1zOiBNYXRoLm1heCgwLCBNYXRoLmZsb29yKHN0YXRlLmVsYXBzZWRNcykpLFxuICAgICAgdGFyZ2V0TXM6IHN0YXRlLnRhcmdldE1zLFxuICAgICAgZGVsZXRlZDogc3RhdGUuZGVsZXRlZCxcbiAgICAgIHVwZGF0ZWRBdDogRGF0ZS5ub3coKVxuICAgIH07XG5cbiAgICB0aGlzLnNjaGVkdWxlU2F2ZSgpO1xuICB9XG5cbiAgYXN5bmMgbWFya1RpbWVyRGVsZXRlZChpZDogc3RyaW5nLCB0aXRsZTogc3RyaW5nLCB0YXJnZXRNczogbnVtYmVyIHwgbnVsbCwgZWxhcHNlZE1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnN0b3JhZ2UudGltZXJzW2lkXSA9IHtcbiAgICAgIHRpdGxlLFxuICAgICAgZWxhcHNlZE1zOiBNYXRoLm1heCgwLCBNYXRoLmZsb29yKGVsYXBzZWRNcykpLFxuICAgICAgdGFyZ2V0TXMsXG4gICAgICBkZWxldGVkOiB0cnVlLFxuICAgICAgdXBkYXRlZEF0OiBEYXRlLm5vdygpXG4gICAgfTtcblxuICAgIHRoaXMuc2NoZWR1bGVTYXZlKCk7XG4gIH1cblxuICBhc3luYyByZW1vdmVTdG9yZWRUaW1lcihpZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCEoaWQgaW4gdGhpcy5zdG9yYWdlLnRpbWVycykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBkZWxldGUgdGhpcy5zdG9yYWdlLnRpbWVyc1tpZF07XG4gICAgdGhpcy5zY2hlZHVsZVNhdmUoKTtcbiAgfVxuXG4gIGFzeW5jIGNsZWFyRmlsZVRpbWVycyhmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcHJlZml4ID0gYCR7ZmlsZVBhdGh9OjpgO1xuICAgIGxldCBjaGFuZ2VkID0gZmFsc2U7XG5cbiAgICBmb3IgKGNvbnN0IGlkIG9mIE9iamVjdC5rZXlzKHRoaXMuc3RvcmFnZS50aW1lcnMpKSB7XG4gICAgICBpZiAoaWQuc3RhcnRzV2l0aChwcmVmaXgpKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0b3JhZ2UudGltZXJzW2lkXTtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgIHRoaXMuc2NoZWR1bGVTYXZlKCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBub3JtYWxpemVTdG9yYWdlRGF0YShyYXc6IHVua25vd24pOiBUaW1lclN0b3JhZ2VEYXRhIHtcbiAgICBjb25zdCBmYWxsYmFjazogVGltZXJTdG9yYWdlRGF0YSA9IHsgdmVyc2lvbjogU1RPUkFHRV9WRVJTSU9OLCB0aW1lcnM6IHt9IH07XG4gICAgaWYgKCFyYXcgfHwgdHlwZW9mIHJhdyAhPT0gXCJvYmplY3RcIikge1xuICAgICAgcmV0dXJuIGZhbGxiYWNrO1xuICAgIH1cblxuICAgIGNvbnN0IG1heWJlRGF0YSA9IHJhdyBhcyBQYXJ0aWFsPFRpbWVyU3RvcmFnZURhdGE+O1xuICAgIGlmICghbWF5YmVEYXRhLnRpbWVycyB8fCB0eXBlb2YgbWF5YmVEYXRhLnRpbWVycyAhPT0gXCJvYmplY3RcIikge1xuICAgICAgcmV0dXJuIGZhbGxiYWNrO1xuICAgIH1cblxuICAgIGNvbnN0IG5vcm1hbGl6ZWRUaW1lcnM6IFJlY29yZDxzdHJpbmcsIFN0b3JlZFRpbWVyU3RhdGU+ID0ge307XG4gICAgZm9yIChjb25zdCBbaWQsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhtYXliZURhdGEudGltZXJzKSkge1xuICAgICAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHRpbWVyID0gdmFsdWUgYXMgUGFydGlhbDxTdG9yZWRUaW1lclN0YXRlPjtcbiAgICAgIG5vcm1hbGl6ZWRUaW1lcnNbaWRdID0ge1xuICAgICAgICB0aXRsZTogdHlwZW9mIHRpbWVyLnRpdGxlID09PSBcInN0cmluZ1wiID8gdGltZXIudGl0bGUgOiBcIlwiLFxuICAgICAgICBlbGFwc2VkTXM6IE51bWJlci5pc0Zpbml0ZSh0aW1lci5lbGFwc2VkTXMpID8gTWF0aC5tYXgoMCwgTWF0aC5mbG9vcih0aW1lci5lbGFwc2VkTXMgPz8gMCkpIDogMCxcbiAgICAgICAgdGFyZ2V0TXM6XG4gICAgICAgICAgdGltZXIudGFyZ2V0TXMgPT09IG51bGwgfHwgdGltZXIudGFyZ2V0TXMgPT09IHVuZGVmaW5lZFxuICAgICAgICAgICAgPyBudWxsXG4gICAgICAgICAgICA6IE51bWJlci5pc0Zpbml0ZSh0aW1lci50YXJnZXRNcylcbiAgICAgICAgICAgICAgPyBNYXRoLm1heCgwLCBNYXRoLmZsb29yKHRpbWVyLnRhcmdldE1zKSlcbiAgICAgICAgICAgICAgOiBudWxsLFxuICAgICAgICBkZWxldGVkOiBCb29sZWFuKHRpbWVyLmRlbGV0ZWQpLFxuICAgICAgICB1cGRhdGVkQXQ6XG4gICAgICAgICAgTnVtYmVyLmlzRmluaXRlKHRpbWVyLnVwZGF0ZWRBdCkgJiYgKHRpbWVyLnVwZGF0ZWRBdCA/PyAwKSA+IDBcbiAgICAgICAgICAgID8gTWF0aC5mbG9vcih0aW1lci51cGRhdGVkQXQgYXMgbnVtYmVyKVxuICAgICAgICAgICAgOiBEYXRlLm5vdygpXG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICB2ZXJzaW9uOiBTVE9SQUdFX1ZFUlNJT04sXG4gICAgICB0aW1lcnM6IG5vcm1hbGl6ZWRUaW1lcnNcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBwcnVuZU9sZFRpbWVycygpOiBib29sZWFuIHtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIGxldCBjaGFuZ2VkID0gZmFsc2U7XG5cbiAgICBmb3IgKGNvbnN0IFtpZCwgdGltZXJdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuc3RvcmFnZS50aW1lcnMpKSB7XG4gICAgICBpZiAobm93IC0gdGltZXIudXBkYXRlZEF0ID4gVElNRVJfUkVURU5USU9OX01TKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0b3JhZ2UudGltZXJzW2lkXTtcbiAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNoYW5nZWQ7XG4gIH1cblxuICBwcml2YXRlIHNjaGVkdWxlU2F2ZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5wcnVuZU9sZFRpbWVycygpKSB7XG4gICAgICAvLyBLZWVwIHN0b3JhZ2UgYm91bmRlZCBiZWZvcmUgcGVyc2lzdGluZyB0byBkaXNrLlxuICAgIH1cblxuICAgIGlmICh0aGlzLnNhdmVIYW5kbGUgIT09IG51bGwpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5zYXZlSGFuZGxlKTtcbiAgICB9XG5cbiAgICB0aGlzLnNhdmVIYW5kbGUgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLnNhdmVIYW5kbGUgPSBudWxsO1xuICAgICAgdm9pZCB0aGlzLnNhdmVEYXRhKHRoaXMuc3RvcmFnZSk7XG4gICAgfSwgNDAwKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgYWN0aXZhdGVWaWV3KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGV4aXN0aW5nTGVhdmVzID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfVElNRVJfU0lERUJBUik7XG4gICAgaWYgKGV4aXN0aW5nTGVhdmVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGV4aXN0aW5nTGVhdmVzWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldFJpZ2h0TGVhZihmYWxzZSk7XG4gICAgaWYgKCFsZWFmKSByZXR1cm47XG5cbiAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7XG4gICAgICB0eXBlOiBWSUVXX1RZUEVfVElNRVJfU0lERUJBUixcbiAgICAgIGFjdGl2ZTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQVNPO0FBRVAsSUFBTSwwQkFBMEI7QUFDaEMsSUFBTSxrQkFBa0I7QUFDeEIsSUFBTSxxQkFBcUIsS0FBSyxLQUFLLEtBQUssS0FBSztBQUUvQyxJQUFNLFVBQVU7QUFBQSxFQUNkLE9BQU87QUFBQSxFQUNQLE9BQU87QUFBQSxFQUNQLE1BQU07QUFBQSxFQUNOLE9BQU87QUFBQSxFQUNQLFFBQVE7QUFBQSxFQUNSLE9BQU87QUFBQSxFQUNQLFFBQVE7QUFBQSxFQUNSLFVBQVU7QUFDWjtBQWdDQSxTQUFTLGFBQWEsVUFBa0IsU0FBK0I7QUFDckUsUUFBTSxPQUFPLFFBQVEsVUFBVSxNQUFNLFFBQVE7QUFDN0MsU0FBTyxHQUFHLFFBQVEsS0FBSyxJQUFJLEtBQUssUUFBUSxPQUFPO0FBQ2pEO0FBRUEsU0FBUyxlQUFlLElBQW9CO0FBQzFDLFFBQU0sZUFBZSxLQUFLLElBQUksR0FBRyxLQUFLLE1BQU0sS0FBSyxHQUFJLENBQUM7QUFDdEQsUUFBTSxRQUFRLEtBQUssTUFBTSxlQUFlLElBQUk7QUFDNUMsUUFBTSxVQUFVLEtBQUssTUFBTyxlQUFlLE9BQVEsRUFBRTtBQUNyRCxRQUFNLFVBQVUsZUFBZTtBQUUvQixTQUFPLEdBQUcsT0FBTyxLQUFLLEVBQUUsU0FBUyxHQUFHLEdBQUcsQ0FBQyxJQUFJLE9BQU8sT0FBTyxFQUFFLFNBQVMsR0FBRyxHQUFHLENBQUMsSUFBSSxPQUFPLE9BQU8sRUFBRSxTQUFTLEdBQUcsR0FBRyxDQUFDO0FBQ2xIO0FBRUEsSUFBTSxtQkFBTixjQUErQix5QkFBUztBQUFBLEVBYXRDLFlBQVksTUFBc0MsUUFBNEI7QUFDNUUsVUFBTSxJQUFJO0FBRHNDO0FBWmxELFNBQVEsU0FBUyxvQkFBSSxJQUF3QjtBQUM3QyxTQUFRLGtCQUFrQixvQkFBSSxJQUFZO0FBQzFDLFNBQVEsY0FBYyxvQkFBSSxJQUF3QjtBQUNsRCxTQUFRLG9CQUE4QixDQUFDO0FBQ3ZDLFNBQVEsa0JBQWlDO0FBSXpDLFNBQVEsYUFBNEI7QUFDcEMsU0FBUSxnQkFBK0I7QUFBQSxFQUt2QztBQUFBLEVBRUEsY0FBc0I7QUFDcEIsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVBLGlCQUF5QjtBQUN2QixXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsVUFBa0I7QUFDaEIsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVBLE1BQU0sU0FBd0I7QUFDNUIsU0FBSyxVQUFVLE1BQU07QUFDckIsU0FBSyxVQUFVLFNBQVMsdUJBQXVCO0FBRS9DLFVBQU0sVUFBVSxLQUFLLFVBQVUsVUFBVSxFQUFFLEtBQUssbUJBQW1CLENBQUM7QUFFcEUsVUFBTSxVQUFVLFFBQVEsU0FBUyxNQUFNLEVBQUUsTUFBTSxRQUFRLE9BQU8sS0FBSyxpQkFBaUIsQ0FBQztBQUNyRixZQUFRLFFBQVEsYUFBYSxRQUFRO0FBQ3JDLFlBQVEsUUFBUSxjQUFjLG1CQUFtQjtBQUVqRCxTQUFLLFNBQVMsUUFBUSxVQUFVLEVBQUUsS0FBSyxnQkFBZ0IsQ0FBQztBQUN4RCxTQUFLLGVBQWUsUUFBUSxVQUFVLEVBQUUsS0FBSyxpQkFBaUIsQ0FBQztBQUUvRCxVQUFNLFdBQVcsUUFBUSxVQUFVLEVBQUUsS0FBSyxrQkFBa0IsQ0FBQztBQUM3RCxVQUFNLGVBQWUsU0FBUyxTQUFTLFVBQVU7QUFBQSxNQUMvQyxNQUFNLFFBQVE7QUFBQSxNQUNkLEtBQUs7QUFBQSxJQUNQLENBQUM7QUFDRCxpQkFBYSxRQUFRLGNBQWMsa0JBQWtCO0FBQ3JELGlCQUFhLFFBQVEsU0FBUyxrQkFBa0I7QUFFaEQsaUJBQWEsaUJBQWlCLFNBQVMsTUFBTTtBQUMzQyxVQUFJLEtBQUssY0FBYyxtQkFBbUIsR0FBRztBQUMzQyxhQUFLLGdCQUFnQjtBQUFBLE1BQ3ZCO0FBQUEsSUFDRixDQUFDO0FBRUQsU0FBSyxjQUFjLEtBQUssSUFBSSxVQUFVLEdBQUcsc0JBQXNCLE1BQU0sS0FBSyxLQUFLLHNCQUFzQixDQUFDLENBQUM7QUFFdkcsU0FBSztBQUFBLE1BQ0gsS0FBSyxJQUFJLGNBQWMsR0FBRyxXQUFXLENBQUMsU0FBUztBQUM3QyxZQUFJLEtBQUssU0FBUyxLQUFLLGlCQUFpQjtBQUN0QyxlQUFLLEtBQUssc0JBQXNCO0FBQUEsUUFDbEM7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBRUEsU0FBSyxhQUFhLE9BQU8sWUFBWSxNQUFNO0FBQ3pDLFdBQUssb0JBQW9CO0FBQUEsSUFDM0IsR0FBRyxHQUFHO0FBRU4sU0FBSyxnQkFBZ0IsT0FBTyxZQUFZLE1BQU07QUFDNUMsV0FBSyx3QkFBd0I7QUFBQSxJQUMvQixHQUFHLEdBQUk7QUFFUCxTQUFLLEtBQUssc0JBQXNCO0FBQUEsRUFDbEM7QUFBQSxFQUVBLE1BQU0sVUFBeUI7QUFDN0IsUUFBSSxLQUFLLGVBQWUsTUFBTTtBQUM1QixhQUFPLGNBQWMsS0FBSyxVQUFVO0FBQ3BDLFdBQUssYUFBYTtBQUFBLElBQ3BCO0FBQ0EsUUFBSSxLQUFLLGtCQUFrQixNQUFNO0FBQy9CLGFBQU8sY0FBYyxLQUFLLGFBQWE7QUFDdkMsV0FBSyxnQkFBZ0I7QUFBQSxJQUN2QjtBQUVBLFVBQU0sS0FBSyxpQkFBaUIsSUFBSTtBQUVoQyxTQUFLLFVBQVUsWUFBWSx1QkFBdUI7QUFDbEQsU0FBSyxZQUFZLE1BQU07QUFBQSxFQUN6QjtBQUFBLEVBRUEsTUFBYyx3QkFBdUM7QUFDbkQsVUFBTSxhQUFhLEtBQUssSUFBSSxVQUFVLGNBQWM7QUFFcEQsUUFBSSxDQUFDLFlBQVk7QUFDZixXQUFLLGtCQUFrQjtBQUN2QixXQUFLLG9CQUFvQixDQUFDO0FBQzFCLFlBQU0sS0FBSyxXQUFXO0FBQ3RCO0FBQUEsSUFDRjtBQUVBLFNBQUssa0JBQWtCLFdBQVc7QUFDbEMsVUFBTSxjQUFjLE1BQU0sS0FBSyxJQUFJLE1BQU0sV0FBVyxVQUFVO0FBQzlELFVBQU0sWUFBWSxLQUFLLElBQUksY0FBYyxhQUFhLFVBQVU7QUFDaEUsVUFBTSxZQUFZLFdBQVcsWUFBWSxDQUFDLEdBQUcsTUFBTSxFQUFFLEtBQUssQ0FBQyxHQUFHLE1BQU07QUFDbEUsWUFBTSxRQUFRLEVBQUUsVUFBVSxNQUFNLFFBQVE7QUFDeEMsWUFBTSxRQUFRLEVBQUUsVUFBVSxNQUFNLFFBQVE7QUFDeEMsYUFBTyxRQUFRO0FBQUEsSUFDakIsQ0FBQztBQUNELFVBQU0sbUJBQW1CLEtBQUssd0JBQXdCLGFBQWEsUUFBUTtBQUMzRSxTQUFLLGtCQUFrQixLQUFLLE9BQU8sMEJBQTBCLFdBQVcsSUFBSTtBQUU1RSxVQUFNLGlCQUEyQixDQUFDO0FBQ2xDLFVBQU0sZ0JBQWdCLG9CQUFJLElBQVk7QUFFdEMsZUFBVyxXQUFXLFVBQVU7QUFDOUIsWUFBTSxLQUFLLGFBQWEsV0FBVyxNQUFNLE9BQU87QUFDaEQsb0JBQWMsSUFBSSxFQUFFO0FBQ3BCLFVBQUksS0FBSyxnQkFBZ0IsSUFBSSxFQUFFLEdBQUc7QUFDaEM7QUFBQSxNQUNGO0FBRUEsWUFBTSxjQUFjLFFBQVEsVUFBVSxNQUFNLFFBQVE7QUFDcEQsWUFBTSxlQUFlLGlCQUFpQixJQUFJLFdBQVcsS0FBSyxRQUFRO0FBQ2xFLFlBQU0sV0FBVyxLQUFLLE9BQU8sSUFBSSxFQUFFO0FBQ25DLFlBQU0sU0FBUyxLQUFLLE9BQU8sZUFBZSxFQUFFO0FBRTVDLFVBQUksQ0FBQyxVQUFVO0FBQ2IsYUFBSyxPQUFPLElBQUksSUFBSTtBQUFBLFVBQ2xCO0FBQUEsVUFDQSxPQUFPO0FBQUEsVUFDUCxXQUFXLFFBQVEsYUFBYTtBQUFBLFVBQ2hDLFVBQVUsUUFBUSxZQUFZO0FBQUEsVUFDOUIsU0FBUztBQUFBLFVBQ1QsV0FBVztBQUFBLFFBQ2IsQ0FBQztBQUFBLE1BQ0gsT0FBTztBQUNMLGlCQUFTLFFBQVE7QUFDakIsWUFBSSxTQUFTLGFBQWEsUUFBUSxRQUFRLGFBQWEsUUFBVztBQUNoRSxtQkFBUyxXQUFXLE9BQU87QUFBQSxRQUM3QjtBQUFBLE1BQ0Y7QUFFQSxxQkFBZSxLQUFLLEVBQUU7QUFBQSxJQUN4QjtBQUVBLFVBQU0sYUFBYSxJQUFJLElBQUksY0FBYztBQUN6QyxlQUFXLGNBQWMsQ0FBQyxHQUFHLEtBQUssT0FBTyxLQUFLLENBQUMsR0FBRztBQUNoRCxVQUFJLFdBQVcsV0FBVyxHQUFHLFdBQVcsSUFBSSxJQUFJLEtBQUssQ0FBQyxXQUFXLElBQUksVUFBVSxHQUFHO0FBQ2hGLGFBQUssT0FBTyxPQUFPLFVBQVU7QUFDN0IsYUFBSyxLQUFLLE9BQU8sa0JBQWtCLFVBQVU7QUFBQSxNQUMvQztBQUFBLElBQ0Y7QUFFQSxlQUFXLGFBQWEsQ0FBQyxHQUFHLEtBQUssZUFBZSxHQUFHO0FBQ2pELFVBQUksVUFBVSxXQUFXLEdBQUcsV0FBVyxJQUFJLElBQUksS0FBSyxDQUFDLGNBQWMsSUFBSSxTQUFTLEdBQUc7QUFDakYsYUFBSyxnQkFBZ0IsT0FBTyxTQUFTO0FBQ3JDLGFBQUssS0FBSyxPQUFPLGtCQUFrQixTQUFTO0FBQUEsTUFDOUM7QUFBQSxJQUNGO0FBRUEsU0FBSyxvQkFBb0I7QUFFekIsZUFBVyxNQUFNLGdCQUFnQjtBQUMvQixZQUFNLFFBQVEsS0FBSyxPQUFPLElBQUksRUFBRTtBQUNoQyxVQUFJLE9BQU87QUFDVCxhQUFLLGFBQWEsS0FBSztBQUFBLE1BQ3pCO0FBQUEsSUFDRjtBQUVBLFVBQU0sS0FBSyxXQUFXO0FBQUEsRUFDeEI7QUFBQSxFQUVRLHdCQUF3QixTQUFpQixVQUErQztBQUM5RixVQUFNLFFBQVEsUUFBUSxNQUFNLE9BQU87QUFDbkMsVUFBTSxlQUFlLG9CQUFJLElBQW9CO0FBRTdDLGVBQVcsV0FBVyxVQUFVO0FBQzlCLFlBQU0sWUFBWSxRQUFRLFVBQVUsTUFBTSxRQUFRO0FBQ2xELFVBQUksWUFBWSxLQUFLLGFBQWEsTUFBTSxPQUFRO0FBRWhELFlBQU0sT0FBTyxNQUFNLFNBQVM7QUFDNUIsWUFBTSxRQUFRLEtBQUssTUFBTSx3QkFBd0I7QUFDakQsVUFBSSxDQUFDLE1BQU87QUFFWixZQUFNLE1BQU0sTUFBTSxDQUFDLEVBQUUsUUFBUSxhQUFhLEVBQUUsRUFBRSxLQUFLO0FBQ25ELG1CQUFhLElBQUksV0FBVyxJQUFJLFNBQVMsSUFBSSxNQUFNLFFBQVEsT0FBTztBQUFBLElBQ3BFO0FBRUEsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVBLE1BQWMsYUFBNEI7QUFDeEMsU0FBSyxPQUFPLE1BQU07QUFDbEIsU0FBSyxZQUFZLE1BQU07QUFFdkIsUUFBSSxLQUFLLGtCQUFrQixXQUFXLEdBQUc7QUFDdkMsV0FBSyxhQUFhLFFBQVEsUUFBUSxLQUFLO0FBQ3ZDLFdBQUssYUFBYSxRQUFRLGNBQWMsc0NBQXNDO0FBQzlFLFdBQUssYUFBYSxLQUFLO0FBQ3ZCO0FBQUEsSUFDRjtBQUVBLFNBQUssYUFBYSxLQUFLO0FBRXZCLGVBQVcsTUFBTSxLQUFLLG1CQUFtQjtBQUN2QyxZQUFNLFFBQVEsS0FBSyxPQUFPLElBQUksRUFBRTtBQUNoQyxVQUFJLENBQUMsTUFBTztBQUVaLFlBQU0sT0FBTyxLQUFLLE9BQU8sVUFBVSxFQUFFLEtBQUssZ0JBQWdCLENBQUM7QUFDM0QsWUFBTSxVQUFVLEtBQUssVUFBVSxFQUFFLEtBQUssc0JBQXNCLENBQUM7QUFDN0QsWUFBTSxLQUFLLG1CQUFtQixTQUFTLE1BQU0sS0FBSztBQUVsRCxZQUFNLFVBQVUsS0FBSyxVQUFVLEVBQUUsS0FBSyxrQkFBa0IsTUFBTSxlQUFlLEtBQUssV0FBVyxLQUFLLENBQUMsRUFBRSxDQUFDO0FBRXRHLFlBQU0sV0FBVyxLQUFLLFVBQVUsRUFBRSxLQUFLLG9CQUFvQixDQUFDO0FBRTVELFlBQU0sY0FBYyxTQUFTLFNBQVMsVUFBVTtBQUFBLFFBQzlDLEtBQUs7QUFBQSxRQUNMLE1BQU0sTUFBTSxVQUFVLFFBQVEsUUFBUSxRQUFRO0FBQUEsTUFDaEQsQ0FBQztBQUNELGtCQUFZLFFBQVEsY0FBYyxNQUFNLFVBQVUsZ0JBQWdCLGFBQWE7QUFDL0Usa0JBQVksUUFBUSxTQUFTLE1BQU0sVUFBVSxnQkFBZ0IsYUFBYTtBQUUxRSxZQUFNLFlBQVksU0FBUyxTQUFTLFVBQVU7QUFBQSxRQUM1QyxLQUFLO0FBQUEsUUFDTCxNQUFNLFFBQVE7QUFBQSxNQUNoQixDQUFDO0FBQ0QsZ0JBQVUsUUFBUSxjQUFjLHVCQUF1QjtBQUV2RCxZQUFNLFdBQVcsU0FBUyxTQUFTLFVBQVU7QUFBQSxRQUMzQyxLQUFLO0FBQUEsUUFDTCxNQUFNLFFBQVE7QUFBQSxNQUNoQixDQUFDO0FBQ0QsZUFBUyxRQUFRLGNBQWMsYUFBYTtBQUM1QyxlQUFTLFFBQVEsU0FBUyxhQUFhO0FBRXZDLFlBQU0sWUFBWSxTQUFTLFNBQVMsVUFBVTtBQUFBLFFBQzVDLEtBQUs7QUFBQSxRQUNMLE1BQU0sUUFBUTtBQUFBLE1BQ2hCLENBQUM7QUFDRCxnQkFBVSxRQUFRLGNBQWMsY0FBYztBQUM5QyxnQkFBVSxRQUFRLFNBQVMsY0FBYztBQUV6QyxrQkFBWSxpQkFBaUIsU0FBUyxNQUFNO0FBQzFDLFlBQUksTUFBTSxTQUFTO0FBQ2pCLGVBQUssV0FBVyxNQUFNLEVBQUU7QUFBQSxRQUMxQixPQUFPO0FBQ0wsZUFBSyxXQUFXLE1BQU0sRUFBRTtBQUFBLFFBQzFCO0FBQUEsTUFDRixDQUFDO0FBRUQsZ0JBQVUsaUJBQWlCLFNBQVMsTUFBTTtBQUN4QyxhQUFLLG9CQUFvQixNQUFNLEVBQUU7QUFBQSxNQUNuQyxDQUFDO0FBRUQsZUFBUyxpQkFBaUIsU0FBUyxNQUFNO0FBQ3ZDLGFBQUssV0FBVyxNQUFNLEVBQUU7QUFBQSxNQUMxQixDQUFDO0FBRUQsZ0JBQVUsaUJBQWlCLFNBQVMsTUFBTTtBQUN4QyxZQUFJLEtBQUssY0FBYyxvQkFBb0IsR0FBRztBQUM1QyxlQUFLLFlBQVksTUFBTSxFQUFFO0FBQUEsUUFDM0I7QUFBQSxNQUNGLENBQUM7QUFFRCxXQUFLLFlBQVksSUFBSSxNQUFNLElBQUksRUFBRSxRQUFRLE1BQU0sU0FBUyxhQUFhLFdBQVcsU0FBUyxDQUFDO0FBQUEsSUFDNUY7QUFFQSxTQUFLLG9CQUFvQjtBQUFBLEVBQzNCO0FBQUEsRUFFUSxXQUFXLE9BQTJCO0FBQzVDLFFBQUksQ0FBQyxNQUFNLFdBQVcsTUFBTSxjQUFjLE1BQU07QUFDOUMsYUFBTyxNQUFNO0FBQUEsSUFDZjtBQUVBLFdBQU8sTUFBTSxhQUFhLEtBQUssSUFBSSxJQUFJLE1BQU07QUFBQSxFQUMvQztBQUFBLEVBRVEsV0FBVyxJQUFrQjtBQUNuQyxVQUFNLFFBQVEsS0FBSyxPQUFPLElBQUksRUFBRTtBQUNoQyxRQUFJLENBQUMsU0FBUyxNQUFNLFFBQVM7QUFFN0IsVUFBTSxVQUFVO0FBQ2hCLFVBQU0sWUFBWSxLQUFLLElBQUk7QUFDM0IsU0FBSyxhQUFhLEtBQUs7QUFDdkIsU0FBSyxvQkFBb0I7QUFBQSxFQUMzQjtBQUFBLEVBRVEsV0FBVyxJQUFrQjtBQUNuQyxVQUFNLFFBQVEsS0FBSyxPQUFPLElBQUksRUFBRTtBQUNoQyxRQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sUUFBUztBQUU5QixVQUFNLFlBQVksS0FBSyxXQUFXLEtBQUs7QUFDdkMsVUFBTSxVQUFVO0FBQ2hCLFVBQU0sWUFBWTtBQUNsQixTQUFLLGFBQWEsS0FBSztBQUN2QixTQUFLLG9CQUFvQjtBQUFBLEVBQzNCO0FBQUEsRUFFUSxXQUFXLElBQWtCO0FBQ25DLFVBQU0sUUFBUSxLQUFLLE9BQU8sSUFBSSxFQUFFO0FBQ2hDLFFBQUksQ0FBQyxNQUFPO0FBRVosVUFBTSxZQUFZO0FBQ2xCLFVBQU0sVUFBVTtBQUNoQixVQUFNLFlBQVk7QUFDbEIsU0FBSyxhQUFhLEtBQUs7QUFDdkIsU0FBSyxvQkFBb0I7QUFBQSxFQUMzQjtBQUFBLEVBRVEsb0JBQW9CLElBQWtCO0FBQzVDLFVBQU0sUUFBUSxLQUFLLE9BQU8sSUFBSSxFQUFFO0FBQ2hDLFFBQUksQ0FBQyxNQUFPO0FBRVosUUFBSSxnQkFBZ0IsS0FBSyxLQUFLLE1BQU0sVUFBVSxDQUFDLGdCQUFnQjtBQUM3RCxZQUFNLFdBQVc7QUFDakIsV0FBSyxhQUFhLEtBQUs7QUFDdkIsV0FBSyxvQkFBb0I7QUFBQSxJQUMzQixDQUFDLEVBQUUsS0FBSztBQUFBLEVBQ1Y7QUFBQSxFQUVRLFlBQVksSUFBa0I7QUFDcEMsVUFBTSxRQUFRLEtBQUssT0FBTyxJQUFJLEVBQUU7QUFDaEMsU0FBSyxnQkFBZ0IsSUFBSSxFQUFFO0FBQzNCLFNBQUssT0FBTyxPQUFPLEVBQUU7QUFDckIsU0FBSyxLQUFLLE9BQU8saUJBQWlCLElBQUksT0FBTyxTQUFTLElBQUksT0FBTyxZQUFZLE1BQU0sT0FBTyxhQUFhLENBQUM7QUFDeEcsU0FBSyxvQkFBb0IsS0FBSyxrQkFBa0IsT0FBTyxDQUFDLGNBQWMsY0FBYyxFQUFFO0FBQ3RGLFNBQUssS0FBSyxXQUFXO0FBQUEsRUFDdkI7QUFBQSxFQUVRLGtCQUF3QjtBQUM5QixVQUFNLFdBQVcsS0FBSztBQUN0QixTQUFLLE9BQU8sTUFBTTtBQUNsQixTQUFLLGdCQUFnQixNQUFNO0FBQzNCLFFBQUksVUFBVTtBQUNaLFdBQUssS0FBSyxPQUFPLGdCQUFnQixRQUFRO0FBQUEsSUFDM0M7QUFDQSxTQUFLLEtBQUssc0JBQXNCO0FBQUEsRUFDbEM7QUFBQSxFQUVRLGNBQWMsU0FBMEI7QUFDOUMsV0FBTyxPQUFPLFFBQVEsT0FBTztBQUFBLEVBQy9CO0FBQ0Y7QUEzVk0saUJBV29CLG1CQUFtQjtBQWtWN0MsSUFBTSxrQkFBTixjQUE4QixzQkFBTTtBQUFBLEVBR2xDLFlBQ0UsS0FDaUIsaUJBQ0EsVUFDakI7QUFDQSxVQUFNLEdBQUc7QUFIUTtBQUNBO0FBR2pCLFNBQUssYUFBYSxvQkFBb0IsT0FBTyxNQUFNLGtCQUFrQixLQUFPLFNBQVM7QUFBQSxFQUN2RjtBQUFBLEVBRUEsU0FBZTtBQUNiLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyxNQUFNLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUVwRCxRQUFJLHdCQUFRLFNBQVMsRUFDbEIsUUFBUSxrQkFBa0IsRUFDMUIsUUFBUSw2RUFBNkUsRUFDckYsUUFBUSxDQUFDLFNBQVM7QUFDakIsV0FBSyxTQUFTLEtBQUssVUFBVTtBQUM3QixXQUFLLFFBQVEsYUFBYSxRQUFRLFFBQVE7QUFDMUMsV0FBSyxRQUFRLGFBQWEsT0FBTyxHQUFHO0FBQ3BDLFdBQUssUUFBUSxhQUFhLFFBQVEsS0FBSztBQUN2QyxXQUFLLFFBQVEsTUFBTSxRQUFRO0FBQzNCLFdBQUssU0FBUyxDQUFDLFVBQVU7QUFDdkIsYUFBSyxhQUFhO0FBQUEsTUFDcEIsQ0FBQztBQUVELFdBQUssUUFBUSxpQkFBaUIsV0FBVyxDQUFDLFFBQVE7QUFDaEQsWUFBSSxJQUFJLFFBQVEsU0FBUztBQUN2QixlQUFLLE9BQU87QUFBQSxRQUNkO0FBQUEsTUFDRixDQUFDO0FBRUQsYUFBTyxXQUFXLE1BQU0sS0FBSyxRQUFRLE1BQU0sR0FBRyxFQUFFO0FBQUEsSUFDbEQsQ0FBQztBQUVILFVBQU0sU0FBUyxVQUFVLFVBQVUsRUFBRSxLQUFLLHlCQUF5QixDQUFDO0FBQ3BFLFdBQU8sU0FBUyxVQUFVLEVBQUUsTUFBTSxnQkFBZ0IsS0FBSyxjQUFjLENBQUMsRUFBRSxpQkFBaUIsU0FBUyxNQUFNO0FBQ3RHLFdBQUssU0FBUyxJQUFJO0FBQ2xCLFdBQUssTUFBTTtBQUFBLElBQ2IsQ0FBQztBQUNELFdBQU8sU0FBUyxVQUFVLEVBQUUsTUFBTSxRQUFRLEtBQUssVUFBVSxDQUFDLEVBQUUsaUJBQWlCLFNBQVMsTUFBTTtBQUMxRixXQUFLLE9BQU87QUFBQSxJQUNkLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUSxTQUFlO0FBQ3JCLFVBQU0sYUFBYSxLQUFLLFdBQVcsS0FBSyxFQUFFLFFBQVEsS0FBSyxHQUFHO0FBQzFELFFBQUksQ0FBQyxZQUFZO0FBQ2YsV0FBSyxTQUFTLElBQUk7QUFDbEIsV0FBSyxNQUFNO0FBQ1g7QUFBQSxJQUNGO0FBQ0EsVUFBTSxVQUFVLE9BQU8sVUFBVTtBQUNqQyxRQUFJLENBQUMsT0FBTyxTQUFTLE9BQU8sS0FBSyxXQUFXLEdBQUc7QUFDN0MsWUFBTSxVQUFVLEtBQUssVUFBVSxjQUFjLGtCQUFrQixNQUE0QixNQUFNO0FBQy9GLGNBQU0sS0FBSyxLQUFLLFVBQVUsU0FBUyxLQUFLLEVBQUUsS0FBSyxrQkFBa0IsQ0FBQztBQUNsRSxXQUFHLE1BQU0sUUFBUTtBQUNqQixlQUFPO0FBQUEsTUFDVCxHQUFHO0FBQ0gsY0FBUSxRQUFRLHFDQUFxQztBQUNyRDtBQUFBLElBQ0Y7QUFDQSxTQUFLLFNBQVMsS0FBSyxNQUFNLFVBQVUsS0FBSyxHQUFJLENBQUM7QUFDN0MsU0FBSyxNQUFNO0FBQUEsRUFDYjtBQUFBLEVBRUEsVUFBZ0I7QUFDZCxTQUFLLFVBQVUsTUFBTTtBQUFBLEVBQ3ZCO0FBQUEsRUFFUSxzQkFBNEI7QUFDbEMsZUFBVyxNQUFNLEtBQUssbUJBQW1CO0FBQ3ZDLFlBQU0sUUFBUSxLQUFLLE9BQU8sSUFBSSxFQUFFO0FBQ2hDLFlBQU0sS0FBSyxLQUFLLFlBQVksSUFBSSxFQUFFO0FBQ2xDLFVBQUksQ0FBQyxTQUFTLENBQUMsR0FBSTtBQUVuQixTQUFHLFFBQVEsUUFBUSxlQUFlLEtBQUssV0FBVyxLQUFLLENBQUMsQ0FBQztBQUN6RCxTQUFHLFlBQVksUUFBUSxNQUFNLFVBQVUsUUFBUSxRQUFRLFFBQVEsSUFBSTtBQUNuRSxTQUFHLFlBQVksUUFBUSxjQUFjLE1BQU0sVUFBVSxnQkFBZ0IsYUFBYTtBQUNsRixTQUFHLFlBQVksUUFBUSxTQUFTLE1BQU0sVUFBVSxnQkFBZ0IsYUFBYTtBQUU3RSxZQUFNLGdCQUFnQixNQUFNLGFBQWEsT0FBTyxNQUFNLE1BQU0sV0FBVyxLQUFPLFFBQVEsQ0FBQyxFQUFFLFFBQVEsUUFBUSxFQUFFO0FBQzNHLFNBQUcsVUFBVTtBQUFBLFFBQ1g7QUFBQSxRQUNBLE1BQU0sYUFBYSxPQUFPLDBCQUEwQixXQUFXLGFBQWE7QUFBQSxNQUM5RTtBQUVBLFlBQU0sVUFBVSxLQUFLLFdBQVcsS0FBSztBQUNyQyxZQUFNLFlBQVksTUFBTSxhQUFhO0FBQ3JDLFlBQU0sZUFBZSxhQUFhLFdBQVcsTUFBTSxZQUFZO0FBRS9ELFNBQUcsT0FBTyxZQUFZLDBCQUEwQiwwQkFBMEIsZ0NBQWdDO0FBQzFHLFNBQUcsUUFBUSxZQUFZLCtCQUErQiwyQkFBMkI7QUFFakYsVUFBSSxNQUFNLFdBQVcsY0FBYztBQUNqQyxXQUFHLE9BQU8sU0FBUyxnQ0FBZ0M7QUFDbkQsV0FBRyxRQUFRLFNBQVMsNkJBQTZCO0FBQUEsTUFDbkQsV0FBVyxNQUFNLFNBQVM7QUFDeEIsV0FBRyxPQUFPLFNBQVMsd0JBQXdCO0FBQUEsTUFDN0MsV0FBVyxVQUFVLEdBQUc7QUFDdEIsV0FBRyxPQUFPLFNBQVMsd0JBQXdCO0FBQUEsTUFDN0M7QUFFQSxVQUFJLENBQUMsTUFBTSxXQUFXLFdBQVc7QUFDL0IsWUFBSSxjQUFjO0FBQ2hCLGFBQUcsUUFBUSxTQUFTLDZCQUE2QjtBQUFBLFFBQ25ELE9BQU87QUFDTCxhQUFHLFFBQVEsU0FBUywyQkFBMkI7QUFBQSxRQUNqRDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBRVEsYUFBYSxPQUF5QjtBQUM1QyxVQUFNLFVBQVUsS0FBSyxXQUFXLEtBQUs7QUFDckMsU0FBSyxLQUFLLE9BQU8sa0JBQWtCLE1BQU0sSUFBSTtBQUFBLE1BQzNDLE9BQU8sTUFBTTtBQUFBLE1BQ2IsV0FBVztBQUFBLE1BQ1gsVUFBVSxNQUFNO0FBQUEsTUFDaEIsU0FBUztBQUFBLElBQ1gsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVBLE1BQWMsaUJBQWlCLGVBQXVDO0FBQ3BFLFVBQU0sVUFBMkIsQ0FBQztBQUVsQyxlQUFXLFNBQVMsS0FBSyxPQUFPLE9BQU8sR0FBRztBQUN4QyxVQUFJLFVBQVUsS0FBSyxXQUFXLEtBQUs7QUFDbkMsVUFBSSxpQkFBaUIsTUFBTSxTQUFTO0FBQ2xDLGNBQU0sWUFBWTtBQUNsQixjQUFNLFVBQVU7QUFDaEIsY0FBTSxZQUFZO0FBQUEsTUFDcEIsV0FBVyxDQUFDLE1BQU0sU0FBUztBQUN6QixrQkFBVSxNQUFNO0FBQUEsTUFDbEI7QUFFQSxjQUFRO0FBQUEsUUFDTixLQUFLLE9BQU8sa0JBQWtCLE1BQU0sSUFBSTtBQUFBLFVBQ3RDLE9BQU8sTUFBTTtBQUFBLFVBQ2IsV0FBVztBQUFBLFVBQ1gsVUFBVSxNQUFNO0FBQUEsVUFDaEIsU0FBUztBQUFBLFFBQ1gsQ0FBQztBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBRUEsVUFBTSxRQUFRLElBQUksT0FBTztBQUFBLEVBQzNCO0FBQUEsRUFFUSwwQkFBZ0M7QUFDdEMsZUFBVyxTQUFTLEtBQUssT0FBTyxPQUFPLEdBQUc7QUFDeEMsVUFBSSxNQUFNLFNBQVM7QUFDakIsYUFBSyxhQUFhLEtBQUs7QUFBQSxNQUN6QjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFjLG1CQUFtQixTQUFzQixVQUFpQztBQUN0RixVQUFNLGFBQWEsU0FBUyxjQUFjLEtBQUs7QUFDL0MsVUFBTSxpQ0FBaUIsT0FBTyxLQUFLLEtBQUssVUFBVSxZQUFZLEtBQUssbUJBQW1CLElBQUksSUFBSTtBQUM5RixTQUFLLDRCQUE0QixZQUFZLFFBQVE7QUFFckQsVUFBTSxTQUFTLFdBQVcsZUFBZSxJQUFJLFFBQVEsUUFBUSxHQUFHLEVBQUUsS0FBSztBQUN2RSxRQUFJLE1BQU0sU0FBUyxpQkFBaUIsa0JBQWtCO0FBQ3BELFdBQUssd0JBQXdCLFlBQVksaUJBQWlCLGdCQUFnQjtBQUMxRSxjQUFRLFFBQVEsU0FBUyxLQUFLO0FBQzlCLGNBQVEsUUFBUSxjQUFjLEtBQUs7QUFBQSxJQUNyQztBQUVBLFlBQVEsTUFBTTtBQUNkLFdBQU8sV0FBVyxZQUFZO0FBQzVCLGNBQVEsWUFBWSxXQUFXLFVBQVU7QUFBQSxJQUMzQztBQUFBLEVBQ0Y7QUFBQSxFQUVRLDRCQUE0QixhQUEwQixVQUF3QjtBQUNwRixVQUFNLGFBQWEsU0FBUyxjQUFjLEtBQUs7QUFDL0MsZUFBVyxZQUFZO0FBRXZCLFVBQU0saUJBQWlCLE1BQU0sS0FBSyxXQUFXLGlCQUFpQixHQUFHLENBQUMsRUFBRSxPQUFPLENBQUMsWUFBWTtBQUN0RixZQUFNLGlCQUFpQixRQUFRLGtCQUFrQjtBQUNqRCxhQUFPLGVBQWUsU0FBUztBQUFBLElBQ2pDLENBQUM7QUFDRCxTQUFLLHdCQUF3QixnQkFBZ0IsV0FBVztBQUFBLEVBQzFEO0FBQUEsRUFFUSx3QkFBd0IsZ0JBQTJCLGFBQWdDO0FBQ3pGLFVBQU0sY0FBYyxvQkFBSSxJQUFhO0FBRXJDLGVBQVcsWUFBWSxnQkFBZ0I7QUFDckMsWUFBTSxhQUFhLFNBQVMsYUFBYSxRQUFRLFFBQVEsR0FBRyxFQUFFLEtBQUs7QUFDbkUsVUFBSSxDQUFDLFdBQVk7QUFFakIsWUFBTSxtQkFBbUIsTUFBTSxLQUFLLFlBQVksaUJBQWlCLFNBQVMsUUFBUSxZQUFZLENBQUMsQ0FBQztBQUNoRyxZQUFNLFdBQVcsaUJBQWlCLEtBQUssQ0FBQyxjQUFjO0FBQ3BELFlBQUksWUFBWSxJQUFJLFNBQVMsR0FBRztBQUM5QixpQkFBTztBQUFBLFFBQ1Q7QUFFQSxjQUFNLGdCQUFnQixVQUFVLGFBQWEsUUFBUSxRQUFRLEdBQUcsRUFBRSxLQUFLO0FBQ3ZFLGVBQU8sa0JBQWtCO0FBQUEsTUFDM0IsQ0FBQztBQUVELFVBQUksQ0FBQyxTQUFVO0FBRWYsa0JBQVksSUFBSSxRQUFRO0FBQ3hCLGlCQUFXLFFBQVEsU0FBUyxrQkFBa0IsR0FBRztBQUMvQyxpQkFBUyxhQUFhLE1BQU0sU0FBUyxhQUFhLElBQUksS0FBSyxFQUFFO0FBQUEsTUFDL0Q7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBRVEsd0JBQXdCLGFBQTBCLFdBQXlCO0FBQ2pGLFVBQU0sU0FBUyxTQUFTLGlCQUFpQixhQUFhLFdBQVcsU0FBUztBQUMxRSxVQUFNLFlBQW9CLENBQUM7QUFFM0IsV0FBTyxPQUFPLFNBQVMsR0FBRztBQUN4QixnQkFBVSxLQUFLLE9BQU8sV0FBbUI7QUFBQSxJQUMzQztBQUVBLFFBQUksYUFBYTtBQUNqQixRQUFJLGVBQWU7QUFFbkIsZUFBVyxZQUFZLFdBQVc7QUFDaEMsWUFBTSxhQUFhLFNBQVMsYUFBYSxRQUFRLFFBQVEsR0FBRyxLQUFLO0FBQ2pFLFVBQUksQ0FBQyxXQUFXLEtBQUssR0FBRztBQUN0QixZQUFJLGNBQWM7QUFDaEIsbUJBQVMsY0FBYztBQUFBLFFBQ3pCO0FBQ0E7QUFBQSxNQUNGO0FBRUEsVUFBSSxjQUFjO0FBQ2hCLGlCQUFTLGNBQWM7QUFDdkI7QUFBQSxNQUNGO0FBRUEsWUFBTSxZQUFZLFlBQVk7QUFDOUIsVUFBSSxXQUFXLFVBQVUsV0FBVztBQUNsQyxzQkFBYyxXQUFXO0FBQ3pCLGlCQUFTLGNBQWM7QUFDdkI7QUFBQSxNQUNGO0FBRUEsWUFBTSxjQUFjLEtBQUssSUFBSSxHQUFHLFlBQVksQ0FBQztBQUM3QyxZQUFNLGdCQUFnQixHQUFHLFdBQVcsTUFBTSxHQUFHLFdBQVcsRUFBRSxRQUFRLENBQUM7QUFDbkUsZUFBUyxjQUFjO0FBQ3ZCLHFCQUFlO0FBQ2YsbUJBQWE7QUFBQSxJQUNmO0FBRUEsU0FBSyxpQkFBaUIsV0FBVztBQUFBLEVBQ25DO0FBQUEsRUFFUSxpQkFBaUIsUUFBMkI7QUFDbEQsVUFBTSxhQUFhLE1BQU0sS0FBSyxPQUFPLFVBQVU7QUFFL0MsZUFBVyxhQUFhLFlBQVk7QUFDbEMsVUFBSSxVQUFVLGFBQWEsS0FBSyxXQUFXO0FBQ3pDLFlBQUksRUFBRSxVQUFVLGVBQWUsSUFBSSxLQUFLLEdBQUc7QUFDekMsb0JBQVUsT0FBTztBQUFBLFFBQ25CO0FBQ0E7QUFBQSxNQUNGO0FBRUEsVUFBSSxxQkFBcUIsYUFBYTtBQUNwQyxhQUFLLGlCQUFpQixTQUFTO0FBQy9CLGNBQU0scUJBQXFCLFVBQVUsZUFBZSxJQUFJLEtBQUssRUFBRSxTQUFTO0FBQ3hFLGNBQU0scUJBQXFCLFVBQVUsU0FBUyxTQUFTO0FBQ3ZELFlBQUksQ0FBQyxxQkFBcUIsQ0FBQyxvQkFBb0I7QUFDN0Msb0JBQVUsT0FBTztBQUFBLFFBQ25CO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0Y7QUFFQSxJQUFxQixxQkFBckIsY0FBZ0QsdUJBQU87QUFBQSxFQUF2RDtBQUFBO0FBQ0UsU0FBUSxVQUE0QixFQUFFLFNBQVMsaUJBQWlCLFFBQVEsQ0FBQyxFQUFFO0FBQzNFLFNBQVEsYUFBNEI7QUFBQTtBQUFBLEVBRXBDLE1BQU0sU0FBd0I7QUFDNUIsU0FBSyxVQUFVLEtBQUsscUJBQXFCLE1BQU0sS0FBSyxTQUFTLENBQUM7QUFDOUQsUUFBSSxLQUFLLGVBQWUsR0FBRztBQUN6QixZQUFNLEtBQUssU0FBUyxLQUFLLE9BQU87QUFBQSxJQUNsQztBQUVBLFNBQUssYUFBYSx5QkFBeUIsQ0FBQyxTQUFTLElBQUksaUJBQWlCLE1BQU0sSUFBSSxDQUFDO0FBRXJGLFNBQUssY0FBYyxTQUFTLHlCQUF5QixNQUFNO0FBQ3pELFdBQUssS0FBSyxhQUFhO0FBQUEsSUFDekIsQ0FBQztBQUVELFNBQUssV0FBVztBQUFBLE1BQ2QsSUFBSTtBQUFBLE1BQ0osTUFBTTtBQUFBLE1BQ04sVUFBVSxZQUFZO0FBQ3BCLGNBQU0sS0FBSyxhQUFhO0FBQUEsTUFDMUI7QUFBQSxJQUNGLENBQUM7QUFFRCxTQUFLLElBQUksVUFBVSxjQUFjLE1BQU07QUFDckMsV0FBSyxLQUFLLGFBQWE7QUFBQSxJQUN6QixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRUEsV0FBaUI7QUFDZixRQUFJLEtBQUssZUFBZSxNQUFNO0FBQzVCLGFBQU8sYUFBYSxLQUFLLFVBQVU7QUFDbkMsV0FBSyxhQUFhO0FBQ2xCLFdBQUssS0FBSyxTQUFTLEtBQUssT0FBTztBQUFBLElBQ2pDO0FBQ0EsU0FBSyxJQUFJLFVBQVUsbUJBQW1CLHVCQUF1QjtBQUFBLEVBQy9EO0FBQUEsRUFFQSxlQUFlLElBQTBDO0FBQ3ZELFdBQU8sS0FBSyxRQUFRLE9BQU8sRUFBRTtBQUFBLEVBQy9CO0FBQUEsRUFFQSwwQkFBMEIsVUFBK0I7QUFDdkQsVUFBTSxhQUFhLG9CQUFJLElBQVk7QUFDbkMsVUFBTSxTQUFTLEdBQUcsUUFBUTtBQUUxQixlQUFXLENBQUMsSUFBSSxLQUFLLEtBQUssT0FBTyxRQUFRLEtBQUssUUFBUSxNQUFNLEdBQUc7QUFDN0QsVUFBSSxHQUFHLFdBQVcsTUFBTSxLQUFLLE1BQU0sU0FBUztBQUMxQyxtQkFBVyxJQUFJLEVBQUU7QUFBQSxNQUNuQjtBQUFBLElBQ0Y7QUFFQSxXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsTUFBTSxrQkFDSixJQUNBLE9BQ2U7QUFDZixTQUFLLFFBQVEsT0FBTyxFQUFFLElBQUk7QUFBQSxNQUN4QixPQUFPLE1BQU07QUFBQSxNQUNiLFdBQVcsS0FBSyxJQUFJLEdBQUcsS0FBSyxNQUFNLE1BQU0sU0FBUyxDQUFDO0FBQUEsTUFDbEQsVUFBVSxNQUFNO0FBQUEsTUFDaEIsU0FBUyxNQUFNO0FBQUEsTUFDZixXQUFXLEtBQUssSUFBSTtBQUFBLElBQ3RCO0FBRUEsU0FBSyxhQUFhO0FBQUEsRUFDcEI7QUFBQSxFQUVBLE1BQU0saUJBQWlCLElBQVksT0FBZSxVQUF5QixXQUFrQztBQUMzRyxTQUFLLFFBQVEsT0FBTyxFQUFFLElBQUk7QUFBQSxNQUN4QjtBQUFBLE1BQ0EsV0FBVyxLQUFLLElBQUksR0FBRyxLQUFLLE1BQU0sU0FBUyxDQUFDO0FBQUEsTUFDNUM7QUFBQSxNQUNBLFNBQVM7QUFBQSxNQUNULFdBQVcsS0FBSyxJQUFJO0FBQUEsSUFDdEI7QUFFQSxTQUFLLGFBQWE7QUFBQSxFQUNwQjtBQUFBLEVBRUEsTUFBTSxrQkFBa0IsSUFBMkI7QUFDakQsUUFBSSxFQUFFLE1BQU0sS0FBSyxRQUFRLFNBQVM7QUFDaEM7QUFBQSxJQUNGO0FBRUEsV0FBTyxLQUFLLFFBQVEsT0FBTyxFQUFFO0FBQzdCLFNBQUssYUFBYTtBQUFBLEVBQ3BCO0FBQUEsRUFFQSxNQUFNLGdCQUFnQixVQUFpQztBQUNyRCxVQUFNLFNBQVMsR0FBRyxRQUFRO0FBQzFCLFFBQUksVUFBVTtBQUVkLGVBQVcsTUFBTSxPQUFPLEtBQUssS0FBSyxRQUFRLE1BQU0sR0FBRztBQUNqRCxVQUFJLEdBQUcsV0FBVyxNQUFNLEdBQUc7QUFDekIsZUFBTyxLQUFLLFFBQVEsT0FBTyxFQUFFO0FBQzdCLGtCQUFVO0FBQUEsTUFDWjtBQUFBLElBQ0Y7QUFFQSxRQUFJLFNBQVM7QUFDWCxXQUFLLGFBQWE7QUFBQSxJQUNwQjtBQUFBLEVBQ0Y7QUFBQSxFQUVRLHFCQUFxQixLQUFnQztBQUMzRCxVQUFNLFdBQTZCLEVBQUUsU0FBUyxpQkFBaUIsUUFBUSxDQUFDLEVBQUU7QUFDMUUsUUFBSSxDQUFDLE9BQU8sT0FBTyxRQUFRLFVBQVU7QUFDbkMsYUFBTztBQUFBLElBQ1Q7QUFFQSxVQUFNLFlBQVk7QUFDbEIsUUFBSSxDQUFDLFVBQVUsVUFBVSxPQUFPLFVBQVUsV0FBVyxVQUFVO0FBQzdELGFBQU87QUFBQSxJQUNUO0FBRUEsVUFBTSxtQkFBcUQsQ0FBQztBQUM1RCxlQUFXLENBQUMsSUFBSSxLQUFLLEtBQUssT0FBTyxRQUFRLFVBQVUsTUFBTSxHQUFHO0FBQzFELFVBQUksQ0FBQyxTQUFTLE9BQU8sVUFBVSxVQUFVO0FBQ3ZDO0FBQUEsTUFDRjtBQUVBLFlBQU0sUUFBUTtBQUNkLHVCQUFpQixFQUFFLElBQUk7QUFBQSxRQUNyQixPQUFPLE9BQU8sTUFBTSxVQUFVLFdBQVcsTUFBTSxRQUFRO0FBQUEsUUFDdkQsV0FBVyxPQUFPLFNBQVMsTUFBTSxTQUFTLElBQUksS0FBSyxJQUFJLEdBQUcsS0FBSyxNQUFNLE1BQU0sYUFBYSxDQUFDLENBQUMsSUFBSTtBQUFBLFFBQzlGLFVBQ0UsTUFBTSxhQUFhLFFBQVEsTUFBTSxhQUFhLFNBQzFDLE9BQ0EsT0FBTyxTQUFTLE1BQU0sUUFBUSxJQUM1QixLQUFLLElBQUksR0FBRyxLQUFLLE1BQU0sTUFBTSxRQUFRLENBQUMsSUFDdEM7QUFBQSxRQUNSLFNBQVMsUUFBUSxNQUFNLE9BQU87QUFBQSxRQUM5QixXQUNFLE9BQU8sU0FBUyxNQUFNLFNBQVMsTUFBTSxNQUFNLGFBQWEsS0FBSyxJQUN6RCxLQUFLLE1BQU0sTUFBTSxTQUFtQixJQUNwQyxLQUFLLElBQUk7QUFBQSxNQUNqQjtBQUFBLElBQ0Y7QUFFQSxXQUFPO0FBQUEsTUFDTCxTQUFTO0FBQUEsTUFDVCxRQUFRO0FBQUEsSUFDVjtBQUFBLEVBQ0Y7QUFBQSxFQUVRLGlCQUEwQjtBQUNoQyxVQUFNLE1BQU0sS0FBSyxJQUFJO0FBQ3JCLFFBQUksVUFBVTtBQUVkLGVBQVcsQ0FBQyxJQUFJLEtBQUssS0FBSyxPQUFPLFFBQVEsS0FBSyxRQUFRLE1BQU0sR0FBRztBQUM3RCxVQUFJLE1BQU0sTUFBTSxZQUFZLG9CQUFvQjtBQUM5QyxlQUFPLEtBQUssUUFBUSxPQUFPLEVBQUU7QUFDN0Isa0JBQVU7QUFBQSxNQUNaO0FBQUEsSUFDRjtBQUVBLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFUSxlQUFxQjtBQUMzQixRQUFJLEtBQUssZUFBZSxHQUFHO0FBQUEsSUFFM0I7QUFFQSxRQUFJLEtBQUssZUFBZSxNQUFNO0FBQzVCLGFBQU8sYUFBYSxLQUFLLFVBQVU7QUFBQSxJQUNyQztBQUVBLFNBQUssYUFBYSxPQUFPLFdBQVcsTUFBTTtBQUN4QyxXQUFLLGFBQWE7QUFDbEIsV0FBSyxLQUFLLFNBQVMsS0FBSyxPQUFPO0FBQUEsSUFDakMsR0FBRyxHQUFHO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBYyxlQUE4QjtBQUMxQyxVQUFNLGlCQUFpQixLQUFLLElBQUksVUFBVSxnQkFBZ0IsdUJBQXVCO0FBQ2pGLFFBQUksZUFBZSxTQUFTLEdBQUc7QUFDN0IsWUFBTSxLQUFLLElBQUksVUFBVSxXQUFXLGVBQWUsQ0FBQyxDQUFDO0FBQ3JEO0FBQUEsSUFDRjtBQUVBLFVBQU0sT0FBTyxLQUFLLElBQUksVUFBVSxhQUFhLEtBQUs7QUFDbEQsUUFBSSxDQUFDLEtBQU07QUFFWCxVQUFNLEtBQUssYUFBYTtBQUFBLE1BQ3RCLE1BQU07QUFBQSxNQUNOLFFBQVE7QUFBQSxJQUNWLENBQUM7QUFFRCxVQUFNLEtBQUssSUFBSSxVQUFVLFdBQVcsSUFBSTtBQUFBLEVBQzFDO0FBQ0Y7IiwKICAibmFtZXMiOiBbXQp9Cg==
