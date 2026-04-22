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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcbiAgQXBwLFxuICBJdGVtVmlldyxcbiAgTWFya2Rvd25SZW5kZXJlcixcbiAgTW9kYWwsXG4gIFBsdWdpbixcbiAgU2V0dGluZyxcbiAgV29ya3NwYWNlTGVhZixcbiAgSGVhZGluZ0NhY2hlXG59IGZyb20gXCJvYnNpZGlhblwiO1xuXG5jb25zdCBWSUVXX1RZUEVfVElNRVJfU0lERUJBUiA9IFwianctdGltZXItc2lkZWJhci12aWV3XCI7XG5jb25zdCBTVE9SQUdFX1ZFUlNJT04gPSAxO1xuY29uc3QgVElNRVJfUkVURU5USU9OX01TID0gMzAgKiAyNCAqIDYwICogNjAgKiAxMDAwO1xuXG5jb25zdCBVSV9URVhUID0ge1xuICB0aXRsZTogXCJcdTIzRjFcdUZFMEZcIixcbiAgZW1wdHk6IFwiXHUyMjA1XCIsXG4gIG9wZW46IFwiXHUyNUI2XHVGRTBGXCIsXG4gIHBhdXNlOiBcIlx1MjNGOFx1RkUwRlwiLFxuICB0YXJnZXQ6IFwiXHVEODNDXHVERkFGXCIsXG4gIHJlc2V0OiBcIlx1RDgzRFx1REQwNFwiLFxuICBkZWxldGU6IFwiXHVEODNEXHVEREQxXHVGRTBGXCIsXG4gIHJlc2V0QWxsOiBcIlx1MjY3Qlx1RkUwRlwiXG59IGFzIGNvbnN0O1xuXG5pbnRlcmZhY2UgVGltZXJFbnRyeSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGVsYXBzZWRNczogbnVtYmVyO1xuICB0YXJnZXRNczogbnVtYmVyIHwgbnVsbDtcbiAgcnVubmluZzogYm9vbGVhbjtcbiAgc3RhcnRlZEF0OiBudW1iZXIgfCBudWxsO1xufVxuXG5pbnRlcmZhY2UgVGltZXJVaVJlZiB7XG4gIGNhcmRFbDogSFRNTEVsZW1lbnQ7XG4gIHRpbWVyRWw6IEhUTUxFbGVtZW50O1xuICBwbGF5U3RvcEJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHRhcmdldEJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHJlc2V0QnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbn1cblxuaW50ZXJmYWNlIFN0b3JlZFRpbWVyU3RhdGUge1xuICB0aXRsZTogc3RyaW5nO1xuICBlbGFwc2VkTXM6IG51bWJlcjtcbiAgdGFyZ2V0TXM6IG51bWJlciB8IG51bGw7XG4gIGRlbGV0ZWQ6IGJvb2xlYW47XG4gIHVwZGF0ZWRBdDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgVGltZXJTdG9yYWdlRGF0YSB7XG4gIHZlcnNpb246IG51bWJlcjtcbiAgdGltZXJzOiBSZWNvcmQ8c3RyaW5nLCBTdG9yZWRUaW1lclN0YXRlPjtcbn1cblxuZnVuY3Rpb24gYnVpbGRUaW1lcklkKGZpbGVQYXRoOiBzdHJpbmcsIGhlYWRpbmc6IEhlYWRpbmdDYWNoZSk6IHN0cmluZyB7XG4gIGNvbnN0IGxpbmUgPSBoZWFkaW5nLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IDA7XG4gIHJldHVybiBgJHtmaWxlUGF0aH06OiR7bGluZX06OiR7aGVhZGluZy5oZWFkaW5nfWA7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdER1cmF0aW9uKG1zOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCB0b3RhbFNlY29uZHMgPSBNYXRoLm1heCgwLCBNYXRoLmZsb29yKG1zIC8gMTAwMCkpO1xuICBjb25zdCBob3VycyA9IE1hdGguZmxvb3IodG90YWxTZWNvbmRzIC8gMzYwMCk7XG4gIGNvbnN0IG1pbnV0ZXMgPSBNYXRoLmZsb29yKCh0b3RhbFNlY29uZHMgJSAzNjAwKSAvIDYwKTtcbiAgY29uc3Qgc2Vjb25kcyA9IHRvdGFsU2Vjb25kcyAlIDYwO1xuXG4gIHJldHVybiBgJHtTdHJpbmcoaG91cnMpLnBhZFN0YXJ0KDIsIFwiMFwiKX06JHtTdHJpbmcobWludXRlcykucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhzZWNvbmRzKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbn1cblxuY2xhc3MgVGltZXJTaWRlYmFyVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgcHJpdmF0ZSB0aW1lcnMgPSBuZXcgTWFwPHN0cmluZywgVGltZXJFbnRyeT4oKTtcbiAgcHJpdmF0ZSBkZWxldGVkVGltZXJJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcHJpdmF0ZSB0aW1lclVpUmVmcyA9IG5ldyBNYXA8c3RyaW5nLCBUaW1lclVpUmVmPigpO1xuICBwcml2YXRlIGN1cnJlbnRIZWFkaW5nSWRzOiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIGN1cnJlbnRGaWxlUGF0aDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbiAgcHJpdmF0ZSBsaXN0RWwhOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBlbXB0eVN0YXRlRWwhOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSB0aWNrSGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBwZXJzaXN0SGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgVElUTEVfTUFYX0xFTkdUSCA9IDYwO1xuXG4gIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHByaXZhdGUgcmVhZG9ubHkgcGx1Z2luOiBUaW1lclNpZGViYXJQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIFZJRVdfVFlQRV9USU1FUl9TSURFQkFSO1xuICB9XG5cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gXCJKVyBUaW1lcnNcIjtcbiAgfVxuXG4gIGdldEljb24oKTogc3RyaW5nIHtcbiAgICByZXR1cm4gXCJ0aW1lclwiO1xuICB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG4gICAgdGhpcy5jb250ZW50RWwuYWRkQ2xhc3MoXCJqdy10aW1lci1zaWRlYmFyLXJvb3RcIik7XG5cbiAgICBjb25zdCB3cmFwcGVyID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLXdyYXBwZXJcIiB9KTtcblxuICAgIGNvbnN0IHRpdGxlRWwgPSB3cmFwcGVyLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBVSV9URVhULnRpdGxlLCBjbHM6IFwianctdGltZXItdGl0bGVcIiB9KTtcbiAgICB0aXRsZUVsLnNldEF0dHIoXCJhcmlhLWxpdmVcIiwgXCJwb2xpdGVcIik7XG4gICAgdGl0bGVFbC5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIlRpbWVycyBieSBoZWFkaW5nXCIpO1xuXG4gICAgdGhpcy5saXN0RWwgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1saXN0XCIgfSk7XG4gICAgdGhpcy5lbXB0eVN0YXRlRWwgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1lbXB0eVwiIH0pO1xuXG4gICAgY29uc3QgZm9vdGVyRWwgPSB3cmFwcGVyLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1mb290ZXJcIiB9KTtcbiAgICBjb25zdCBkZWxldGVBbGxCdG4gPSBmb290ZXJFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICB0ZXh0OiBVSV9URVhULnJlc2V0QWxsLFxuICAgICAgY2xzOiBcImp3LXRpbWVyLWJ0biBqdy10aW1lci1idG4tZGFuZ2VyXCJcbiAgICB9KTtcbiAgICBkZWxldGVBbGxCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJSZXNldCBhbGwgdGltZXJzXCIpO1xuICAgIGRlbGV0ZUFsbEJ0bi5zZXRBdHRyKFwidGl0bGVcIiwgXCJSZXNldCBhbGwgdGltZXJzXCIpO1xuXG4gICAgZGVsZXRlQWxsQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBpZiAodGhpcy5jb25maXJtQWN0aW9uKFwiUmVzZXQgYWxsIHRpbWVycz9cIikpIHtcbiAgICAgICAgdGhpcy5kZWxldGVBbGxUaW1lcnMoKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJhY3RpdmUtbGVhZi1jaGFuZ2VcIiwgKCkgPT4gdm9pZCB0aGlzLnJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpKSk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLm9uKFwiY2hhbmdlZFwiLCAoZmlsZSkgPT4ge1xuICAgICAgICBpZiAoZmlsZS5wYXRoID09PSB0aGlzLmN1cnJlbnRGaWxlUGF0aCkge1xuICAgICAgICAgIHZvaWQgdGhpcy5yZWZyZXNoRnJvbUFjdGl2ZUZpbGUoKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICApO1xuXG4gICAgdGhpcy50aWNrSGFuZGxlID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICAgIH0sIDI1MCk7XG5cbiAgICB0aGlzLnBlcnNpc3RIYW5kbGUgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgdGhpcy5wZXJzaXN0UnVubmluZ1NuYXBzaG90cygpO1xuICAgIH0sIDUwMDApO1xuXG4gICAgdm9pZCB0aGlzLnJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpO1xuICB9XG5cbiAgYXN5bmMgb25DbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy50aWNrSGFuZGxlICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLnRpY2tIYW5kbGUpO1xuICAgICAgdGhpcy50aWNrSGFuZGxlID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMucGVyc2lzdEhhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy5wZXJzaXN0SGFuZGxlKTtcbiAgICAgIHRoaXMucGVyc2lzdEhhbmRsZSA9IG51bGw7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5wZXJzaXN0QWxsVGltZXJzKHRydWUpO1xuXG4gICAgdGhpcy5jb250ZW50RWwucmVtb3ZlQ2xhc3MoXCJqdy10aW1lci1zaWRlYmFyLXJvb3RcIik7XG4gICAgdGhpcy50aW1lclVpUmVmcy5jbGVhcigpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZWZyZXNoRnJvbUFjdGl2ZUZpbGUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cbiAgICBpZiAoIWFjdGl2ZUZpbGUpIHtcbiAgICAgIHRoaXMuY3VycmVudEZpbGVQYXRoID0gbnVsbDtcbiAgICAgIHRoaXMuY3VycmVudEhlYWRpbmdJZHMgPSBbXTtcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyTGlzdCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuY3VycmVudEZpbGVQYXRoID0gYWN0aXZlRmlsZS5wYXRoO1xuICAgIGNvbnN0IGZpbGVDb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChhY3RpdmVGaWxlKTtcbiAgICBjb25zdCBmaWxlQ2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShhY3RpdmVGaWxlKTtcbiAgICBjb25zdCBoZWFkaW5ncyA9IChmaWxlQ2FjaGU/LmhlYWRpbmdzID8/IFtdKS5zbGljZSgpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGNvbnN0IGxpbmVBID0gYS5wb3NpdGlvbj8uc3RhcnQubGluZSA/PyAwO1xuICAgICAgY29uc3QgbGluZUIgPSBiLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IDA7XG4gICAgICByZXR1cm4gbGluZUEgLSBsaW5lQjtcbiAgICB9KTtcbiAgICBjb25zdCByYXdIZWFkaW5nVGl0bGVzID0gdGhpcy5leHRyYWN0UmF3SGVhZGluZ1RpdGxlcyhmaWxlQ29udGVudCwgaGVhZGluZ3MpO1xuICAgIHRoaXMuZGVsZXRlZFRpbWVySWRzID0gdGhpcy5wbHVnaW4uZ2V0RGVsZXRlZFRpbWVySWRzRm9yRmlsZShhY3RpdmVGaWxlLnBhdGgpO1xuXG4gICAgY29uc3QgbmV4dEhlYWRpbmdJZHM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgYWxsSGVhZGluZ0lkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgZm9yIChjb25zdCBoZWFkaW5nIG9mIGhlYWRpbmdzKSB7XG4gICAgICBjb25zdCBpZCA9IGJ1aWxkVGltZXJJZChhY3RpdmVGaWxlLnBhdGgsIGhlYWRpbmcpO1xuICAgICAgYWxsSGVhZGluZ0lkcy5hZGQoaWQpO1xuICAgICAgaWYgKHRoaXMuZGVsZXRlZFRpbWVySWRzLmhhcyhpZCkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGhlYWRpbmdMaW5lID0gaGVhZGluZy5wb3NpdGlvbj8uc3RhcnQubGluZSA/PyAwO1xuICAgICAgY29uc3QgaGVhZGluZ1RpdGxlID0gcmF3SGVhZGluZ1RpdGxlcy5nZXQoaGVhZGluZ0xpbmUpID8/IGhlYWRpbmcuaGVhZGluZztcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICAgIGNvbnN0IHN0b3JlZCA9IHRoaXMucGx1Z2luLmdldFN0b3JlZFRpbWVyKGlkKTtcblxuICAgICAgaWYgKCFleGlzdGluZykge1xuICAgICAgICB0aGlzLnRpbWVycy5zZXQoaWQsIHtcbiAgICAgICAgICBpZCxcbiAgICAgICAgICB0aXRsZTogaGVhZGluZ1RpdGxlLFxuICAgICAgICAgIGVsYXBzZWRNczogc3RvcmVkPy5lbGFwc2VkTXMgPz8gMCxcbiAgICAgICAgICB0YXJnZXRNczogc3RvcmVkPy50YXJnZXRNcyA/PyBudWxsLFxuICAgICAgICAgIHJ1bm5pbmc6IGZhbHNlLFxuICAgICAgICAgIHN0YXJ0ZWRBdDogbnVsbFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGV4aXN0aW5nLnRpdGxlID0gaGVhZGluZ1RpdGxlO1xuICAgICAgICBpZiAoZXhpc3RpbmcudGFyZ2V0TXMgPT09IG51bGwgJiYgc3RvcmVkPy50YXJnZXRNcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZXhpc3RpbmcudGFyZ2V0TXMgPSBzdG9yZWQudGFyZ2V0TXM7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbmV4dEhlYWRpbmdJZHMucHVzaChpZCk7XG4gICAgfVxuXG4gICAgY29uc3QgbmV4dElkc1NldCA9IG5ldyBTZXQobmV4dEhlYWRpbmdJZHMpO1xuICAgIGZvciAoY29uc3QgZXhpc3RpbmdJZCBvZiBbLi4udGhpcy50aW1lcnMua2V5cygpXSkge1xuICAgICAgaWYgKGV4aXN0aW5nSWQuc3RhcnRzV2l0aChgJHthY3RpdmVGaWxlLnBhdGh9OjpgKSAmJiAhbmV4dElkc1NldC5oYXMoZXhpc3RpbmdJZCkpIHtcbiAgICAgICAgdGhpcy50aW1lcnMuZGVsZXRlKGV4aXN0aW5nSWQpO1xuICAgICAgICB2b2lkIHRoaXMucGx1Z2luLnJlbW92ZVN0b3JlZFRpbWVyKGV4aXN0aW5nSWQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3QgZGVsZXRlZElkIG9mIFsuLi50aGlzLmRlbGV0ZWRUaW1lcklkc10pIHtcbiAgICAgIGlmIChkZWxldGVkSWQuc3RhcnRzV2l0aChgJHthY3RpdmVGaWxlLnBhdGh9OjpgKSAmJiAhYWxsSGVhZGluZ0lkcy5oYXMoZGVsZXRlZElkKSkge1xuICAgICAgICB0aGlzLmRlbGV0ZWRUaW1lcklkcy5kZWxldGUoZGVsZXRlZElkKTtcbiAgICAgICAgdm9pZCB0aGlzLnBsdWdpbi5yZW1vdmVTdG9yZWRUaW1lcihkZWxldGVkSWQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuY3VycmVudEhlYWRpbmdJZHMgPSBuZXh0SGVhZGluZ0lkcztcblxuICAgIGZvciAoY29uc3QgaWQgb2YgbmV4dEhlYWRpbmdJZHMpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICAgIGlmIChlbnRyeSkge1xuICAgICAgICB0aGlzLnBlcnNpc3RUaW1lcihlbnRyeSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5yZW5kZXJMaXN0KCk7XG4gIH1cblxuICBwcml2YXRlIGV4dHJhY3RSYXdIZWFkaW5nVGl0bGVzKGNvbnRlbnQ6IHN0cmluZywgaGVhZGluZ3M6IEhlYWRpbmdDYWNoZVtdKTogTWFwPG51bWJlciwgc3RyaW5nPiB7XG4gICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KC9cXHI/XFxuLyk7XG4gICAgY29uc3QgdGl0bGVzQnlMaW5lID0gbmV3IE1hcDxudW1iZXIsIHN0cmluZz4oKTtcblxuICAgIGZvciAoY29uc3QgaGVhZGluZyBvZiBoZWFkaW5ncykge1xuICAgICAgY29uc3QgbGluZUluZGV4ID0gaGVhZGluZy5wb3NpdGlvbj8uc3RhcnQubGluZSA/PyAtMTtcbiAgICAgIGlmIChsaW5lSW5kZXggPCAwIHx8IGxpbmVJbmRleCA+PSBsaW5lcy5sZW5ndGgpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBsaW5lID0gbGluZXNbbGluZUluZGV4XTtcbiAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXlxcc3swLDN9I3sxLDZ9XFxzKyguKikkLyk7XG4gICAgICBpZiAoIW1hdGNoKSBjb250aW51ZTtcblxuICAgICAgY29uc3QgcmF3ID0gbWF0Y2hbMV0ucmVwbGFjZSgvXFxzKyMrXFxzKiQvLCBcIlwiKS50cmltKCk7XG4gICAgICB0aXRsZXNCeUxpbmUuc2V0KGxpbmVJbmRleCwgcmF3Lmxlbmd0aCA+IDAgPyByYXcgOiBoZWFkaW5nLmhlYWRpbmcpO1xuICAgIH1cblxuICAgIHJldHVybiB0aXRsZXNCeUxpbmU7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckxpc3QoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5saXN0RWwuZW1wdHkoKTtcbiAgICB0aGlzLnRpbWVyVWlSZWZzLmNsZWFyKCk7XG5cbiAgICBpZiAodGhpcy5jdXJyZW50SGVhZGluZ0lkcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuZW1wdHlTdGF0ZUVsLnNldFRleHQoVUlfVEVYVC5lbXB0eSk7XG4gICAgICB0aGlzLmVtcHR5U3RhdGVFbC5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIk5vIGhlYWRlcnMgZm91bmQgaW4gdGhlIGN1cnJlbnQgbm90ZVwiKTtcbiAgICAgIHRoaXMuZW1wdHlTdGF0ZUVsLnNob3coKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmVtcHR5U3RhdGVFbC5oaWRlKCk7XG5cbiAgICBmb3IgKGNvbnN0IGlkIG9mIHRoaXMuY3VycmVudEhlYWRpbmdJZHMpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICAgIGlmICghZW50cnkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBjYXJkID0gdGhpcy5saXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNhcmRcIiB9KTtcbiAgICAgIGNvbnN0IHRpdGxlRWwgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jYXJkLXRpdGxlXCIgfSk7XG4gICAgICBhd2FpdCB0aGlzLnJlbmRlclRpdGxlQ29udGVudCh0aXRsZUVsLCBlbnRyeS50aXRsZSk7XG5cbiAgICAgIGNvbnN0IHRpbWVyRWwgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jbG9ja1wiLCB0ZXh0OiBmb3JtYXREdXJhdGlvbih0aGlzLmdldEVsYXBzZWQoZW50cnkpKSB9KTtcblxuICAgICAgY29uc3QgY29udHJvbHMgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jb250cm9sc1wiIH0pO1xuXG4gICAgICBjb25zdCBwbGF5U3RvcEJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgICAgY2xzOiBcImp3LXRpbWVyLWJ0blwiLFxuICAgICAgICB0ZXh0OiBlbnRyeS5ydW5uaW5nID8gVUlfVEVYVC5wYXVzZSA6IFVJX1RFWFQub3BlblxuICAgICAgfSk7XG4gICAgICBwbGF5U3RvcEJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBlbnRyeS5ydW5uaW5nID8gXCJQYXVzZSB0aW1lclwiIDogXCJTdGFydCB0aW1lclwiKTtcbiAgICAgIHBsYXlTdG9wQnRuLnNldEF0dHIoXCJ0aXRsZVwiLCBlbnRyeS5ydW5uaW5nID8gXCJQYXVzZSB0aW1lclwiIDogXCJTdGFydCB0aW1lclwiKTtcblxuICAgICAgY29uc3QgdGFyZ2V0QnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwianctdGltZXItYnRuXCIsXG4gICAgICAgIHRleHQ6IFVJX1RFWFQudGFyZ2V0XG4gICAgICB9KTtcbiAgICAgIHRhcmdldEJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIkNvbmZpZ3VyZSB0YXJnZXQgdGltZVwiKTtcblxuICAgICAgY29uc3QgcmVzZXRCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJqdy10aW1lci1idG5cIixcbiAgICAgICAgdGV4dDogVUlfVEVYVC5yZXNldFxuICAgICAgfSk7XG4gICAgICByZXNldEJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIlJlc2V0IHRpbWVyXCIpO1xuICAgICAgcmVzZXRCdG4uc2V0QXR0cihcInRpdGxlXCIsIFwiUmVzZXQgdGltZXJcIik7XG5cbiAgICAgIGNvbnN0IGRlbGV0ZUJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgICAgY2xzOiBcImp3LXRpbWVyLWJ0biBqdy10aW1lci1idG4tZGFuZ2VyXCIsXG4gICAgICAgIHRleHQ6IFVJX1RFWFQuZGVsZXRlXG4gICAgICB9KTtcbiAgICAgIGRlbGV0ZUJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIkRlbGV0ZSB0aW1lclwiKTtcbiAgICAgIGRlbGV0ZUJ0bi5zZXRBdHRyKFwidGl0bGVcIiwgXCJEZWxldGUgdGltZXJcIik7XG5cbiAgICAgIHBsYXlTdG9wQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIGlmIChlbnRyeS5ydW5uaW5nKSB7XG4gICAgICAgICAgdGhpcy5wYXVzZVRpbWVyKGVudHJ5LmlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnN0YXJ0VGltZXIoZW50cnkuaWQpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGFyZ2V0QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuY29uZmlndXJlVGFyZ2V0VGltZShlbnRyeS5pZCk7XG4gICAgICB9KTtcblxuICAgICAgcmVzZXRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgdGhpcy5yZXNldFRpbWVyKGVudHJ5LmlkKTtcbiAgICAgIH0pO1xuXG4gICAgICBkZWxldGVCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuY29uZmlybUFjdGlvbihcIkRlbGV0ZSB0aGlzIHRpbWVyP1wiKSkge1xuICAgICAgICAgIHRoaXMuZGVsZXRlVGltZXIoZW50cnkuaWQpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGhpcy50aW1lclVpUmVmcy5zZXQoZW50cnkuaWQsIHsgY2FyZEVsOiBjYXJkLCB0aW1lckVsLCBwbGF5U3RvcEJ0biwgdGFyZ2V0QnRuLCByZXNldEJ0biB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0RWxhcHNlZChlbnRyeTogVGltZXJFbnRyeSk6IG51bWJlciB7XG4gICAgaWYgKCFlbnRyeS5ydW5uaW5nIHx8IGVudHJ5LnN0YXJ0ZWRBdCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGVudHJ5LmVsYXBzZWRNcztcbiAgICB9XG5cbiAgICByZXR1cm4gZW50cnkuZWxhcHNlZE1zICsgKERhdGUubm93KCkgLSBlbnRyeS5zdGFydGVkQXQpO1xuICB9XG5cbiAgcHJpdmF0ZSBzdGFydFRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgaWYgKCFlbnRyeSB8fCBlbnRyeS5ydW5uaW5nKSByZXR1cm47XG5cbiAgICBlbnRyeS5ydW5uaW5nID0gdHJ1ZTtcbiAgICBlbnRyeS5zdGFydGVkQXQgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMucGVyc2lzdFRpbWVyKGVudHJ5KTtcbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgcGF1c2VUaW1lcihpZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgIGlmICghZW50cnkgfHwgIWVudHJ5LnJ1bm5pbmcpIHJldHVybjtcblxuICAgIGVudHJ5LmVsYXBzZWRNcyA9IHRoaXMuZ2V0RWxhcHNlZChlbnRyeSk7XG4gICAgZW50cnkucnVubmluZyA9IGZhbHNlO1xuICAgIGVudHJ5LnN0YXJ0ZWRBdCA9IG51bGw7XG4gICAgdGhpcy5wZXJzaXN0VGltZXIoZW50cnkpO1xuICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICB9XG5cbiAgcHJpdmF0ZSByZXNldFRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgaWYgKCFlbnRyeSkgcmV0dXJuO1xuXG4gICAgZW50cnkuZWxhcHNlZE1zID0gMDtcbiAgICBlbnRyeS5ydW5uaW5nID0gZmFsc2U7XG4gICAgZW50cnkuc3RhcnRlZEF0ID0gbnVsbDtcbiAgICB0aGlzLnBlcnNpc3RUaW1lcihlbnRyeSk7XG4gICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gIH1cblxuICBwcml2YXRlIGNvbmZpZ3VyZVRhcmdldFRpbWUoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICBpZiAoIWVudHJ5KSByZXR1cm47XG5cbiAgICBuZXcgVGFyZ2V0VGltZU1vZGFsKHRoaXMuYXBwLCBlbnRyeS50YXJnZXRNcywgKG5ld1RhcmdldE1zKSA9PiB7XG4gICAgICBlbnRyeS50YXJnZXRNcyA9IG5ld1RhcmdldE1zO1xuICAgICAgdGhpcy5wZXJzaXN0VGltZXIoZW50cnkpO1xuICAgICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gICAgfSkub3BlbigpO1xuICB9XG5cbiAgcHJpdmF0ZSBkZWxldGVUaW1lcihpZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgIHRoaXMuZGVsZXRlZFRpbWVySWRzLmFkZChpZCk7XG4gICAgdGhpcy50aW1lcnMuZGVsZXRlKGlkKTtcbiAgICB2b2lkIHRoaXMucGx1Z2luLm1hcmtUaW1lckRlbGV0ZWQoaWQsIGVudHJ5Py50aXRsZSA/PyBcIlwiLCBlbnRyeT8udGFyZ2V0TXMgPz8gbnVsbCwgZW50cnk/LmVsYXBzZWRNcyA/PyAwKTtcbiAgICB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzID0gdGhpcy5jdXJyZW50SGVhZGluZ0lkcy5maWx0ZXIoKGhlYWRpbmdJZCkgPT4gaGVhZGluZ0lkICE9PSBpZCk7XG4gICAgdm9pZCB0aGlzLnJlbmRlckxpc3QoKTtcbiAgfVxuXG4gIHByaXZhdGUgZGVsZXRlQWxsVGltZXJzKCk6IHZvaWQge1xuICAgIGNvbnN0IGZpbGVQYXRoID0gdGhpcy5jdXJyZW50RmlsZVBhdGg7XG4gICAgdGhpcy50aW1lcnMuY2xlYXIoKTtcbiAgICB0aGlzLmRlbGV0ZWRUaW1lcklkcy5jbGVhcigpO1xuICAgIGlmIChmaWxlUGF0aCkge1xuICAgICAgdm9pZCB0aGlzLnBsdWdpbi5jbGVhckZpbGVUaW1lcnMoZmlsZVBhdGgpO1xuICAgIH1cbiAgICB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCk7XG4gIH1cblxuICBwcml2YXRlIGNvbmZpcm1BY3Rpb24obWVzc2FnZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHdpbmRvdy5jb25maXJtKG1lc3NhZ2UpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVUaW1lckRpc3BsYXlzKCk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgaWQgb2YgdGhpcy5jdXJyZW50SGVhZGluZ0lkcykge1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgICAgY29uc3QgdWkgPSB0aGlzLnRpbWVyVWlSZWZzLmdldChpZCk7XG4gICAgICBpZiAoIWVudHJ5IHx8ICF1aSkgY29udGludWU7XG5cbiAgICAgIHVpLnRpbWVyRWwuc2V0VGV4dChmb3JtYXREdXJhdGlvbih0aGlzLmdldEVsYXBzZWQoZW50cnkpKSk7XG4gICAgICB1aS5wbGF5U3RvcEJ0bi5zZXRUZXh0KGVudHJ5LnJ1bm5pbmcgPyBVSV9URVhULnBhdXNlIDogVUlfVEVYVC5vcGVuKTtcbiAgICAgIHVpLnBsYXlTdG9wQnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIGVudHJ5LnJ1bm5pbmcgPyBcIlBhdXNlIHRpbWVyXCIgOiBcIlN0YXJ0IHRpbWVyXCIpO1xuICAgICAgdWkucGxheVN0b3BCdG4uc2V0QXR0cihcInRpdGxlXCIsIGVudHJ5LnJ1bm5pbmcgPyBcIlBhdXNlIHRpbWVyXCIgOiBcIlN0YXJ0IHRpbWVyXCIpO1xuXG4gICAgICBjb25zdCB0YXJnZXRNaW51dGVzID0gZW50cnkudGFyZ2V0TXMgPT09IG51bGwgPyBcIlwiIDogKGVudHJ5LnRhcmdldE1zIC8gNjAwMDApLnRvRml4ZWQoMSkucmVwbGFjZSgvXFwuMCQvLCBcIlwiKTtcbiAgICAgIHVpLnRhcmdldEJ0bi5zZXRBdHRyKFxuICAgICAgICBcInRpdGxlXCIsXG4gICAgICAgIGVudHJ5LnRhcmdldE1zID09PSBudWxsID8gXCJDb25maWd1cmUgdGFyZ2V0IHRpbWVcIiA6IGBUYXJnZXQ6ICR7dGFyZ2V0TWludXRlc30gbWluYFxuICAgICAgKTtcblxuICAgICAgY29uc3QgZWxhcHNlZCA9IHRoaXMuZ2V0RWxhcHNlZChlbnRyeSk7XG4gICAgICBjb25zdCBoYXNUYXJnZXQgPSBlbnRyeS50YXJnZXRNcyAhPT0gbnVsbDtcbiAgICAgIGNvbnN0IGlzT3ZlclRhcmdldCA9IGhhc1RhcmdldCAmJiBlbGFwc2VkID4gKGVudHJ5LnRhcmdldE1zID8/IDApO1xuXG4gICAgICB1aS5jYXJkRWwucmVtb3ZlQ2xhc3MoXCJqdy10aW1lci1jYXJkLS1ydW5uaW5nXCIsIFwianctdGltZXItY2FyZC0tc3RvcHBlZFwiLCBcImp3LXRpbWVyLWNhcmQtLW92ZXJkdWUtcnVubmluZ1wiKTtcbiAgICAgIHVpLnRpbWVyRWwucmVtb3ZlQ2xhc3MoXCJqdy10aW1lci1jbG9jay0tdGFyZ2V0LW92ZXJcIiwgXCJqdy10aW1lci1jbG9jay0tdGFyZ2V0LW9rXCIpO1xuXG4gICAgICBpZiAoZW50cnkucnVubmluZyAmJiBpc092ZXJUYXJnZXQpIHtcbiAgICAgICAgdWkuY2FyZEVsLmFkZENsYXNzKFwianctdGltZXItY2FyZC0tb3ZlcmR1ZS1ydW5uaW5nXCIpO1xuICAgICAgICB1aS50aW1lckVsLmFkZENsYXNzKFwianctdGltZXItY2xvY2stLXRhcmdldC1vdmVyXCIpO1xuICAgICAgfSBlbHNlIGlmIChlbnRyeS5ydW5uaW5nKSB7XG4gICAgICAgIHVpLmNhcmRFbC5hZGRDbGFzcyhcImp3LXRpbWVyLWNhcmQtLXJ1bm5pbmdcIik7XG4gICAgICB9IGVsc2UgaWYgKGVsYXBzZWQgPiAwKSB7XG4gICAgICAgIHVpLmNhcmRFbC5hZGRDbGFzcyhcImp3LXRpbWVyLWNhcmQtLXN0b3BwZWRcIik7XG4gICAgICB9XG5cbiAgICAgIGlmICghZW50cnkucnVubmluZyAmJiBoYXNUYXJnZXQpIHtcbiAgICAgICAgaWYgKGlzT3ZlclRhcmdldCkge1xuICAgICAgICAgIHVpLnRpbWVyRWwuYWRkQ2xhc3MoXCJqdy10aW1lci1jbG9jay0tdGFyZ2V0LW92ZXJcIik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdWkudGltZXJFbC5hZGRDbGFzcyhcImp3LXRpbWVyLWNsb2NrLS10YXJnZXQtb2tcIik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxufVxuXG5jbGFzcyBUYXJnZXRUaW1lTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIHByaXZhdGUgaW5wdXRWYWx1ZTogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY3VycmVudFRhcmdldE1zOiBudW1iZXIgfCBudWxsLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgb25TdWJtaXQ6ICh0YXJnZXRNczogbnVtYmVyIHwgbnVsbCkgPT4gdm9pZFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuaW5wdXRWYWx1ZSA9IGN1cnJlbnRUYXJnZXRNcyA9PT0gbnVsbCA/IFwiXCIgOiAoY3VycmVudFRhcmdldE1zIC8gNjAwMDApLnRvU3RyaW5nKCk7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBcIlNldCB0YXJnZXQgdGltZVwiIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoXCJUYXJnZXQgKG1pbnV0ZXMpXCIpXG4gICAgICAuc2V0RGVzYyhcIkxlYXZlIGVtcHR5IHRvIHJlbW92ZSB0aGUgdGFyZ2V0LiBEZWNpbWFscyBhbGxvd2VkIChlLmcuIDEuNSA9IDEgbWluIDMwIHMpLlwiKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+IHtcbiAgICAgICAgdGV4dC5zZXRWYWx1ZSh0aGlzLmlucHV0VmFsdWUpO1xuICAgICAgICB0ZXh0LmlucHV0RWwuc2V0QXR0cmlidXRlKFwidHlwZVwiLCBcIm51bWJlclwiKTtcbiAgICAgICAgdGV4dC5pbnB1dEVsLnNldEF0dHJpYnV0ZShcIm1pblwiLCBcIjBcIik7XG4gICAgICAgIHRleHQuaW5wdXRFbC5zZXRBdHRyaWJ1dGUoXCJzdGVwXCIsIFwiMC41XCIpO1xuICAgICAgICB0ZXh0LmlucHV0RWwuc3R5bGUud2lkdGggPSBcIjZyZW1cIjtcbiAgICAgICAgdGV4dC5vbkNoYW5nZSgodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLmlucHV0VmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRleHQuaW5wdXRFbC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZ0KSA9PiB7XG4gICAgICAgICAgaWYgKGV2dC5rZXkgPT09IFwiRW50ZXJcIikge1xuICAgICAgICAgICAgdGhpcy5zdWJtaXQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB0ZXh0LmlucHV0RWwuZm9jdXMoKSwgNTApO1xuICAgICAgfSk7XG5cbiAgICBjb25zdCBidG5Sb3cgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcIm1vZGFsLWJ1dHRvbi1jb250YWluZXJcIiB9KTtcbiAgICBidG5Sb3cuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIkNsZWFyIHRhcmdldFwiLCBjbHM6IFwibW9kLXdhcm5pbmdcIiB9KS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgdGhpcy5vblN1Ym1pdChudWxsKTtcbiAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICB9KTtcbiAgICBidG5Sb3cuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlNhdmVcIiwgY2xzOiBcIm1vZC1jdGFcIiB9KS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgdGhpcy5zdWJtaXQoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgc3VibWl0KCk6IHZvaWQge1xuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSB0aGlzLmlucHV0VmFsdWUudHJpbSgpLnJlcGxhY2UoXCIsXCIsIFwiLlwiKTtcbiAgICBpZiAoIW5vcm1hbGl6ZWQpIHtcbiAgICAgIHRoaXMub25TdWJtaXQobnVsbCk7XG4gICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbWludXRlcyA9IE51bWJlcihub3JtYWxpemVkKTtcbiAgICBpZiAoIU51bWJlci5pc0Zpbml0ZShtaW51dGVzKSB8fCBtaW51dGVzIDw9IDApIHtcbiAgICAgIGNvbnN0IGVycm9yRWwgPSAodGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcihcIi5qdy10YXJnZXQtZXJyb3JcIikgYXMgSFRNTEVsZW1lbnQgfCBudWxsKSA/PyAoKCkgPT4ge1xuICAgICAgICBjb25zdCBlbCA9IHRoaXMuY29udGVudEVsLmNyZWF0ZUVsKFwicFwiLCB7IGNsczogXCJqdy10YXJnZXQtZXJyb3JcIiB9KTtcbiAgICAgICAgZWwuc3R5bGUuY29sb3IgPSBcInZhcigtLWNvbG9yLXJlZClcIjtcbiAgICAgICAgcmV0dXJuIGVsO1xuICAgICAgfSkoKTtcbiAgICAgIGVycm9yRWwuc2V0VGV4dChcIkVudGVyIGEgcG9zaXRpdmUgbnVtYmVyIG9mIG1pbnV0ZXMuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMub25TdWJtaXQoTWF0aC5yb3VuZChtaW51dGVzICogNjAgKiAxMDAwKSk7XG4gICAgdGhpcy5jbG9zZSgpO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBwZXJzaXN0VGltZXIoZW50cnk6IFRpbWVyRW50cnkpOiB2b2lkIHtcbiAgICBjb25zdCBlbGFwc2VkID0gdGhpcy5nZXRFbGFwc2VkKGVudHJ5KTtcbiAgICB2b2lkIHRoaXMucGx1Z2luLnVwc2VydFN0b3JlZFRpbWVyKGVudHJ5LmlkLCB7XG4gICAgICB0aXRsZTogZW50cnkudGl0bGUsXG4gICAgICBlbGFwc2VkTXM6IGVsYXBzZWQsXG4gICAgICB0YXJnZXRNczogZW50cnkudGFyZ2V0TXMsXG4gICAgICBkZWxldGVkOiBmYWxzZVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBwZXJzaXN0QWxsVGltZXJzKGZyZWV6ZVJ1bm5pbmc6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB1cGRhdGVzOiBQcm9taXNlPHZvaWQ+W10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy50aW1lcnMudmFsdWVzKCkpIHtcbiAgICAgIGxldCBlbGFwc2VkID0gdGhpcy5nZXRFbGFwc2VkKGVudHJ5KTtcbiAgICAgIGlmIChmcmVlemVSdW5uaW5nICYmIGVudHJ5LnJ1bm5pbmcpIHtcbiAgICAgICAgZW50cnkuZWxhcHNlZE1zID0gZWxhcHNlZDtcbiAgICAgICAgZW50cnkucnVubmluZyA9IGZhbHNlO1xuICAgICAgICBlbnRyeS5zdGFydGVkQXQgPSBudWxsO1xuICAgICAgfSBlbHNlIGlmICghZW50cnkucnVubmluZykge1xuICAgICAgICBlbGFwc2VkID0gZW50cnkuZWxhcHNlZE1zO1xuICAgICAgfVxuXG4gICAgICB1cGRhdGVzLnB1c2goXG4gICAgICAgIHRoaXMucGx1Z2luLnVwc2VydFN0b3JlZFRpbWVyKGVudHJ5LmlkLCB7XG4gICAgICAgICAgdGl0bGU6IGVudHJ5LnRpdGxlLFxuICAgICAgICAgIGVsYXBzZWRNczogZWxhcHNlZCxcbiAgICAgICAgICB0YXJnZXRNczogZW50cnkudGFyZ2V0TXMsXG4gICAgICAgICAgZGVsZXRlZDogZmFsc2VcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwodXBkYXRlcyk7XG4gIH1cblxuICBwcml2YXRlIHBlcnNpc3RSdW5uaW5nU25hcHNob3RzKCk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy50aW1lcnMudmFsdWVzKCkpIHtcbiAgICAgIGlmIChlbnRyeS5ydW5uaW5nKSB7XG4gICAgICAgIHRoaXMucGVyc2lzdFRpbWVyKGVudHJ5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlclRpdGxlQ29udGVudCh0aXRsZUVsOiBIVE1MRWxlbWVudCwgcmF3VGl0bGU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJlbmRlcmVkRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIGF3YWl0IE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKHRoaXMuYXBwLCByYXdUaXRsZSwgcmVuZGVyZWRFbCwgdGhpcy5jdXJyZW50RmlsZVBhdGggPz8gXCJcIiwgdGhpcyk7XG4gICAgdGhpcy5yZXN0b3JlSW5saW5lSHRtbEF0dHJpYnV0ZXMocmVuZGVyZWRFbCwgcmF3VGl0bGUpO1xuXG4gICAgY29uc3QgcGxhaW4gPSAocmVuZGVyZWRFbC50ZXh0Q29udGVudCA/PyBcIlwiKS5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gICAgaWYgKHBsYWluLmxlbmd0aCA+IFRpbWVyU2lkZWJhclZpZXcuVElUTEVfTUFYX0xFTkdUSCkge1xuICAgICAgdGhpcy50cnVuY2F0ZVJlbmRlcmVkQ29udGVudChyZW5kZXJlZEVsLCBUaW1lclNpZGViYXJWaWV3LlRJVExFX01BWF9MRU5HVEgpO1xuICAgICAgdGl0bGVFbC5zZXRBdHRyKFwidGl0bGVcIiwgcGxhaW4pO1xuICAgICAgdGl0bGVFbC5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBwbGFpbik7XG4gICAgfVxuXG4gICAgdGl0bGVFbC5lbXB0eSgpO1xuICAgIHdoaWxlIChyZW5kZXJlZEVsLmZpcnN0Q2hpbGQpIHtcbiAgICAgIHRpdGxlRWwuYXBwZW5kQ2hpbGQocmVuZGVyZWRFbC5maXJzdENoaWxkKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHJlc3RvcmVJbmxpbmVIdG1sQXR0cmlidXRlcyhjb250YWluZXJFbDogSFRNTEVsZW1lbnQsIHJhd1RpdGxlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBwYXJzZWRSb290ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBwYXJzZWRSb290LmlubmVySFRNTCA9IHJhd1RpdGxlO1xuXG4gICAgY29uc3Qgc291cmNlRWxlbWVudHMgPSBBcnJheS5mcm9tKHBhcnNlZFJvb3QucXVlcnlTZWxlY3RvckFsbChcIipcIikpLmZpbHRlcigoZWxlbWVudCkgPT4ge1xuICAgICAgY29uc3QgYXR0cmlidXRlTmFtZXMgPSBlbGVtZW50LmdldEF0dHJpYnV0ZU5hbWVzKCk7XG4gICAgICByZXR1cm4gYXR0cmlidXRlTmFtZXMubGVuZ3RoID4gMDtcbiAgICB9KTtcbiAgICB0aGlzLmFwcGx5TWF0Y2hpbmdBdHRyaWJ1dGVzKHNvdXJjZUVsZW1lbnRzLCBjb250YWluZXJFbCk7XG4gIH1cblxuICBwcml2YXRlIGFwcGx5TWF0Y2hpbmdBdHRyaWJ1dGVzKHNvdXJjZUVsZW1lbnRzOiBFbGVtZW50W10sIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGNvbnN0IHVzZWRUYXJnZXRzID0gbmV3IFNldDxFbGVtZW50PigpO1xuXG4gICAgZm9yIChjb25zdCBzb3VyY2VFbCBvZiBzb3VyY2VFbGVtZW50cykge1xuICAgICAgY29uc3Qgc291cmNlVGV4dCA9IHNvdXJjZUVsLnRleHRDb250ZW50Py5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gICAgICBpZiAoIXNvdXJjZVRleHQpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBjYW5kaWRhdGVUYXJnZXRzID0gQXJyYXkuZnJvbShjb250YWluZXJFbC5xdWVyeVNlbGVjdG9yQWxsKHNvdXJjZUVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKSkpO1xuICAgICAgY29uc3QgdGFyZ2V0RWwgPSBjYW5kaWRhdGVUYXJnZXRzLmZpbmQoKGNhbmRpZGF0ZSkgPT4ge1xuICAgICAgICBpZiAodXNlZFRhcmdldHMuaGFzKGNhbmRpZGF0ZSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjYW5kaWRhdGVUZXh0ID0gY2FuZGlkYXRlLnRleHRDb250ZW50Py5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gICAgICAgIHJldHVybiBjYW5kaWRhdGVUZXh0ID09PSBzb3VyY2VUZXh0O1xuICAgICAgfSk7XG5cbiAgICAgIGlmICghdGFyZ2V0RWwpIGNvbnRpbnVlO1xuXG4gICAgICB1c2VkVGFyZ2V0cy5hZGQodGFyZ2V0RWwpO1xuICAgICAgZm9yIChjb25zdCBhdHRyIG9mIHNvdXJjZUVsLmdldEF0dHJpYnV0ZU5hbWVzKCkpIHtcbiAgICAgICAgdGFyZ2V0RWwuc2V0QXR0cmlidXRlKGF0dHIsIHNvdXJjZUVsLmdldEF0dHJpYnV0ZShhdHRyKSA/PyBcIlwiKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHRydW5jYXRlUmVuZGVyZWRDb250ZW50KGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCwgbWF4TGVuZ3RoOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCB3YWxrZXIgPSBkb2N1bWVudC5jcmVhdGVUcmVlV2Fsa2VyKGNvbnRhaW5lckVsLCBOb2RlRmlsdGVyLlNIT1dfVEVYVCk7XG4gICAgY29uc3QgdGV4dE5vZGVzOiBUZXh0W10gPSBbXTtcblxuICAgIHdoaWxlICh3YWxrZXIubmV4dE5vZGUoKSkge1xuICAgICAgdGV4dE5vZGVzLnB1c2god2Fsa2VyLmN1cnJlbnROb2RlIGFzIFRleHQpO1xuICAgIH1cblxuICAgIGxldCB1c2VkTGVuZ3RoID0gMDtcbiAgICBsZXQgcmVhY2hlZExpbWl0ID0gZmFsc2U7XG5cbiAgICBmb3IgKGNvbnN0IHRleHROb2RlIG9mIHRleHROb2Rlcykge1xuICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IHRleHROb2RlLnRleHRDb250ZW50Py5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKSA/PyBcIlwiO1xuICAgICAgaWYgKCFub3JtYWxpemVkLnRyaW0oKSkge1xuICAgICAgICBpZiAocmVhY2hlZExpbWl0KSB7XG4gICAgICAgICAgdGV4dE5vZGUudGV4dENvbnRlbnQgPSBcIlwiO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVhY2hlZExpbWl0KSB7XG4gICAgICAgIHRleHROb2RlLnRleHRDb250ZW50ID0gXCJcIjtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlbWFpbmluZyA9IG1heExlbmd0aCAtIHVzZWRMZW5ndGg7XG4gICAgICBpZiAobm9ybWFsaXplZC5sZW5ndGggPD0gcmVtYWluaW5nKSB7XG4gICAgICAgIHVzZWRMZW5ndGggKz0gbm9ybWFsaXplZC5sZW5ndGg7XG4gICAgICAgIHRleHROb2RlLnRleHRDb250ZW50ID0gbm9ybWFsaXplZDtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNsaWNlTGVuZ3RoID0gTWF0aC5tYXgoMCwgcmVtYWluaW5nIC0gMyk7XG4gICAgICBjb25zdCB0cnVuY2F0ZWRUZXh0ID0gYCR7bm9ybWFsaXplZC5zbGljZSgwLCBzbGljZUxlbmd0aCkudHJpbUVuZCgpfS4uLmA7XG4gICAgICB0ZXh0Tm9kZS50ZXh0Q29udGVudCA9IHRydW5jYXRlZFRleHQ7XG4gICAgICByZWFjaGVkTGltaXQgPSB0cnVlO1xuICAgICAgdXNlZExlbmd0aCA9IG1heExlbmd0aDtcbiAgICB9XG5cbiAgICB0aGlzLnJlbW92ZUVtcHR5Tm9kZXMoY29udGFpbmVyRWwpO1xuICB9XG5cbiAgcHJpdmF0ZSByZW1vdmVFbXB0eU5vZGVzKHJvb3RFbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb25zdCBjaGlsZE5vZGVzID0gQXJyYXkuZnJvbShyb290RWwuY2hpbGROb2Rlcyk7XG5cbiAgICBmb3IgKGNvbnN0IGNoaWxkTm9kZSBvZiBjaGlsZE5vZGVzKSB7XG4gICAgICBpZiAoY2hpbGROb2RlLm5vZGVUeXBlID09PSBOb2RlLlRFWFRfTk9ERSkge1xuICAgICAgICBpZiAoIShjaGlsZE5vZGUudGV4dENvbnRlbnQgPz8gXCJcIikudHJpbSgpKSB7XG4gICAgICAgICAgY2hpbGROb2RlLnJlbW92ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2hpbGROb2RlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVFbXB0eU5vZGVzKGNoaWxkTm9kZSk7XG4gICAgICAgIGNvbnN0IGhhc01lYW5pbmdmdWxUZXh0ID0gKGNoaWxkTm9kZS50ZXh0Q29udGVudCA/PyBcIlwiKS50cmltKCkubGVuZ3RoID4gMDtcbiAgICAgICAgY29uc3QgaGFzRWxlbWVudENoaWxkcmVuID0gY2hpbGROb2RlLmNoaWxkcmVuLmxlbmd0aCA+IDA7XG4gICAgICAgIGlmICghaGFzTWVhbmluZ2Z1bFRleHQgJiYgIWhhc0VsZW1lbnRDaGlsZHJlbikge1xuICAgICAgICAgIGNoaWxkTm9kZS5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUaW1lclNpZGViYXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBwcml2YXRlIHN0b3JhZ2U6IFRpbWVyU3RvcmFnZURhdGEgPSB7IHZlcnNpb246IFNUT1JBR0VfVkVSU0lPTiwgdGltZXJzOiB7fSB9O1xuICBwcml2YXRlIHNhdmVIYW5kbGU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnN0b3JhZ2UgPSB0aGlzLm5vcm1hbGl6ZVN0b3JhZ2VEYXRhKGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XG4gICAgaWYgKHRoaXMucHJ1bmVPbGRUaW1lcnMoKSkge1xuICAgICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnN0b3JhZ2UpO1xuICAgIH1cblxuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFZJRVdfVFlQRV9USU1FUl9TSURFQkFSLCAobGVhZikgPT4gbmV3IFRpbWVyU2lkZWJhclZpZXcobGVhZiwgdGhpcykpO1xuXG4gICAgdGhpcy5hZGRSaWJib25JY29uKFwidGltZXJcIiwgXCJPcGVuIEpXIFRpbWVyIHNpZGViYXJcIiwgKCkgPT4ge1xuICAgICAgdm9pZCB0aGlzLmFjdGl2YXRlVmlldygpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm9wZW4tanctdGltZXItc2lkZWJhclwiLFxuICAgICAgbmFtZTogXCJPcGVuIEpXIFRpbWVyIHNpZGViYXJcIixcbiAgICAgIGNhbGxiYWNrOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMuYWN0aXZhdGVWaWV3KCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB7XG4gICAgICB2b2lkIHRoaXMuYWN0aXZhdGVWaWV3KCk7XG4gICAgfSk7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zYXZlSGFuZGxlICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuc2F2ZUhhbmRsZSk7XG4gICAgICB0aGlzLnNhdmVIYW5kbGUgPSBudWxsO1xuICAgICAgdm9pZCB0aGlzLnNhdmVEYXRhKHRoaXMuc3RvcmFnZSk7XG4gICAgfVxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoVklFV19UWVBFX1RJTUVSX1NJREVCQVIpO1xuICB9XG5cbiAgZ2V0U3RvcmVkVGltZXIoaWQ6IHN0cmluZyk6IFN0b3JlZFRpbWVyU3RhdGUgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLnN0b3JhZ2UudGltZXJzW2lkXTtcbiAgfVxuXG4gIGdldERlbGV0ZWRUaW1lcklkc0ZvckZpbGUoZmlsZVBhdGg6IHN0cmluZyk6IFNldDxzdHJpbmc+IHtcbiAgICBjb25zdCBkZWxldGVkSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgcHJlZml4ID0gYCR7ZmlsZVBhdGh9OjpgO1xuXG4gICAgZm9yIChjb25zdCBbaWQsIHN0YXRlXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLnN0b3JhZ2UudGltZXJzKSkge1xuICAgICAgaWYgKGlkLnN0YXJ0c1dpdGgocHJlZml4KSAmJiBzdGF0ZS5kZWxldGVkKSB7XG4gICAgICAgIGRlbGV0ZWRJZHMuYWRkKGlkKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZGVsZXRlZElkcztcbiAgfVxuXG4gIGFzeW5jIHVwc2VydFN0b3JlZFRpbWVyKFxuICAgIGlkOiBzdHJpbmcsXG4gICAgc3RhdGU6IHsgdGl0bGU6IHN0cmluZzsgZWxhcHNlZE1zOiBudW1iZXI7IHRhcmdldE1zOiBudW1iZXIgfCBudWxsOyBkZWxldGVkOiBib29sZWFuIH1cbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5zdG9yYWdlLnRpbWVyc1tpZF0gPSB7XG4gICAgICB0aXRsZTogc3RhdGUudGl0bGUsXG4gICAgICBlbGFwc2VkTXM6IE1hdGgubWF4KDAsIE1hdGguZmxvb3Ioc3RhdGUuZWxhcHNlZE1zKSksXG4gICAgICB0YXJnZXRNczogc3RhdGUudGFyZ2V0TXMsXG4gICAgICBkZWxldGVkOiBzdGF0ZS5kZWxldGVkLFxuICAgICAgdXBkYXRlZEF0OiBEYXRlLm5vdygpXG4gICAgfTtcblxuICAgIHRoaXMuc2NoZWR1bGVTYXZlKCk7XG4gIH1cblxuICBhc3luYyBtYXJrVGltZXJEZWxldGVkKGlkOiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIHRhcmdldE1zOiBudW1iZXIgfCBudWxsLCBlbGFwc2VkTXM6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc3RvcmFnZS50aW1lcnNbaWRdID0ge1xuICAgICAgdGl0bGUsXG4gICAgICBlbGFwc2VkTXM6IE1hdGgubWF4KDAsIE1hdGguZmxvb3IoZWxhcHNlZE1zKSksXG4gICAgICB0YXJnZXRNcyxcbiAgICAgIGRlbGV0ZWQ6IHRydWUsXG4gICAgICB1cGRhdGVkQXQ6IERhdGUubm93KClcbiAgICB9O1xuXG4gICAgdGhpcy5zY2hlZHVsZVNhdmUoKTtcbiAgfVxuXG4gIGFzeW5jIHJlbW92ZVN0b3JlZFRpbWVyKGlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIShpZCBpbiB0aGlzLnN0b3JhZ2UudGltZXJzKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGRlbGV0ZSB0aGlzLnN0b3JhZ2UudGltZXJzW2lkXTtcbiAgICB0aGlzLnNjaGVkdWxlU2F2ZSgpO1xuICB9XG5cbiAgYXN5bmMgY2xlYXJGaWxlVGltZXJzKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBwcmVmaXggPSBgJHtmaWxlUGF0aH06OmA7XG4gICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcblxuICAgIGZvciAoY29uc3QgaWQgb2YgT2JqZWN0LmtleXModGhpcy5zdG9yYWdlLnRpbWVycykpIHtcbiAgICAgIGlmIChpZC5zdGFydHNXaXRoKHByZWZpeCkpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RvcmFnZS50aW1lcnNbaWRdO1xuICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgdGhpcy5zY2hlZHVsZVNhdmUoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG5vcm1hbGl6ZVN0b3JhZ2VEYXRhKHJhdzogdW5rbm93bik6IFRpbWVyU3RvcmFnZURhdGEge1xuICAgIGNvbnN0IGZhbGxiYWNrOiBUaW1lclN0b3JhZ2VEYXRhID0geyB2ZXJzaW9uOiBTVE9SQUdFX1ZFUlNJT04sIHRpbWVyczoge30gfTtcbiAgICBpZiAoIXJhdyB8fCB0eXBlb2YgcmF3ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICByZXR1cm4gZmFsbGJhY2s7XG4gICAgfVxuXG4gICAgY29uc3QgbWF5YmVEYXRhID0gcmF3IGFzIFBhcnRpYWw8VGltZXJTdG9yYWdlRGF0YT47XG4gICAgaWYgKCFtYXliZURhdGEudGltZXJzIHx8IHR5cGVvZiBtYXliZURhdGEudGltZXJzICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICByZXR1cm4gZmFsbGJhY2s7XG4gICAgfVxuXG4gICAgY29uc3Qgbm9ybWFsaXplZFRpbWVyczogUmVjb3JkPHN0cmluZywgU3RvcmVkVGltZXJTdGF0ZT4gPSB7fTtcbiAgICBmb3IgKGNvbnN0IFtpZCwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKG1heWJlRGF0YS50aW1lcnMpKSB7XG4gICAgICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdGltZXIgPSB2YWx1ZSBhcyBQYXJ0aWFsPFN0b3JlZFRpbWVyU3RhdGU+O1xuICAgICAgbm9ybWFsaXplZFRpbWVyc1tpZF0gPSB7XG4gICAgICAgIHRpdGxlOiB0eXBlb2YgdGltZXIudGl0bGUgPT09IFwic3RyaW5nXCIgPyB0aW1lci50aXRsZSA6IFwiXCIsXG4gICAgICAgIGVsYXBzZWRNczogTnVtYmVyLmlzRmluaXRlKHRpbWVyLmVsYXBzZWRNcykgPyBNYXRoLm1heCgwLCBNYXRoLmZsb29yKHRpbWVyLmVsYXBzZWRNcyA/PyAwKSkgOiAwLFxuICAgICAgICB0YXJnZXRNczpcbiAgICAgICAgICB0aW1lci50YXJnZXRNcyA9PT0gbnVsbCB8fCB0aW1lci50YXJnZXRNcyA9PT0gdW5kZWZpbmVkXG4gICAgICAgICAgICA/IG51bGxcbiAgICAgICAgICAgIDogTnVtYmVyLmlzRmluaXRlKHRpbWVyLnRhcmdldE1zKVxuICAgICAgICAgICAgICA/IE1hdGgubWF4KDAsIE1hdGguZmxvb3IodGltZXIudGFyZ2V0TXMpKVxuICAgICAgICAgICAgICA6IG51bGwsXG4gICAgICAgIGRlbGV0ZWQ6IEJvb2xlYW4odGltZXIuZGVsZXRlZCksXG4gICAgICAgIHVwZGF0ZWRBdDpcbiAgICAgICAgICBOdW1iZXIuaXNGaW5pdGUodGltZXIudXBkYXRlZEF0KSAmJiAodGltZXIudXBkYXRlZEF0ID8/IDApID4gMFxuICAgICAgICAgICAgPyBNYXRoLmZsb29yKHRpbWVyLnVwZGF0ZWRBdCBhcyBudW1iZXIpXG4gICAgICAgICAgICA6IERhdGUubm93KClcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHZlcnNpb246IFNUT1JBR0VfVkVSU0lPTixcbiAgICAgIHRpbWVyczogbm9ybWFsaXplZFRpbWVyc1xuICAgIH07XG4gIH1cblxuICBwcml2YXRlIHBydW5lT2xkVGltZXJzKCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcblxuICAgIGZvciAoY29uc3QgW2lkLCB0aW1lcl0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5zdG9yYWdlLnRpbWVycykpIHtcbiAgICAgIGlmIChub3cgLSB0aW1lci51cGRhdGVkQXQgPiBUSU1FUl9SRVRFTlRJT05fTVMpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RvcmFnZS50aW1lcnNbaWRdO1xuICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY2hhbmdlZDtcbiAgfVxuXG4gIHByaXZhdGUgc2NoZWR1bGVTYXZlKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnBydW5lT2xkVGltZXJzKCkpIHtcbiAgICAgIC8vIEtlZXAgc3RvcmFnZSBib3VuZGVkIGJlZm9yZSBwZXJzaXN0aW5nIHRvIGRpc2suXG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc2F2ZUhhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnNhdmVIYW5kbGUpO1xuICAgIH1cblxuICAgIHRoaXMuc2F2ZUhhbmRsZSA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuc2F2ZUhhbmRsZSA9IG51bGw7XG4gICAgICB2b2lkIHRoaXMuc2F2ZURhdGEodGhpcy5zdG9yYWdlKTtcbiAgICB9LCA0MDApO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBhY3RpdmF0ZVZpZXcoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZXhpc3RpbmdMZWF2ZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9USU1FUl9TSURFQkFSKTtcbiAgICBpZiAoZXhpc3RpbmdMZWF2ZXMubGVuZ3RoID4gMCkge1xuICAgICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYoZXhpc3RpbmdMZWF2ZXNbMF0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKTtcbiAgICBpZiAoIWxlYWYpIHJldHVybjtcblxuICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHtcbiAgICAgIHR5cGU6IFZJRVdfVFlQRV9USU1FUl9TSURFQkFSLFxuICAgICAgYWN0aXZlOiB0cnVlXG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBU087QUFFUCxJQUFNLDBCQUEwQjtBQUNoQyxJQUFNLGtCQUFrQjtBQUN4QixJQUFNLHFCQUFxQixLQUFLLEtBQUssS0FBSyxLQUFLO0FBRS9DLElBQU0sVUFBVTtBQUFBLEVBQ2QsT0FBTztBQUFBLEVBQ1AsT0FBTztBQUFBLEVBQ1AsTUFBTTtBQUFBLEVBQ04sT0FBTztBQUFBLEVBQ1AsUUFBUTtBQUFBLEVBQ1IsT0FBTztBQUFBLEVBQ1AsUUFBUTtBQUFBLEVBQ1IsVUFBVTtBQUNaO0FBZ0NBLFNBQVMsYUFBYSxVQUFrQixTQUErQjtBQUNyRSxRQUFNLE9BQU8sUUFBUSxVQUFVLE1BQU0sUUFBUTtBQUM3QyxTQUFPLEdBQUcsUUFBUSxLQUFLLElBQUksS0FBSyxRQUFRLE9BQU87QUFDakQ7QUFFQSxTQUFTLGVBQWUsSUFBb0I7QUFDMUMsUUFBTSxlQUFlLEtBQUssSUFBSSxHQUFHLEtBQUssTUFBTSxLQUFLLEdBQUksQ0FBQztBQUN0RCxRQUFNLFFBQVEsS0FBSyxNQUFNLGVBQWUsSUFBSTtBQUM1QyxRQUFNLFVBQVUsS0FBSyxNQUFPLGVBQWUsT0FBUSxFQUFFO0FBQ3JELFFBQU0sVUFBVSxlQUFlO0FBRS9CLFNBQU8sR0FBRyxPQUFPLEtBQUssRUFBRSxTQUFTLEdBQUcsR0FBRyxDQUFDLElBQUksT0FBTyxPQUFPLEVBQUUsU0FBUyxHQUFHLEdBQUcsQ0FBQyxJQUFJLE9BQU8sT0FBTyxFQUFFLFNBQVMsR0FBRyxHQUFHLENBQUM7QUFDbEg7QUFFQSxJQUFNLG1CQUFOLGNBQStCLHlCQUFTO0FBQUEsRUFhdEMsWUFBWSxNQUFzQyxRQUE0QjtBQUM1RSxVQUFNLElBQUk7QUFEc0M7QUFabEQsU0FBUSxTQUFTLG9CQUFJLElBQXdCO0FBQzdDLFNBQVEsa0JBQWtCLG9CQUFJLElBQVk7QUFDMUMsU0FBUSxjQUFjLG9CQUFJLElBQXdCO0FBQ2xELFNBQVEsb0JBQThCLENBQUM7QUFDdkMsU0FBUSxrQkFBaUM7QUFJekMsU0FBUSxhQUE0QjtBQUNwQyxTQUFRLGdCQUErQjtBQUFBLEVBS3ZDO0FBQUEsRUFFQSxjQUFzQjtBQUNwQixXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsaUJBQXlCO0FBQ3ZCLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFQSxVQUFrQjtBQUNoQixXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsTUFBTSxTQUF3QjtBQUM1QixTQUFLLFVBQVUsTUFBTTtBQUNyQixTQUFLLFVBQVUsU0FBUyx1QkFBdUI7QUFFL0MsVUFBTSxVQUFVLEtBQUssVUFBVSxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUVwRSxVQUFNLFVBQVUsUUFBUSxTQUFTLE1BQU0sRUFBRSxNQUFNLFFBQVEsT0FBTyxLQUFLLGlCQUFpQixDQUFDO0FBQ3JGLFlBQVEsUUFBUSxhQUFhLFFBQVE7QUFDckMsWUFBUSxRQUFRLGNBQWMsbUJBQW1CO0FBRWpELFNBQUssU0FBUyxRQUFRLFVBQVUsRUFBRSxLQUFLLGdCQUFnQixDQUFDO0FBQ3hELFNBQUssZUFBZSxRQUFRLFVBQVUsRUFBRSxLQUFLLGlCQUFpQixDQUFDO0FBRS9ELFVBQU0sV0FBVyxRQUFRLFVBQVUsRUFBRSxLQUFLLGtCQUFrQixDQUFDO0FBQzdELFVBQU0sZUFBZSxTQUFTLFNBQVMsVUFBVTtBQUFBLE1BQy9DLE1BQU0sUUFBUTtBQUFBLE1BQ2QsS0FBSztBQUFBLElBQ1AsQ0FBQztBQUNELGlCQUFhLFFBQVEsY0FBYyxrQkFBa0I7QUFDckQsaUJBQWEsUUFBUSxTQUFTLGtCQUFrQjtBQUVoRCxpQkFBYSxpQkFBaUIsU0FBUyxNQUFNO0FBQzNDLFVBQUksS0FBSyxjQUFjLG1CQUFtQixHQUFHO0FBQzNDLGFBQUssZ0JBQWdCO0FBQUEsTUFDdkI7QUFBQSxJQUNGLENBQUM7QUFFRCxTQUFLLGNBQWMsS0FBSyxJQUFJLFVBQVUsR0FBRyxzQkFBc0IsTUFBTSxLQUFLLEtBQUssc0JBQXNCLENBQUMsQ0FBQztBQUV2RyxTQUFLO0FBQUEsTUFDSCxLQUFLLElBQUksY0FBYyxHQUFHLFdBQVcsQ0FBQyxTQUFTO0FBQzdDLFlBQUksS0FBSyxTQUFTLEtBQUssaUJBQWlCO0FBQ3RDLGVBQUssS0FBSyxzQkFBc0I7QUFBQSxRQUNsQztBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0g7QUFFQSxTQUFLLGFBQWEsT0FBTyxZQUFZLE1BQU07QUFDekMsV0FBSyxvQkFBb0I7QUFBQSxJQUMzQixHQUFHLEdBQUc7QUFFTixTQUFLLGdCQUFnQixPQUFPLFlBQVksTUFBTTtBQUM1QyxXQUFLLHdCQUF3QjtBQUFBLElBQy9CLEdBQUcsR0FBSTtBQUVQLFNBQUssS0FBSyxzQkFBc0I7QUFBQSxFQUNsQztBQUFBLEVBRUEsTUFBTSxVQUF5QjtBQUM3QixRQUFJLEtBQUssZUFBZSxNQUFNO0FBQzVCLGFBQU8sY0FBYyxLQUFLLFVBQVU7QUFDcEMsV0FBSyxhQUFhO0FBQUEsSUFDcEI7QUFDQSxRQUFJLEtBQUssa0JBQWtCLE1BQU07QUFDL0IsYUFBTyxjQUFjLEtBQUssYUFBYTtBQUN2QyxXQUFLLGdCQUFnQjtBQUFBLElBQ3ZCO0FBRUEsVUFBTSxLQUFLLGlCQUFpQixJQUFJO0FBRWhDLFNBQUssVUFBVSxZQUFZLHVCQUF1QjtBQUNsRCxTQUFLLFlBQVksTUFBTTtBQUFBLEVBQ3pCO0FBQUEsRUFFQSxNQUFjLHdCQUF1QztBQUNuRCxVQUFNLGFBQWEsS0FBSyxJQUFJLFVBQVUsY0FBYztBQUVwRCxRQUFJLENBQUMsWUFBWTtBQUNmLFdBQUssa0JBQWtCO0FBQ3ZCLFdBQUssb0JBQW9CLENBQUM7QUFDMUIsWUFBTSxLQUFLLFdBQVc7QUFDdEI7QUFBQSxJQUNGO0FBRUEsU0FBSyxrQkFBa0IsV0FBVztBQUNsQyxVQUFNLGNBQWMsTUFBTSxLQUFLLElBQUksTUFBTSxXQUFXLFVBQVU7QUFDOUQsVUFBTSxZQUFZLEtBQUssSUFBSSxjQUFjLGFBQWEsVUFBVTtBQUNoRSxVQUFNLFlBQVksV0FBVyxZQUFZLENBQUMsR0FBRyxNQUFNLEVBQUUsS0FBSyxDQUFDLEdBQUcsTUFBTTtBQUNsRSxZQUFNLFFBQVEsRUFBRSxVQUFVLE1BQU0sUUFBUTtBQUN4QyxZQUFNLFFBQVEsRUFBRSxVQUFVLE1BQU0sUUFBUTtBQUN4QyxhQUFPLFFBQVE7QUFBQSxJQUNqQixDQUFDO0FBQ0QsVUFBTSxtQkFBbUIsS0FBSyx3QkFBd0IsYUFBYSxRQUFRO0FBQzNFLFNBQUssa0JBQWtCLEtBQUssT0FBTywwQkFBMEIsV0FBVyxJQUFJO0FBRTVFLFVBQU0saUJBQTJCLENBQUM7QUFDbEMsVUFBTSxnQkFBZ0Isb0JBQUksSUFBWTtBQUV0QyxlQUFXLFdBQVcsVUFBVTtBQUM5QixZQUFNLEtBQUssYUFBYSxXQUFXLE1BQU0sT0FBTztBQUNoRCxvQkFBYyxJQUFJLEVBQUU7QUFDcEIsVUFBSSxLQUFLLGdCQUFnQixJQUFJLEVBQUUsR0FBRztBQUNoQztBQUFBLE1BQ0Y7QUFFQSxZQUFNLGNBQWMsUUFBUSxVQUFVLE1BQU0sUUFBUTtBQUNwRCxZQUFNLGVBQWUsaUJBQWlCLElBQUksV0FBVyxLQUFLLFFBQVE7QUFDbEUsWUFBTSxXQUFXLEtBQUssT0FBTyxJQUFJLEVBQUU7QUFDbkMsWUFBTSxTQUFTLEtBQUssT0FBTyxlQUFlLEVBQUU7QUFFNUMsVUFBSSxDQUFDLFVBQVU7QUFDYixhQUFLLE9BQU8sSUFBSSxJQUFJO0FBQUEsVUFDbEI7QUFBQSxVQUNBLE9BQU87QUFBQSxVQUNQLFdBQVcsUUFBUSxhQUFhO0FBQUEsVUFDaEMsVUFBVSxRQUFRLFlBQVk7QUFBQSxVQUM5QixTQUFTO0FBQUEsVUFDVCxXQUFXO0FBQUEsUUFDYixDQUFDO0FBQUEsTUFDSCxPQUFPO0FBQ0wsaUJBQVMsUUFBUTtBQUNqQixZQUFJLFNBQVMsYUFBYSxRQUFRLFFBQVEsYUFBYSxRQUFXO0FBQ2hFLG1CQUFTLFdBQVcsT0FBTztBQUFBLFFBQzdCO0FBQUEsTUFDRjtBQUVBLHFCQUFlLEtBQUssRUFBRTtBQUFBLElBQ3hCO0FBRUEsVUFBTSxhQUFhLElBQUksSUFBSSxjQUFjO0FBQ3pDLGVBQVcsY0FBYyxDQUFDLEdBQUcsS0FBSyxPQUFPLEtBQUssQ0FBQyxHQUFHO0FBQ2hELFVBQUksV0FBVyxXQUFXLEdBQUcsV0FBVyxJQUFJLElBQUksS0FBSyxDQUFDLFdBQVcsSUFBSSxVQUFVLEdBQUc7QUFDaEYsYUFBSyxPQUFPLE9BQU8sVUFBVTtBQUM3QixhQUFLLEtBQUssT0FBTyxrQkFBa0IsVUFBVTtBQUFBLE1BQy9DO0FBQUEsSUFDRjtBQUVBLGVBQVcsYUFBYSxDQUFDLEdBQUcsS0FBSyxlQUFlLEdBQUc7QUFDakQsVUFBSSxVQUFVLFdBQVcsR0FBRyxXQUFXLElBQUksSUFBSSxLQUFLLENBQUMsY0FBYyxJQUFJLFNBQVMsR0FBRztBQUNqRixhQUFLLGdCQUFnQixPQUFPLFNBQVM7QUFDckMsYUFBSyxLQUFLLE9BQU8sa0JBQWtCLFNBQVM7QUFBQSxNQUM5QztBQUFBLElBQ0Y7QUFFQSxTQUFLLG9CQUFvQjtBQUV6QixlQUFXLE1BQU0sZ0JBQWdCO0FBQy9CLFlBQU0sUUFBUSxLQUFLLE9BQU8sSUFBSSxFQUFFO0FBQ2hDLFVBQUksT0FBTztBQUNULGFBQUssYUFBYSxLQUFLO0FBQUEsTUFDekI7QUFBQSxJQUNGO0FBRUEsVUFBTSxLQUFLLFdBQVc7QUFBQSxFQUN4QjtBQUFBLEVBRVEsd0JBQXdCLFNBQWlCLFVBQStDO0FBQzlGLFVBQU0sUUFBUSxRQUFRLE1BQU0sT0FBTztBQUNuQyxVQUFNLGVBQWUsb0JBQUksSUFBb0I7QUFFN0MsZUFBVyxXQUFXLFVBQVU7QUFDOUIsWUFBTSxZQUFZLFFBQVEsVUFBVSxNQUFNLFFBQVE7QUFDbEQsVUFBSSxZQUFZLEtBQUssYUFBYSxNQUFNLE9BQVE7QUFFaEQsWUFBTSxPQUFPLE1BQU0sU0FBUztBQUM1QixZQUFNLFFBQVEsS0FBSyxNQUFNLHdCQUF3QjtBQUNqRCxVQUFJLENBQUMsTUFBTztBQUVaLFlBQU0sTUFBTSxNQUFNLENBQUMsRUFBRSxRQUFRLGFBQWEsRUFBRSxFQUFFLEtBQUs7QUFDbkQsbUJBQWEsSUFBSSxXQUFXLElBQUksU0FBUyxJQUFJLE1BQU0sUUFBUSxPQUFPO0FBQUEsSUFDcEU7QUFFQSxXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsTUFBYyxhQUE0QjtBQUN4QyxTQUFLLE9BQU8sTUFBTTtBQUNsQixTQUFLLFlBQVksTUFBTTtBQUV2QixRQUFJLEtBQUssa0JBQWtCLFdBQVcsR0FBRztBQUN2QyxXQUFLLGFBQWEsUUFBUSxRQUFRLEtBQUs7QUFDdkMsV0FBSyxhQUFhLFFBQVEsY0FBYyxzQ0FBc0M7QUFDOUUsV0FBSyxhQUFhLEtBQUs7QUFDdkI7QUFBQSxJQUNGO0FBRUEsU0FBSyxhQUFhLEtBQUs7QUFFdkIsZUFBVyxNQUFNLEtBQUssbUJBQW1CO0FBQ3ZDLFlBQU0sUUFBUSxLQUFLLE9BQU8sSUFBSSxFQUFFO0FBQ2hDLFVBQUksQ0FBQyxNQUFPO0FBRVosWUFBTSxPQUFPLEtBQUssT0FBTyxVQUFVLEVBQUUsS0FBSyxnQkFBZ0IsQ0FBQztBQUMzRCxZQUFNLFVBQVUsS0FBSyxVQUFVLEVBQUUsS0FBSyxzQkFBc0IsQ0FBQztBQUM3RCxZQUFNLEtBQUssbUJBQW1CLFNBQVMsTUFBTSxLQUFLO0FBRWxELFlBQU0sVUFBVSxLQUFLLFVBQVUsRUFBRSxLQUFLLGtCQUFrQixNQUFNLGVBQWUsS0FBSyxXQUFXLEtBQUssQ0FBQyxFQUFFLENBQUM7QUFFdEcsWUFBTSxXQUFXLEtBQUssVUFBVSxFQUFFLEtBQUssb0JBQW9CLENBQUM7QUFFNUQsWUFBTSxjQUFjLFNBQVMsU0FBUyxVQUFVO0FBQUEsUUFDOUMsS0FBSztBQUFBLFFBQ0wsTUFBTSxNQUFNLFVBQVUsUUFBUSxRQUFRLFFBQVE7QUFBQSxNQUNoRCxDQUFDO0FBQ0Qsa0JBQVksUUFBUSxjQUFjLE1BQU0sVUFBVSxnQkFBZ0IsYUFBYTtBQUMvRSxrQkFBWSxRQUFRLFNBQVMsTUFBTSxVQUFVLGdCQUFnQixhQUFhO0FBRTFFLFlBQU0sWUFBWSxTQUFTLFNBQVMsVUFBVTtBQUFBLFFBQzVDLEtBQUs7QUFBQSxRQUNMLE1BQU0sUUFBUTtBQUFBLE1BQ2hCLENBQUM7QUFDRCxnQkFBVSxRQUFRLGNBQWMsdUJBQXVCO0FBRXZELFlBQU0sV0FBVyxTQUFTLFNBQVMsVUFBVTtBQUFBLFFBQzNDLEtBQUs7QUFBQSxRQUNMLE1BQU0sUUFBUTtBQUFBLE1BQ2hCLENBQUM7QUFDRCxlQUFTLFFBQVEsY0FBYyxhQUFhO0FBQzVDLGVBQVMsUUFBUSxTQUFTLGFBQWE7QUFFdkMsWUFBTSxZQUFZLFNBQVMsU0FBUyxVQUFVO0FBQUEsUUFDNUMsS0FBSztBQUFBLFFBQ0wsTUFBTSxRQUFRO0FBQUEsTUFDaEIsQ0FBQztBQUNELGdCQUFVLFFBQVEsY0FBYyxjQUFjO0FBQzlDLGdCQUFVLFFBQVEsU0FBUyxjQUFjO0FBRXpDLGtCQUFZLGlCQUFpQixTQUFTLE1BQU07QUFDMUMsWUFBSSxNQUFNLFNBQVM7QUFDakIsZUFBSyxXQUFXLE1BQU0sRUFBRTtBQUFBLFFBQzFCLE9BQU87QUFDTCxlQUFLLFdBQVcsTUFBTSxFQUFFO0FBQUEsUUFDMUI7QUFBQSxNQUNGLENBQUM7QUFFRCxnQkFBVSxpQkFBaUIsU0FBUyxNQUFNO0FBQ3hDLGFBQUssb0JBQW9CLE1BQU0sRUFBRTtBQUFBLE1BQ25DLENBQUM7QUFFRCxlQUFTLGlCQUFpQixTQUFTLE1BQU07QUFDdkMsYUFBSyxXQUFXLE1BQU0sRUFBRTtBQUFBLE1BQzFCLENBQUM7QUFFRCxnQkFBVSxpQkFBaUIsU0FBUyxNQUFNO0FBQ3hDLFlBQUksS0FBSyxjQUFjLG9CQUFvQixHQUFHO0FBQzVDLGVBQUssWUFBWSxNQUFNLEVBQUU7QUFBQSxRQUMzQjtBQUFBLE1BQ0YsQ0FBQztBQUVELFdBQUssWUFBWSxJQUFJLE1BQU0sSUFBSSxFQUFFLFFBQVEsTUFBTSxTQUFTLGFBQWEsV0FBVyxTQUFTLENBQUM7QUFBQSxJQUM1RjtBQUVBLFNBQUssb0JBQW9CO0FBQUEsRUFDM0I7QUFBQSxFQUVRLFdBQVcsT0FBMkI7QUFDNUMsUUFBSSxDQUFDLE1BQU0sV0FBVyxNQUFNLGNBQWMsTUFBTTtBQUM5QyxhQUFPLE1BQU07QUFBQSxJQUNmO0FBRUEsV0FBTyxNQUFNLGFBQWEsS0FBSyxJQUFJLElBQUksTUFBTTtBQUFBLEVBQy9DO0FBQUEsRUFFUSxXQUFXLElBQWtCO0FBQ25DLFVBQU0sUUFBUSxLQUFLLE9BQU8sSUFBSSxFQUFFO0FBQ2hDLFFBQUksQ0FBQyxTQUFTLE1BQU0sUUFBUztBQUU3QixVQUFNLFVBQVU7QUFDaEIsVUFBTSxZQUFZLEtBQUssSUFBSTtBQUMzQixTQUFLLGFBQWEsS0FBSztBQUN2QixTQUFLLG9CQUFvQjtBQUFBLEVBQzNCO0FBQUEsRUFFUSxXQUFXLElBQWtCO0FBQ25DLFVBQU0sUUFBUSxLQUFLLE9BQU8sSUFBSSxFQUFFO0FBQ2hDLFFBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxRQUFTO0FBRTlCLFVBQU0sWUFBWSxLQUFLLFdBQVcsS0FBSztBQUN2QyxVQUFNLFVBQVU7QUFDaEIsVUFBTSxZQUFZO0FBQ2xCLFNBQUssYUFBYSxLQUFLO0FBQ3ZCLFNBQUssb0JBQW9CO0FBQUEsRUFDM0I7QUFBQSxFQUVRLFdBQVcsSUFBa0I7QUFDbkMsVUFBTSxRQUFRLEtBQUssT0FBTyxJQUFJLEVBQUU7QUFDaEMsUUFBSSxDQUFDLE1BQU87QUFFWixVQUFNLFlBQVk7QUFDbEIsVUFBTSxVQUFVO0FBQ2hCLFVBQU0sWUFBWTtBQUNsQixTQUFLLGFBQWEsS0FBSztBQUN2QixTQUFLLG9CQUFvQjtBQUFBLEVBQzNCO0FBQUEsRUFFUSxvQkFBb0IsSUFBa0I7QUFDNUMsVUFBTSxRQUFRLEtBQUssT0FBTyxJQUFJLEVBQUU7QUFDaEMsUUFBSSxDQUFDLE1BQU87QUFFWixRQUFJLGdCQUFnQixLQUFLLEtBQUssTUFBTSxVQUFVLENBQUMsZ0JBQWdCO0FBQzdELFlBQU0sV0FBVztBQUNqQixXQUFLLGFBQWEsS0FBSztBQUN2QixXQUFLLG9CQUFvQjtBQUFBLElBQzNCLENBQUMsRUFBRSxLQUFLO0FBQUEsRUFDVjtBQUFBLEVBRVEsWUFBWSxJQUFrQjtBQUNwQyxVQUFNLFFBQVEsS0FBSyxPQUFPLElBQUksRUFBRTtBQUNoQyxTQUFLLGdCQUFnQixJQUFJLEVBQUU7QUFDM0IsU0FBSyxPQUFPLE9BQU8sRUFBRTtBQUNyQixTQUFLLEtBQUssT0FBTyxpQkFBaUIsSUFBSSxPQUFPLFNBQVMsSUFBSSxPQUFPLFlBQVksTUFBTSxPQUFPLGFBQWEsQ0FBQztBQUN4RyxTQUFLLG9CQUFvQixLQUFLLGtCQUFrQixPQUFPLENBQUMsY0FBYyxjQUFjLEVBQUU7QUFDdEYsU0FBSyxLQUFLLFdBQVc7QUFBQSxFQUN2QjtBQUFBLEVBRVEsa0JBQXdCO0FBQzlCLFVBQU0sV0FBVyxLQUFLO0FBQ3RCLFNBQUssT0FBTyxNQUFNO0FBQ2xCLFNBQUssZ0JBQWdCLE1BQU07QUFDM0IsUUFBSSxVQUFVO0FBQ1osV0FBSyxLQUFLLE9BQU8sZ0JBQWdCLFFBQVE7QUFBQSxJQUMzQztBQUNBLFNBQUssS0FBSyxzQkFBc0I7QUFBQSxFQUNsQztBQUFBLEVBRVEsY0FBYyxTQUEwQjtBQUM5QyxXQUFPLE9BQU8sUUFBUSxPQUFPO0FBQUEsRUFDL0I7QUFBQSxFQUVRLHNCQUE0QjtBQUNsQyxlQUFXLE1BQU0sS0FBSyxtQkFBbUI7QUFDdkMsWUFBTSxRQUFRLEtBQUssT0FBTyxJQUFJLEVBQUU7QUFDaEMsWUFBTSxLQUFLLEtBQUssWUFBWSxJQUFJLEVBQUU7QUFDbEMsVUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFJO0FBRW5CLFNBQUcsUUFBUSxRQUFRLGVBQWUsS0FBSyxXQUFXLEtBQUssQ0FBQyxDQUFDO0FBQ3pELFNBQUcsWUFBWSxRQUFRLE1BQU0sVUFBVSxRQUFRLFFBQVEsUUFBUSxJQUFJO0FBQ25FLFNBQUcsWUFBWSxRQUFRLGNBQWMsTUFBTSxVQUFVLGdCQUFnQixhQUFhO0FBQ2xGLFNBQUcsWUFBWSxRQUFRLFNBQVMsTUFBTSxVQUFVLGdCQUFnQixhQUFhO0FBRTdFLFlBQU0sZ0JBQWdCLE1BQU0sYUFBYSxPQUFPLE1BQU0sTUFBTSxXQUFXLEtBQU8sUUFBUSxDQUFDLEVBQUUsUUFBUSxRQUFRLEVBQUU7QUFDM0csU0FBRyxVQUFVO0FBQUEsUUFDWDtBQUFBLFFBQ0EsTUFBTSxhQUFhLE9BQU8sMEJBQTBCLFdBQVcsYUFBYTtBQUFBLE1BQzlFO0FBRUEsWUFBTSxVQUFVLEtBQUssV0FBVyxLQUFLO0FBQ3JDLFlBQU0sWUFBWSxNQUFNLGFBQWE7QUFDckMsWUFBTSxlQUFlLGFBQWEsV0FBVyxNQUFNLFlBQVk7QUFFL0QsU0FBRyxPQUFPLFlBQVksMEJBQTBCLDBCQUEwQixnQ0FBZ0M7QUFDMUcsU0FBRyxRQUFRLFlBQVksK0JBQStCLDJCQUEyQjtBQUVqRixVQUFJLE1BQU0sV0FBVyxjQUFjO0FBQ2pDLFdBQUcsT0FBTyxTQUFTLGdDQUFnQztBQUNuRCxXQUFHLFFBQVEsU0FBUyw2QkFBNkI7QUFBQSxNQUNuRCxXQUFXLE1BQU0sU0FBUztBQUN4QixXQUFHLE9BQU8sU0FBUyx3QkFBd0I7QUFBQSxNQUM3QyxXQUFXLFVBQVUsR0FBRztBQUN0QixXQUFHLE9BQU8sU0FBUyx3QkFBd0I7QUFBQSxNQUM3QztBQUVBLFVBQUksQ0FBQyxNQUFNLFdBQVcsV0FBVztBQUMvQixZQUFJLGNBQWM7QUFDaEIsYUFBRyxRQUFRLFNBQVMsNkJBQTZCO0FBQUEsUUFDbkQsT0FBTztBQUNMLGFBQUcsUUFBUSxTQUFTLDJCQUEyQjtBQUFBLFFBQ2pEO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBRUY7QUF2WU0saUJBV29CLG1CQUFtQjtBQThYN0MsSUFBTSxrQkFBTixjQUE4QixzQkFBTTtBQUFBLEVBR2xDLFlBQ0UsS0FDaUIsaUJBQ0EsVUFDakI7QUFDQSxVQUFNLEdBQUc7QUFIUTtBQUNBO0FBR2pCLFNBQUssYUFBYSxvQkFBb0IsT0FBTyxNQUFNLGtCQUFrQixLQUFPLFNBQVM7QUFBQSxFQUN2RjtBQUFBLEVBRUEsU0FBZTtBQUNiLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFDdEIsY0FBVSxNQUFNO0FBQ2hCLGNBQVUsU0FBUyxNQUFNLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUVwRCxRQUFJLHdCQUFRLFNBQVMsRUFDbEIsUUFBUSxrQkFBa0IsRUFDMUIsUUFBUSw2RUFBNkUsRUFDckYsUUFBUSxDQUFDLFNBQVM7QUFDakIsV0FBSyxTQUFTLEtBQUssVUFBVTtBQUM3QixXQUFLLFFBQVEsYUFBYSxRQUFRLFFBQVE7QUFDMUMsV0FBSyxRQUFRLGFBQWEsT0FBTyxHQUFHO0FBQ3BDLFdBQUssUUFBUSxhQUFhLFFBQVEsS0FBSztBQUN2QyxXQUFLLFFBQVEsTUFBTSxRQUFRO0FBQzNCLFdBQUssU0FBUyxDQUFDLFVBQVU7QUFDdkIsYUFBSyxhQUFhO0FBQUEsTUFDcEIsQ0FBQztBQUNELFdBQUssUUFBUSxpQkFBaUIsV0FBVyxDQUFDLFFBQVE7QUFDaEQsWUFBSSxJQUFJLFFBQVEsU0FBUztBQUN2QixlQUFLLE9BQU87QUFBQSxRQUNkO0FBQUEsTUFDRixDQUFDO0FBQ0QsYUFBTyxXQUFXLE1BQU0sS0FBSyxRQUFRLE1BQU0sR0FBRyxFQUFFO0FBQUEsSUFDbEQsQ0FBQztBQUVILFVBQU0sU0FBUyxVQUFVLFVBQVUsRUFBRSxLQUFLLHlCQUF5QixDQUFDO0FBQ3BFLFdBQU8sU0FBUyxVQUFVLEVBQUUsTUFBTSxnQkFBZ0IsS0FBSyxjQUFjLENBQUMsRUFBRSxpQkFBaUIsU0FBUyxNQUFNO0FBQ3RHLFdBQUssU0FBUyxJQUFJO0FBQ2xCLFdBQUssTUFBTTtBQUFBLElBQ2IsQ0FBQztBQUNELFdBQU8sU0FBUyxVQUFVLEVBQUUsTUFBTSxRQUFRLEtBQUssVUFBVSxDQUFDLEVBQUUsaUJBQWlCLFNBQVMsTUFBTTtBQUMxRixXQUFLLE9BQU87QUFBQSxJQUNkLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUSxTQUFlO0FBQ3JCLFVBQU0sYUFBYSxLQUFLLFdBQVcsS0FBSyxFQUFFLFFBQVEsS0FBSyxHQUFHO0FBQzFELFFBQUksQ0FBQyxZQUFZO0FBQ2YsV0FBSyxTQUFTLElBQUk7QUFDbEIsV0FBSyxNQUFNO0FBQ1g7QUFBQSxJQUNGO0FBRUEsVUFBTSxVQUFVLE9BQU8sVUFBVTtBQUNqQyxRQUFJLENBQUMsT0FBTyxTQUFTLE9BQU8sS0FBSyxXQUFXLEdBQUc7QUFDN0MsWUFBTSxVQUFXLEtBQUssVUFBVSxjQUFjLGtCQUFrQixNQUE2QixNQUFNO0FBQ2pHLGNBQU0sS0FBSyxLQUFLLFVBQVUsU0FBUyxLQUFLLEVBQUUsS0FBSyxrQkFBa0IsQ0FBQztBQUNsRSxXQUFHLE1BQU0sUUFBUTtBQUNqQixlQUFPO0FBQUEsTUFDVCxHQUFHO0FBQ0gsY0FBUSxRQUFRLHFDQUFxQztBQUNyRDtBQUFBLElBQ0Y7QUFFQSxTQUFLLFNBQVMsS0FBSyxNQUFNLFVBQVUsS0FBSyxHQUFJLENBQUM7QUFDN0MsU0FBSyxNQUFNO0FBQUEsRUFDYjtBQUFBLEVBRUEsVUFBZ0I7QUFDZCxTQUFLLFVBQVUsTUFBTTtBQUFBLEVBQ3ZCO0FBQUEsRUFFUSxhQUFhLE9BQXlCO0FBQzVDLFVBQU0sVUFBVSxLQUFLLFdBQVcsS0FBSztBQUNyQyxTQUFLLEtBQUssT0FBTyxrQkFBa0IsTUFBTSxJQUFJO0FBQUEsTUFDM0MsT0FBTyxNQUFNO0FBQUEsTUFDYixXQUFXO0FBQUEsTUFDWCxVQUFVLE1BQU07QUFBQSxNQUNoQixTQUFTO0FBQUEsSUFDWCxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRUEsTUFBYyxpQkFBaUIsZUFBdUM7QUFDcEUsVUFBTSxVQUEyQixDQUFDO0FBRWxDLGVBQVcsU0FBUyxLQUFLLE9BQU8sT0FBTyxHQUFHO0FBQ3hDLFVBQUksVUFBVSxLQUFLLFdBQVcsS0FBSztBQUNuQyxVQUFJLGlCQUFpQixNQUFNLFNBQVM7QUFDbEMsY0FBTSxZQUFZO0FBQ2xCLGNBQU0sVUFBVTtBQUNoQixjQUFNLFlBQVk7QUFBQSxNQUNwQixXQUFXLENBQUMsTUFBTSxTQUFTO0FBQ3pCLGtCQUFVLE1BQU07QUFBQSxNQUNsQjtBQUVBLGNBQVE7QUFBQSxRQUNOLEtBQUssT0FBTyxrQkFBa0IsTUFBTSxJQUFJO0FBQUEsVUFDdEMsT0FBTyxNQUFNO0FBQUEsVUFDYixXQUFXO0FBQUEsVUFDWCxVQUFVLE1BQU07QUFBQSxVQUNoQixTQUFTO0FBQUEsUUFDWCxDQUFDO0FBQUEsTUFDSDtBQUFBLElBQ0Y7QUFFQSxVQUFNLFFBQVEsSUFBSSxPQUFPO0FBQUEsRUFDM0I7QUFBQSxFQUVRLDBCQUFnQztBQUN0QyxlQUFXLFNBQVMsS0FBSyxPQUFPLE9BQU8sR0FBRztBQUN4QyxVQUFJLE1BQU0sU0FBUztBQUNqQixhQUFLLGFBQWEsS0FBSztBQUFBLE1BQ3pCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQWMsbUJBQW1CLFNBQXNCLFVBQWlDO0FBQ3RGLFVBQU0sYUFBYSxTQUFTLGNBQWMsS0FBSztBQUMvQyxVQUFNLGlDQUFpQixPQUFPLEtBQUssS0FBSyxVQUFVLFlBQVksS0FBSyxtQkFBbUIsSUFBSSxJQUFJO0FBQzlGLFNBQUssNEJBQTRCLFlBQVksUUFBUTtBQUVyRCxVQUFNLFNBQVMsV0FBVyxlQUFlLElBQUksUUFBUSxRQUFRLEdBQUcsRUFBRSxLQUFLO0FBQ3ZFLFFBQUksTUFBTSxTQUFTLGlCQUFpQixrQkFBa0I7QUFDcEQsV0FBSyx3QkFBd0IsWUFBWSxpQkFBaUIsZ0JBQWdCO0FBQzFFLGNBQVEsUUFBUSxTQUFTLEtBQUs7QUFDOUIsY0FBUSxRQUFRLGNBQWMsS0FBSztBQUFBLElBQ3JDO0FBRUEsWUFBUSxNQUFNO0FBQ2QsV0FBTyxXQUFXLFlBQVk7QUFDNUIsY0FBUSxZQUFZLFdBQVcsVUFBVTtBQUFBLElBQzNDO0FBQUEsRUFDRjtBQUFBLEVBRVEsNEJBQTRCLGFBQTBCLFVBQXdCO0FBQ3BGLFVBQU0sYUFBYSxTQUFTLGNBQWMsS0FBSztBQUMvQyxlQUFXLFlBQVk7QUFFdkIsVUFBTSxpQkFBaUIsTUFBTSxLQUFLLFdBQVcsaUJBQWlCLEdBQUcsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxZQUFZO0FBQ3RGLFlBQU0saUJBQWlCLFFBQVEsa0JBQWtCO0FBQ2pELGFBQU8sZUFBZSxTQUFTO0FBQUEsSUFDakMsQ0FBQztBQUNELFNBQUssd0JBQXdCLGdCQUFnQixXQUFXO0FBQUEsRUFDMUQ7QUFBQSxFQUVRLHdCQUF3QixnQkFBMkIsYUFBZ0M7QUFDekYsVUFBTSxjQUFjLG9CQUFJLElBQWE7QUFFckMsZUFBVyxZQUFZLGdCQUFnQjtBQUNyQyxZQUFNLGFBQWEsU0FBUyxhQUFhLFFBQVEsUUFBUSxHQUFHLEVBQUUsS0FBSztBQUNuRSxVQUFJLENBQUMsV0FBWTtBQUVqQixZQUFNLG1CQUFtQixNQUFNLEtBQUssWUFBWSxpQkFBaUIsU0FBUyxRQUFRLFlBQVksQ0FBQyxDQUFDO0FBQ2hHLFlBQU0sV0FBVyxpQkFBaUIsS0FBSyxDQUFDLGNBQWM7QUFDcEQsWUFBSSxZQUFZLElBQUksU0FBUyxHQUFHO0FBQzlCLGlCQUFPO0FBQUEsUUFDVDtBQUVBLGNBQU0sZ0JBQWdCLFVBQVUsYUFBYSxRQUFRLFFBQVEsR0FBRyxFQUFFLEtBQUs7QUFDdkUsZUFBTyxrQkFBa0I7QUFBQSxNQUMzQixDQUFDO0FBRUQsVUFBSSxDQUFDLFNBQVU7QUFFZixrQkFBWSxJQUFJLFFBQVE7QUFDeEIsaUJBQVcsUUFBUSxTQUFTLGtCQUFrQixHQUFHO0FBQy9DLGlCQUFTLGFBQWEsTUFBTSxTQUFTLGFBQWEsSUFBSSxLQUFLLEVBQUU7QUFBQSxNQUMvRDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFUSx3QkFBd0IsYUFBMEIsV0FBeUI7QUFDakYsVUFBTSxTQUFTLFNBQVMsaUJBQWlCLGFBQWEsV0FBVyxTQUFTO0FBQzFFLFVBQU0sWUFBb0IsQ0FBQztBQUUzQixXQUFPLE9BQU8sU0FBUyxHQUFHO0FBQ3hCLGdCQUFVLEtBQUssT0FBTyxXQUFtQjtBQUFBLElBQzNDO0FBRUEsUUFBSSxhQUFhO0FBQ2pCLFFBQUksZUFBZTtBQUVuQixlQUFXLFlBQVksV0FBVztBQUNoQyxZQUFNLGFBQWEsU0FBUyxhQUFhLFFBQVEsUUFBUSxHQUFHLEtBQUs7QUFDakUsVUFBSSxDQUFDLFdBQVcsS0FBSyxHQUFHO0FBQ3RCLFlBQUksY0FBYztBQUNoQixtQkFBUyxjQUFjO0FBQUEsUUFDekI7QUFDQTtBQUFBLE1BQ0Y7QUFFQSxVQUFJLGNBQWM7QUFDaEIsaUJBQVMsY0FBYztBQUN2QjtBQUFBLE1BQ0Y7QUFFQSxZQUFNLFlBQVksWUFBWTtBQUM5QixVQUFJLFdBQVcsVUFBVSxXQUFXO0FBQ2xDLHNCQUFjLFdBQVc7QUFDekIsaUJBQVMsY0FBYztBQUN2QjtBQUFBLE1BQ0Y7QUFFQSxZQUFNLGNBQWMsS0FBSyxJQUFJLEdBQUcsWUFBWSxDQUFDO0FBQzdDLFlBQU0sZ0JBQWdCLEdBQUcsV0FBVyxNQUFNLEdBQUcsV0FBVyxFQUFFLFFBQVEsQ0FBQztBQUNuRSxlQUFTLGNBQWM7QUFDdkIscUJBQWU7QUFDZixtQkFBYTtBQUFBLElBQ2Y7QUFFQSxTQUFLLGlCQUFpQixXQUFXO0FBQUEsRUFDbkM7QUFBQSxFQUVRLGlCQUFpQixRQUEyQjtBQUNsRCxVQUFNLGFBQWEsTUFBTSxLQUFLLE9BQU8sVUFBVTtBQUUvQyxlQUFXLGFBQWEsWUFBWTtBQUNsQyxVQUFJLFVBQVUsYUFBYSxLQUFLLFdBQVc7QUFDekMsWUFBSSxFQUFFLFVBQVUsZUFBZSxJQUFJLEtBQUssR0FBRztBQUN6QyxvQkFBVSxPQUFPO0FBQUEsUUFDbkI7QUFDQTtBQUFBLE1BQ0Y7QUFFQSxVQUFJLHFCQUFxQixhQUFhO0FBQ3BDLGFBQUssaUJBQWlCLFNBQVM7QUFDL0IsY0FBTSxxQkFBcUIsVUFBVSxlQUFlLElBQUksS0FBSyxFQUFFLFNBQVM7QUFDeEUsY0FBTSxxQkFBcUIsVUFBVSxTQUFTLFNBQVM7QUFDdkQsWUFBSSxDQUFDLHFCQUFxQixDQUFDLG9CQUFvQjtBQUM3QyxvQkFBVSxPQUFPO0FBQUEsUUFDbkI7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRjtBQUVBLElBQXFCLHFCQUFyQixjQUFnRCx1QkFBTztBQUFBLEVBQXZEO0FBQUE7QUFDRSxTQUFRLFVBQTRCLEVBQUUsU0FBUyxpQkFBaUIsUUFBUSxDQUFDLEVBQUU7QUFDM0UsU0FBUSxhQUE0QjtBQUFBO0FBQUEsRUFFcEMsTUFBTSxTQUF3QjtBQUM1QixTQUFLLFVBQVUsS0FBSyxxQkFBcUIsTUFBTSxLQUFLLFNBQVMsQ0FBQztBQUM5RCxRQUFJLEtBQUssZUFBZSxHQUFHO0FBQ3pCLFlBQU0sS0FBSyxTQUFTLEtBQUssT0FBTztBQUFBLElBQ2xDO0FBRUEsU0FBSyxhQUFhLHlCQUF5QixDQUFDLFNBQVMsSUFBSSxpQkFBaUIsTUFBTSxJQUFJLENBQUM7QUFFckYsU0FBSyxjQUFjLFNBQVMseUJBQXlCLE1BQU07QUFDekQsV0FBSyxLQUFLLGFBQWE7QUFBQSxJQUN6QixDQUFDO0FBRUQsU0FBSyxXQUFXO0FBQUEsTUFDZCxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixVQUFVLFlBQVk7QUFDcEIsY0FBTSxLQUFLLGFBQWE7QUFBQSxNQUMxQjtBQUFBLElBQ0YsQ0FBQztBQUVELFNBQUssSUFBSSxVQUFVLGNBQWMsTUFBTTtBQUNyQyxXQUFLLEtBQUssYUFBYTtBQUFBLElBQ3pCLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFQSxXQUFpQjtBQUNmLFFBQUksS0FBSyxlQUFlLE1BQU07QUFDNUIsYUFBTyxhQUFhLEtBQUssVUFBVTtBQUNuQyxXQUFLLGFBQWE7QUFDbEIsV0FBSyxLQUFLLFNBQVMsS0FBSyxPQUFPO0FBQUEsSUFDakM7QUFDQSxTQUFLLElBQUksVUFBVSxtQkFBbUIsdUJBQXVCO0FBQUEsRUFDL0Q7QUFBQSxFQUVBLGVBQWUsSUFBMEM7QUFDdkQsV0FBTyxLQUFLLFFBQVEsT0FBTyxFQUFFO0FBQUEsRUFDL0I7QUFBQSxFQUVBLDBCQUEwQixVQUErQjtBQUN2RCxVQUFNLGFBQWEsb0JBQUksSUFBWTtBQUNuQyxVQUFNLFNBQVMsR0FBRyxRQUFRO0FBRTFCLGVBQVcsQ0FBQyxJQUFJLEtBQUssS0FBSyxPQUFPLFFBQVEsS0FBSyxRQUFRLE1BQU0sR0FBRztBQUM3RCxVQUFJLEdBQUcsV0FBVyxNQUFNLEtBQUssTUFBTSxTQUFTO0FBQzFDLG1CQUFXLElBQUksRUFBRTtBQUFBLE1BQ25CO0FBQUEsSUFDRjtBQUVBLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFQSxNQUFNLGtCQUNKLElBQ0EsT0FDZTtBQUNmLFNBQUssUUFBUSxPQUFPLEVBQUUsSUFBSTtBQUFBLE1BQ3hCLE9BQU8sTUFBTTtBQUFBLE1BQ2IsV0FBVyxLQUFLLElBQUksR0FBRyxLQUFLLE1BQU0sTUFBTSxTQUFTLENBQUM7QUFBQSxNQUNsRCxVQUFVLE1BQU07QUFBQSxNQUNoQixTQUFTLE1BQU07QUFBQSxNQUNmLFdBQVcsS0FBSyxJQUFJO0FBQUEsSUFDdEI7QUFFQSxTQUFLLGFBQWE7QUFBQSxFQUNwQjtBQUFBLEVBRUEsTUFBTSxpQkFBaUIsSUFBWSxPQUFlLFVBQXlCLFdBQWtDO0FBQzNHLFNBQUssUUFBUSxPQUFPLEVBQUUsSUFBSTtBQUFBLE1BQ3hCO0FBQUEsTUFDQSxXQUFXLEtBQUssSUFBSSxHQUFHLEtBQUssTUFBTSxTQUFTLENBQUM7QUFBQSxNQUM1QztBQUFBLE1BQ0EsU0FBUztBQUFBLE1BQ1QsV0FBVyxLQUFLLElBQUk7QUFBQSxJQUN0QjtBQUVBLFNBQUssYUFBYTtBQUFBLEVBQ3BCO0FBQUEsRUFFQSxNQUFNLGtCQUFrQixJQUEyQjtBQUNqRCxRQUFJLEVBQUUsTUFBTSxLQUFLLFFBQVEsU0FBUztBQUNoQztBQUFBLElBQ0Y7QUFFQSxXQUFPLEtBQUssUUFBUSxPQUFPLEVBQUU7QUFDN0IsU0FBSyxhQUFhO0FBQUEsRUFDcEI7QUFBQSxFQUVBLE1BQU0sZ0JBQWdCLFVBQWlDO0FBQ3JELFVBQU0sU0FBUyxHQUFHLFFBQVE7QUFDMUIsUUFBSSxVQUFVO0FBRWQsZUFBVyxNQUFNLE9BQU8sS0FBSyxLQUFLLFFBQVEsTUFBTSxHQUFHO0FBQ2pELFVBQUksR0FBRyxXQUFXLE1BQU0sR0FBRztBQUN6QixlQUFPLEtBQUssUUFBUSxPQUFPLEVBQUU7QUFDN0Isa0JBQVU7QUFBQSxNQUNaO0FBQUEsSUFDRjtBQUVBLFFBQUksU0FBUztBQUNYLFdBQUssYUFBYTtBQUFBLElBQ3BCO0FBQUEsRUFDRjtBQUFBLEVBRVEscUJBQXFCLEtBQWdDO0FBQzNELFVBQU0sV0FBNkIsRUFBRSxTQUFTLGlCQUFpQixRQUFRLENBQUMsRUFBRTtBQUMxRSxRQUFJLENBQUMsT0FBTyxPQUFPLFFBQVEsVUFBVTtBQUNuQyxhQUFPO0FBQUEsSUFDVDtBQUVBLFVBQU0sWUFBWTtBQUNsQixRQUFJLENBQUMsVUFBVSxVQUFVLE9BQU8sVUFBVSxXQUFXLFVBQVU7QUFDN0QsYUFBTztBQUFBLElBQ1Q7QUFFQSxVQUFNLG1CQUFxRCxDQUFDO0FBQzVELGVBQVcsQ0FBQyxJQUFJLEtBQUssS0FBSyxPQUFPLFFBQVEsVUFBVSxNQUFNLEdBQUc7QUFDMUQsVUFBSSxDQUFDLFNBQVMsT0FBTyxVQUFVLFVBQVU7QUFDdkM7QUFBQSxNQUNGO0FBRUEsWUFBTSxRQUFRO0FBQ2QsdUJBQWlCLEVBQUUsSUFBSTtBQUFBLFFBQ3JCLE9BQU8sT0FBTyxNQUFNLFVBQVUsV0FBVyxNQUFNLFFBQVE7QUFBQSxRQUN2RCxXQUFXLE9BQU8sU0FBUyxNQUFNLFNBQVMsSUFBSSxLQUFLLElBQUksR0FBRyxLQUFLLE1BQU0sTUFBTSxhQUFhLENBQUMsQ0FBQyxJQUFJO0FBQUEsUUFDOUYsVUFDRSxNQUFNLGFBQWEsUUFBUSxNQUFNLGFBQWEsU0FDMUMsT0FDQSxPQUFPLFNBQVMsTUFBTSxRQUFRLElBQzVCLEtBQUssSUFBSSxHQUFHLEtBQUssTUFBTSxNQUFNLFFBQVEsQ0FBQyxJQUN0QztBQUFBLFFBQ1IsU0FBUyxRQUFRLE1BQU0sT0FBTztBQUFBLFFBQzlCLFdBQ0UsT0FBTyxTQUFTLE1BQU0sU0FBUyxNQUFNLE1BQU0sYUFBYSxLQUFLLElBQ3pELEtBQUssTUFBTSxNQUFNLFNBQW1CLElBQ3BDLEtBQUssSUFBSTtBQUFBLE1BQ2pCO0FBQUEsSUFDRjtBQUVBLFdBQU87QUFBQSxNQUNMLFNBQVM7QUFBQSxNQUNULFFBQVE7QUFBQSxJQUNWO0FBQUEsRUFDRjtBQUFBLEVBRVEsaUJBQTBCO0FBQ2hDLFVBQU0sTUFBTSxLQUFLLElBQUk7QUFDckIsUUFBSSxVQUFVO0FBRWQsZUFBVyxDQUFDLElBQUksS0FBSyxLQUFLLE9BQU8sUUFBUSxLQUFLLFFBQVEsTUFBTSxHQUFHO0FBQzdELFVBQUksTUFBTSxNQUFNLFlBQVksb0JBQW9CO0FBQzlDLGVBQU8sS0FBSyxRQUFRLE9BQU8sRUFBRTtBQUM3QixrQkFBVTtBQUFBLE1BQ1o7QUFBQSxJQUNGO0FBRUEsV0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUVRLGVBQXFCO0FBQzNCLFFBQUksS0FBSyxlQUFlLEdBQUc7QUFBQSxJQUUzQjtBQUVBLFFBQUksS0FBSyxlQUFlLE1BQU07QUFDNUIsYUFBTyxhQUFhLEtBQUssVUFBVTtBQUFBLElBQ3JDO0FBRUEsU0FBSyxhQUFhLE9BQU8sV0FBVyxNQUFNO0FBQ3hDLFdBQUssYUFBYTtBQUNsQixXQUFLLEtBQUssU0FBUyxLQUFLLE9BQU87QUFBQSxJQUNqQyxHQUFHLEdBQUc7QUFBQSxFQUNSO0FBQUEsRUFFQSxNQUFjLGVBQThCO0FBQzFDLFVBQU0saUJBQWlCLEtBQUssSUFBSSxVQUFVLGdCQUFnQix1QkFBdUI7QUFDakYsUUFBSSxlQUFlLFNBQVMsR0FBRztBQUM3QixZQUFNLEtBQUssSUFBSSxVQUFVLFdBQVcsZUFBZSxDQUFDLENBQUM7QUFDckQ7QUFBQSxJQUNGO0FBRUEsVUFBTSxPQUFPLEtBQUssSUFBSSxVQUFVLGFBQWEsS0FBSztBQUNsRCxRQUFJLENBQUMsS0FBTTtBQUVYLFVBQU0sS0FBSyxhQUFhO0FBQUEsTUFDdEIsTUFBTTtBQUFBLE1BQ04sUUFBUTtBQUFBLElBQ1YsQ0FBQztBQUVELFVBQU0sS0FBSyxJQUFJLFVBQVUsV0FBVyxJQUFJO0FBQUEsRUFDMUM7QUFDRjsiLAogICJuYW1lcyI6IFtdCn0K
