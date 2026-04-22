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
    void this.refreshFromActiveFile();
  }
  async onClose() {
    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
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
      if (!existing) {
        this.timers.set(id, {
          id,
          title: headingTitle,
          elapsedMs: 0,
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
      }
    }
    for (const deletedId of [...this.deletedTimerIds]) {
      if (deletedId.startsWith(`${activeFile.path}::`) && !allHeadingIds.has(deletedId)) {
        this.deletedTimerIds.delete(deletedId);
      }
    }
    this.currentHeadingIds = nextHeadingIds;
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
      const titleData = await this.getRenderedTitle(entry.title);
      if (titleData.trimmed) {
        titleEl.setText(titleData.content);
      } else {
        await import_obsidian.MarkdownRenderer.render(this.app, titleData.content, titleEl, this.currentFilePath ?? "", this);
        this.restoreInlineHtmlAttributes(titleEl, entry.title);
      }
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
    this.updateTimerDisplays();
  }
  pauseTimer(id) {
    const entry = this.timers.get(id);
    if (!entry || !entry.running) return;
    entry.elapsedMs = this.getElapsed(entry);
    entry.running = false;
    entry.startedAt = null;
    this.updateTimerDisplays();
  }
  resetTimer(id) {
    const entry = this.timers.get(id);
    if (!entry) return;
    entry.elapsedMs = 0;
    entry.running = false;
    entry.startedAt = null;
    this.updateTimerDisplays();
  }
  deleteTimer(id) {
    this.deletedTimerIds.add(id);
    this.timers.delete(id);
    this.currentHeadingIds = this.currentHeadingIds.filter((headingId) => headingId !== id);
    void this.renderList();
  }
  deleteAllTimers() {
    this.timers.clear();
    this.deletedTimerIds.clear();
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
  async getRenderedTitle(rawTitle) {
    const tempEl = document.createElement("div");
    await import_obsidian.MarkdownRenderer.render(this.app, rawTitle, tempEl, this.currentFilePath ?? "", this);
    const plain = (tempEl.textContent ?? "").replace(/\s+/g, " ").trim();
    if (plain.length <= _TimerSidebarView.TITLE_MAX_LENGTH) {
      return { content: rawTitle, trimmed: false };
    }
    const shortened = `${plain.slice(0, _TimerSidebarView.TITLE_MAX_LENGTH - 3).trimEnd()}...`;
    return { content: shortened, trimmed: true };
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
};
_TimerSidebarView.TITLE_MAX_LENGTH = 60;
var TimerSidebarView = _TimerSidebarView;
var TimerSidebarPlugin = class extends import_obsidian.Plugin {
  async onload() {
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
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_TIMER_SIDEBAR);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcbiAgQXBwLFxuICBJdGVtVmlldyxcbiAgTWFya2Rvd25SZW5kZXJlcixcbiAgUGx1Z2luLFxuICBXb3Jrc3BhY2VMZWFmLFxuICBIZWFkaW5nQ2FjaGVcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmNvbnN0IFZJRVdfVFlQRV9USU1FUl9TSURFQkFSID0gXCJqdy10aW1lci1zaWRlYmFyLXZpZXdcIjtcbmNvbnN0IFVJX1RFWFQgPSB7XG4gIHRpdGxlOiBcIlx1MjNGMVx1RkUwRlwiLFxuICBlbXB0eTogXCJcdTIyMDVcIixcbiAgb3BlbjogXCJcdTI1QjZcdUZFMEZcIixcbiAgcGF1c2U6IFwiXHUyM0Y4XHVGRTBGXCIsXG4gIHJlc2V0OiBcIlx1RDgzRFx1REQwNFwiLFxuICBkZWxldGU6IFwiXHVEODNEXHVEREQxXHVGRTBGXCIsXG4gIHJlc2V0QWxsOiBcIlx1MjY3Qlx1RkUwRlwiXG59IGFzIGNvbnN0O1xuXG5pbnRlcmZhY2UgVGltZXJFbnRyeSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGVsYXBzZWRNczogbnVtYmVyO1xuICBydW5uaW5nOiBib29sZWFuO1xuICBzdGFydGVkQXQ6IG51bWJlciB8IG51bGw7XG59XG5cbmludGVyZmFjZSBUaW1lclVpUmVmIHtcbiAgY2FyZEVsOiBIVE1MRWxlbWVudDtcbiAgdGltZXJFbDogSFRNTEVsZW1lbnQ7XG4gIHBsYXlTdG9wQnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgcmVzZXRCdG46IEhUTUxCdXR0b25FbGVtZW50O1xufVxuXG5mdW5jdGlvbiBidWlsZFRpbWVySWQoZmlsZVBhdGg6IHN0cmluZywgaGVhZGluZzogSGVhZGluZ0NhY2hlKTogc3RyaW5nIHtcbiAgY29uc3QgbGluZSA9IGhlYWRpbmcucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gMDtcbiAgcmV0dXJuIGAke2ZpbGVQYXRofTo6JHtsaW5lfTo6JHtoZWFkaW5nLmhlYWRpbmd9YDtcbn1cblxuZnVuY3Rpb24gZm9ybWF0RHVyYXRpb24obXM6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IHRvdGFsU2Vjb25kcyA9IE1hdGgubWF4KDAsIE1hdGguZmxvb3IobXMgLyAxMDAwKSk7XG4gIGNvbnN0IGhvdXJzID0gTWF0aC5mbG9vcih0b3RhbFNlY29uZHMgLyAzNjAwKTtcbiAgY29uc3QgbWludXRlcyA9IE1hdGguZmxvb3IoKHRvdGFsU2Vjb25kcyAlIDM2MDApIC8gNjApO1xuICBjb25zdCBzZWNvbmRzID0gdG90YWxTZWNvbmRzICUgNjA7XG5cbiAgcmV0dXJuIGAke1N0cmluZyhob3VycykucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhtaW51dGVzKS5wYWRTdGFydCgyLCBcIjBcIil9OiR7U3RyaW5nKHNlY29uZHMpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xufVxuXG5jbGFzcyBUaW1lclNpZGViYXJWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIHRpbWVycyA9IG5ldyBNYXA8c3RyaW5nLCBUaW1lckVudHJ5PigpO1xuICBwcml2YXRlIGRlbGV0ZWRUaW1lcklkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBwcml2YXRlIHRpbWVyVWlSZWZzID0gbmV3IE1hcDxzdHJpbmcsIFRpbWVyVWlSZWY+KCk7XG4gIHByaXZhdGUgY3VycmVudEhlYWRpbmdJZHM6IHN0cmluZ1tdID0gW107XG4gIHByaXZhdGUgY3VycmVudEZpbGVQYXRoOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICBwcml2YXRlIGxpc3RFbCE6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGVtcHR5U3RhdGVFbCE6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIHRpY2tIYW5kbGU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBUSVRMRV9NQVhfTEVOR1RIID0gNjA7XG5cbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZiwgcHJpdmF0ZSByZWFkb25seSBwbHVnaW46IFRpbWVyU2lkZWJhclBsdWdpbikge1xuICAgIHN1cGVyKGxlYWYpO1xuICB9XG5cbiAgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gVklFV19UWVBFX1RJTUVSX1NJREVCQVI7XG4gIH1cblxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcge1xuICAgIHJldHVybiBcIkpXIFRpbWVyc1wiO1xuICB9XG5cbiAgZ2V0SWNvbigpOiBzdHJpbmcge1xuICAgIHJldHVybiBcInRpbWVyXCI7XG4gIH1cblxuICBhc3luYyBvbk9wZW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5jb250ZW50RWwuZW1wdHkoKTtcbiAgICB0aGlzLmNvbnRlbnRFbC5hZGRDbGFzcyhcImp3LXRpbWVyLXNpZGViYXItcm9vdFwiKTtcblxuICAgIGNvbnN0IHdyYXBwZXIgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItd3JhcHBlclwiIH0pO1xuXG4gICAgY29uc3QgdGl0bGVFbCA9IHdyYXBwZXIuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFVJX1RFWFQudGl0bGUsIGNsczogXCJqdy10aW1lci10aXRsZVwiIH0pO1xuICAgIHRpdGxlRWwuc2V0QXR0cihcImFyaWEtbGl2ZVwiLCBcInBvbGl0ZVwiKTtcbiAgICB0aXRsZUVsLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiVGltZXJzIGJ5IGhlYWRpbmdcIik7XG5cbiAgICB0aGlzLmxpc3RFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWxpc3RcIiB9KTtcbiAgICB0aGlzLmVtcHR5U3RhdGVFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWVtcHR5XCIgfSk7XG5cbiAgICBjb25zdCBmb290ZXJFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWZvb3RlclwiIH0pO1xuICAgIGNvbnN0IGRlbGV0ZUFsbEJ0biA9IGZvb3RlckVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgIHRleHQ6IFVJX1RFWFQucmVzZXRBbGwsXG4gICAgICBjbHM6IFwianctdGltZXItYnRuIGp3LXRpbWVyLWJ0bi1kYW5nZXJcIlxuICAgIH0pO1xuICAgIGRlbGV0ZUFsbEJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIlJlc2V0IGFsbCB0aW1lcnNcIik7XG4gICAgZGVsZXRlQWxsQnRuLnNldEF0dHIoXCJ0aXRsZVwiLCBcIlJlc2V0IGFsbCB0aW1lcnNcIik7XG5cbiAgICBkZWxldGVBbGxCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGlmICh0aGlzLmNvbmZpcm1BY3Rpb24oXCJSZXNldCBhbGwgdGltZXJzP1wiKSkge1xuICAgICAgICB0aGlzLmRlbGV0ZUFsbFRpbWVycygpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCAoKSA9PiB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCkpKTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUub24oXCJjaGFuZ2VkXCIsIChmaWxlKSA9PiB7XG4gICAgICAgIGlmIChmaWxlLnBhdGggPT09IHRoaXMuY3VycmVudEZpbGVQYXRoKSB7XG4gICAgICAgICAgdm9pZCB0aGlzLnJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICk7XG5cbiAgICB0aGlzLnRpY2tIYW5kbGUgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gICAgfSwgMjUwKTtcblxuICAgIHZvaWQgdGhpcy5yZWZyZXNoRnJvbUFjdGl2ZUZpbGUoKTtcbiAgfVxuXG4gIGFzeW5jIG9uQ2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKHRoaXMudGlja0hhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy50aWNrSGFuZGxlKTtcbiAgICAgIHRoaXMudGlja0hhbmRsZSA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuY29udGVudEVsLnJlbW92ZUNsYXNzKFwianctdGltZXItc2lkZWJhci1yb290XCIpO1xuICAgIHRoaXMudGltZXJVaVJlZnMuY2xlYXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVmcmVzaEZyb21BY3RpdmVGaWxlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGFjdGl2ZUZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXG4gICAgaWYgKCFhY3RpdmVGaWxlKSB7XG4gICAgICB0aGlzLmN1cnJlbnRGaWxlUGF0aCA9IG51bGw7XG4gICAgICB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzID0gW107XG4gICAgICBhd2FpdCB0aGlzLnJlbmRlckxpc3QoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmN1cnJlbnRGaWxlUGF0aCA9IGFjdGl2ZUZpbGUucGF0aDtcbiAgICBjb25zdCBmaWxlQ29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoYWN0aXZlRmlsZSk7XG4gICAgY29uc3QgZmlsZUNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoYWN0aXZlRmlsZSk7XG4gICAgY29uc3QgaGVhZGluZ3MgPSAoZmlsZUNhY2hlPy5oZWFkaW5ncyA/PyBbXSkuc2xpY2UoKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICBjb25zdCBsaW5lQSA9IGEucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gMDtcbiAgICAgIGNvbnN0IGxpbmVCID0gYi5wb3NpdGlvbj8uc3RhcnQubGluZSA/PyAwO1xuICAgICAgcmV0dXJuIGxpbmVBIC0gbGluZUI7XG4gICAgfSk7XG4gICAgY29uc3QgcmF3SGVhZGluZ1RpdGxlcyA9IHRoaXMuZXh0cmFjdFJhd0hlYWRpbmdUaXRsZXMoZmlsZUNvbnRlbnQsIGhlYWRpbmdzKTtcblxuICAgIGNvbnN0IG5leHRIZWFkaW5nSWRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGFsbEhlYWRpbmdJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAgIGZvciAoY29uc3QgaGVhZGluZyBvZiBoZWFkaW5ncykge1xuICAgICAgY29uc3QgaWQgPSBidWlsZFRpbWVySWQoYWN0aXZlRmlsZS5wYXRoLCBoZWFkaW5nKTtcbiAgICAgIGFsbEhlYWRpbmdJZHMuYWRkKGlkKTtcbiAgICAgIGlmICh0aGlzLmRlbGV0ZWRUaW1lcklkcy5oYXMoaWQpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBoZWFkaW5nTGluZSA9IGhlYWRpbmcucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gMDtcbiAgICAgIGNvbnN0IGhlYWRpbmdUaXRsZSA9IHJhd0hlYWRpbmdUaXRsZXMuZ2V0KGhlYWRpbmdMaW5lKSA/PyBoZWFkaW5nLmhlYWRpbmc7XG4gICAgICBjb25zdCBleGlzdGluZyA9IHRoaXMudGltZXJzLmdldChpZCk7XG5cbiAgICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgICAgdGhpcy50aW1lcnMuc2V0KGlkLCB7XG4gICAgICAgICAgaWQsXG4gICAgICAgICAgdGl0bGU6IGhlYWRpbmdUaXRsZSxcbiAgICAgICAgICBlbGFwc2VkTXM6IDAsXG4gICAgICAgICAgcnVubmluZzogZmFsc2UsXG4gICAgICAgICAgc3RhcnRlZEF0OiBudWxsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZXhpc3RpbmcudGl0bGUgPSBoZWFkaW5nVGl0bGU7XG4gICAgICB9XG5cbiAgICAgIG5leHRIZWFkaW5nSWRzLnB1c2goaWQpO1xuICAgIH1cblxuICAgIGNvbnN0IG5leHRJZHNTZXQgPSBuZXcgU2V0KG5leHRIZWFkaW5nSWRzKTtcbiAgICBmb3IgKGNvbnN0IGV4aXN0aW5nSWQgb2YgWy4uLnRoaXMudGltZXJzLmtleXMoKV0pIHtcbiAgICAgIGlmIChleGlzdGluZ0lkLnN0YXJ0c1dpdGgoYCR7YWN0aXZlRmlsZS5wYXRofTo6YCkgJiYgIW5leHRJZHNTZXQuaGFzKGV4aXN0aW5nSWQpKSB7XG4gICAgICAgIHRoaXMudGltZXJzLmRlbGV0ZShleGlzdGluZ0lkKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGRlbGV0ZWRJZCBvZiBbLi4udGhpcy5kZWxldGVkVGltZXJJZHNdKSB7XG4gICAgICBpZiAoZGVsZXRlZElkLnN0YXJ0c1dpdGgoYCR7YWN0aXZlRmlsZS5wYXRofTo6YCkgJiYgIWFsbEhlYWRpbmdJZHMuaGFzKGRlbGV0ZWRJZCkpIHtcbiAgICAgICAgdGhpcy5kZWxldGVkVGltZXJJZHMuZGVsZXRlKGRlbGV0ZWRJZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5jdXJyZW50SGVhZGluZ0lkcyA9IG5leHRIZWFkaW5nSWRzO1xuICAgIGF3YWl0IHRoaXMucmVuZGVyTGlzdCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBleHRyYWN0UmF3SGVhZGluZ1RpdGxlcyhjb250ZW50OiBzdHJpbmcsIGhlYWRpbmdzOiBIZWFkaW5nQ2FjaGVbXSk6IE1hcDxudW1iZXIsIHN0cmluZz4ge1xuICAgIGNvbnN0IGxpbmVzID0gY29udGVudC5zcGxpdCgvXFxyP1xcbi8pO1xuICAgIGNvbnN0IHRpdGxlc0J5TGluZSA9IG5ldyBNYXA8bnVtYmVyLCBzdHJpbmc+KCk7XG5cbiAgICBmb3IgKGNvbnN0IGhlYWRpbmcgb2YgaGVhZGluZ3MpIHtcbiAgICAgIGNvbnN0IGxpbmVJbmRleCA9IGhlYWRpbmcucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gLTE7XG4gICAgICBpZiAobGluZUluZGV4IDwgMCB8fCBsaW5lSW5kZXggPj0gbGluZXMubGVuZ3RoKSBjb250aW51ZTtcblxuICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2xpbmVJbmRleF07XG4gICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL15cXHN7MCwzfSN7MSw2fVxccysoLiopJC8pO1xuICAgICAgaWYgKCFtYXRjaCkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IHJhdyA9IG1hdGNoWzFdLnJlcGxhY2UoL1xccysjK1xccyokLywgXCJcIikudHJpbSgpO1xuICAgICAgdGl0bGVzQnlMaW5lLnNldChsaW5lSW5kZXgsIHJhdy5sZW5ndGggPiAwID8gcmF3IDogaGVhZGluZy5oZWFkaW5nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGl0bGVzQnlMaW5lO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZW5kZXJMaXN0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMubGlzdEVsLmVtcHR5KCk7XG4gICAgdGhpcy50aW1lclVpUmVmcy5jbGVhcigpO1xuXG4gICAgaWYgKHRoaXMuY3VycmVudEhlYWRpbmdJZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLmVtcHR5U3RhdGVFbC5zZXRUZXh0KFVJX1RFWFQuZW1wdHkpO1xuICAgICAgdGhpcy5lbXB0eVN0YXRlRWwuc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJObyBoZWFkZXJzIGZvdW5kIGluIHRoZSBjdXJyZW50IG5vdGVcIik7XG4gICAgICB0aGlzLmVtcHR5U3RhdGVFbC5zaG93KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5lbXB0eVN0YXRlRWwuaGlkZSgpO1xuXG4gICAgZm9yIChjb25zdCBpZCBvZiB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzKSB7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgICBpZiAoIWVudHJ5KSBjb250aW51ZTtcblxuICAgICAgY29uc3QgY2FyZCA9IHRoaXMubGlzdEVsLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jYXJkXCIgfSk7XG4gICAgICBjb25zdCB0aXRsZUVsID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2FyZC10aXRsZVwiIH0pO1xuICAgICAgY29uc3QgdGl0bGVEYXRhID0gYXdhaXQgdGhpcy5nZXRSZW5kZXJlZFRpdGxlKGVudHJ5LnRpdGxlKTtcbiAgICAgIGlmICh0aXRsZURhdGEudHJpbW1lZCkge1xuICAgICAgICB0aXRsZUVsLnNldFRleHQodGl0bGVEYXRhLmNvbnRlbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIodGhpcy5hcHAsIHRpdGxlRGF0YS5jb250ZW50LCB0aXRsZUVsLCB0aGlzLmN1cnJlbnRGaWxlUGF0aCA/PyBcIlwiLCB0aGlzKTtcbiAgICAgICAgdGhpcy5yZXN0b3JlSW5saW5lSHRtbEF0dHJpYnV0ZXModGl0bGVFbCwgZW50cnkudGl0bGUpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB0aW1lckVsID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2xvY2tcIiwgdGV4dDogZm9ybWF0RHVyYXRpb24odGhpcy5nZXRFbGFwc2VkKGVudHJ5KSkgfSk7XG5cbiAgICAgIGNvbnN0IGNvbnRyb2xzID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY29udHJvbHNcIiB9KTtcblxuICAgICAgY29uc3QgcGxheVN0b3BCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJqdy10aW1lci1idG5cIixcbiAgICAgICAgdGV4dDogZW50cnkucnVubmluZyA/IFVJX1RFWFQucGF1c2UgOiBVSV9URVhULm9wZW5cbiAgICAgIH0pO1xuICAgICAgcGxheVN0b3BCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgZW50cnkucnVubmluZyA/IFwiUGF1c2UgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG4gICAgICBwbGF5U3RvcEJ0bi5zZXRBdHRyKFwidGl0bGVcIiwgZW50cnkucnVubmluZyA/IFwiUGF1c2UgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG5cbiAgICAgIGNvbnN0IHJlc2V0QnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwianctdGltZXItYnRuXCIsXG4gICAgICAgIHRleHQ6IFVJX1RFWFQucmVzZXRcbiAgICAgIH0pO1xuICAgICAgcmVzZXRCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJSZXNldCB0aW1lclwiKTtcbiAgICAgIHJlc2V0QnRuLnNldEF0dHIoXCJ0aXRsZVwiLCBcIlJlc2V0IHRpbWVyXCIpO1xuXG4gICAgICBjb25zdCBkZWxldGVCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJqdy10aW1lci1idG4ganctdGltZXItYnRuLWRhbmdlclwiLFxuICAgICAgICB0ZXh0OiBVSV9URVhULmRlbGV0ZVxuICAgICAgfSk7XG4gICAgICBkZWxldGVCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJEZWxldGUgdGltZXJcIik7XG4gICAgICBkZWxldGVCdG4uc2V0QXR0cihcInRpdGxlXCIsIFwiRGVsZXRlIHRpbWVyXCIpO1xuXG4gICAgICBwbGF5U3RvcEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICBpZiAoZW50cnkucnVubmluZykge1xuICAgICAgICAgIHRoaXMucGF1c2VUaW1lcihlbnRyeS5pZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5zdGFydFRpbWVyKGVudHJ5LmlkKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHJlc2V0QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIHRoaXMucmVzZXRUaW1lcihlbnRyeS5pZCk7XG4gICAgICB9KTtcblxuICAgICAgZGVsZXRlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIGlmICh0aGlzLmNvbmZpcm1BY3Rpb24oXCJEZWxldGUgdGhpcyB0aW1lcj9cIikpIHtcbiAgICAgICAgICB0aGlzLmRlbGV0ZVRpbWVyKGVudHJ5LmlkKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudGltZXJVaVJlZnMuc2V0KGVudHJ5LmlkLCB7IGNhcmRFbDogY2FyZCwgdGltZXJFbCwgcGxheVN0b3BCdG4sIHJlc2V0QnRuIH0pO1xuICAgIH1cblxuICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRFbGFwc2VkKGVudHJ5OiBUaW1lckVudHJ5KTogbnVtYmVyIHtcbiAgICBpZiAoIWVudHJ5LnJ1bm5pbmcgfHwgZW50cnkuc3RhcnRlZEF0ID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gZW50cnkuZWxhcHNlZE1zO1xuICAgIH1cblxuICAgIHJldHVybiBlbnRyeS5lbGFwc2VkTXMgKyAoRGF0ZS5ub3coKSAtIGVudHJ5LnN0YXJ0ZWRBdCk7XG4gIH1cblxuICBwcml2YXRlIHN0YXJ0VGltZXIoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICBpZiAoIWVudHJ5IHx8IGVudHJ5LnJ1bm5pbmcpIHJldHVybjtcblxuICAgIGVudHJ5LnJ1bm5pbmcgPSB0cnVlO1xuICAgIGVudHJ5LnN0YXJ0ZWRBdCA9IERhdGUubm93KCk7XG4gICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gIH1cblxuICBwcml2YXRlIHBhdXNlVGltZXIoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICBpZiAoIWVudHJ5IHx8ICFlbnRyeS5ydW5uaW5nKSByZXR1cm47XG5cbiAgICBlbnRyeS5lbGFwc2VkTXMgPSB0aGlzLmdldEVsYXBzZWQoZW50cnkpO1xuICAgIGVudHJ5LnJ1bm5pbmcgPSBmYWxzZTtcbiAgICBlbnRyeS5zdGFydGVkQXQgPSBudWxsO1xuICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICB9XG5cbiAgcHJpdmF0ZSByZXNldFRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgaWYgKCFlbnRyeSkgcmV0dXJuO1xuXG4gICAgZW50cnkuZWxhcHNlZE1zID0gMDtcbiAgICBlbnRyeS5ydW5uaW5nID0gZmFsc2U7XG4gICAgZW50cnkuc3RhcnRlZEF0ID0gbnVsbDtcbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgZGVsZXRlVGltZXIoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuZGVsZXRlZFRpbWVySWRzLmFkZChpZCk7XG4gICAgdGhpcy50aW1lcnMuZGVsZXRlKGlkKTtcbiAgICB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzID0gdGhpcy5jdXJyZW50SGVhZGluZ0lkcy5maWx0ZXIoKGhlYWRpbmdJZCkgPT4gaGVhZGluZ0lkICE9PSBpZCk7XG4gICAgdm9pZCB0aGlzLnJlbmRlckxpc3QoKTtcbiAgfVxuXG4gIHByaXZhdGUgZGVsZXRlQWxsVGltZXJzKCk6IHZvaWQge1xuICAgIHRoaXMudGltZXJzLmNsZWFyKCk7XG4gICAgdGhpcy5kZWxldGVkVGltZXJJZHMuY2xlYXIoKTtcbiAgICB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCk7XG4gIH1cblxuICBwcml2YXRlIGNvbmZpcm1BY3Rpb24obWVzc2FnZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHdpbmRvdy5jb25maXJtKG1lc3NhZ2UpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVUaW1lckRpc3BsYXlzKCk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgaWQgb2YgdGhpcy5jdXJyZW50SGVhZGluZ0lkcykge1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgICAgY29uc3QgdWkgPSB0aGlzLnRpbWVyVWlSZWZzLmdldChpZCk7XG4gICAgICBpZiAoIWVudHJ5IHx8ICF1aSkgY29udGludWU7XG5cbiAgICAgIHVpLnRpbWVyRWwuc2V0VGV4dChmb3JtYXREdXJhdGlvbih0aGlzLmdldEVsYXBzZWQoZW50cnkpKSk7XG4gICAgICB1aS5wbGF5U3RvcEJ0bi5zZXRUZXh0KGVudHJ5LnJ1bm5pbmcgPyBVSV9URVhULnBhdXNlIDogVUlfVEVYVC5vcGVuKTtcbiAgICAgIHVpLnBsYXlTdG9wQnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIGVudHJ5LnJ1bm5pbmcgPyBcIlBhdXNlIHRpbWVyXCIgOiBcIlN0YXJ0IHRpbWVyXCIpO1xuICAgICAgdWkucGxheVN0b3BCdG4uc2V0QXR0cihcInRpdGxlXCIsIGVudHJ5LnJ1bm5pbmcgPyBcIlBhdXNlIHRpbWVyXCIgOiBcIlN0YXJ0IHRpbWVyXCIpO1xuXG4gICAgICBjb25zdCBlbGFwc2VkID0gdGhpcy5nZXRFbGFwc2VkKGVudHJ5KTtcbiAgICAgIHVpLmNhcmRFbC5yZW1vdmVDbGFzcyhcImp3LXRpbWVyLWNhcmQtLXJ1bm5pbmdcIiwgXCJqdy10aW1lci1jYXJkLS1zdG9wcGVkXCIpO1xuICAgICAgaWYgKGVudHJ5LnJ1bm5pbmcpIHtcbiAgICAgICAgdWkuY2FyZEVsLmFkZENsYXNzKFwianctdGltZXItY2FyZC0tcnVubmluZ1wiKTtcbiAgICAgIH0gZWxzZSBpZiAoZWxhcHNlZCA+IDApIHtcbiAgICAgICAgdWkuY2FyZEVsLmFkZENsYXNzKFwianctdGltZXItY2FyZC0tc3RvcHBlZFwiKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGdldFJlbmRlcmVkVGl0bGUocmF3VGl0bGU6IHN0cmluZyk6IFByb21pc2U8eyBjb250ZW50OiBzdHJpbmc7IHRyaW1tZWQ6IGJvb2xlYW4gfT4ge1xuICAgIGNvbnN0IHRlbXBFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgYXdhaXQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIodGhpcy5hcHAsIHJhd1RpdGxlLCB0ZW1wRWwsIHRoaXMuY3VycmVudEZpbGVQYXRoID8/IFwiXCIsIHRoaXMpO1xuXG4gICAgY29uc3QgcGxhaW4gPSAodGVtcEVsLnRleHRDb250ZW50ID8/IFwiXCIpLnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnRyaW0oKTtcbiAgICBpZiAocGxhaW4ubGVuZ3RoIDw9IFRpbWVyU2lkZWJhclZpZXcuVElUTEVfTUFYX0xFTkdUSCkge1xuICAgICAgcmV0dXJuIHsgY29udGVudDogcmF3VGl0bGUsIHRyaW1tZWQ6IGZhbHNlIH07XG4gICAgfVxuXG4gICAgY29uc3Qgc2hvcnRlbmVkID0gYCR7cGxhaW4uc2xpY2UoMCwgVGltZXJTaWRlYmFyVmlldy5USVRMRV9NQVhfTEVOR1RIIC0gMykudHJpbUVuZCgpfS4uLmA7XG4gICAgcmV0dXJuIHsgY29udGVudDogc2hvcnRlbmVkLCB0cmltbWVkOiB0cnVlIH07XG4gIH1cblxuICBwcml2YXRlIHJlc3RvcmVJbmxpbmVIdG1sQXR0cmlidXRlcyhjb250YWluZXJFbDogSFRNTEVsZW1lbnQsIHJhd1RpdGxlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBwYXJzZWRSb290ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBwYXJzZWRSb290LmlubmVySFRNTCA9IHJhd1RpdGxlO1xuXG4gICAgY29uc3Qgc291cmNlRWxlbWVudHMgPSBBcnJheS5mcm9tKHBhcnNlZFJvb3QucXVlcnlTZWxlY3RvckFsbChcIipcIikpLmZpbHRlcigoZWxlbWVudCkgPT4ge1xuICAgICAgY29uc3QgYXR0cmlidXRlTmFtZXMgPSBlbGVtZW50LmdldEF0dHJpYnV0ZU5hbWVzKCk7XG4gICAgICByZXR1cm4gYXR0cmlidXRlTmFtZXMubGVuZ3RoID4gMDtcbiAgICB9KTtcbiAgICB0aGlzLmFwcGx5TWF0Y2hpbmdBdHRyaWJ1dGVzKHNvdXJjZUVsZW1lbnRzLCBjb250YWluZXJFbCk7XG4gIH1cblxuICBwcml2YXRlIGFwcGx5TWF0Y2hpbmdBdHRyaWJ1dGVzKHNvdXJjZUVsZW1lbnRzOiBFbGVtZW50W10sIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGNvbnN0IHVzZWRUYXJnZXRzID0gbmV3IFNldDxFbGVtZW50PigpO1xuXG4gICAgZm9yIChjb25zdCBzb3VyY2VFbCBvZiBzb3VyY2VFbGVtZW50cykge1xuICAgICAgY29uc3Qgc291cmNlVGV4dCA9IHNvdXJjZUVsLnRleHRDb250ZW50Py5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gICAgICBpZiAoIXNvdXJjZVRleHQpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBjYW5kaWRhdGVUYXJnZXRzID0gQXJyYXkuZnJvbShjb250YWluZXJFbC5xdWVyeVNlbGVjdG9yQWxsKHNvdXJjZUVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKSkpO1xuICAgICAgY29uc3QgdGFyZ2V0RWwgPSBjYW5kaWRhdGVUYXJnZXRzLmZpbmQoKGNhbmRpZGF0ZSkgPT4ge1xuICAgICAgICBpZiAodXNlZFRhcmdldHMuaGFzKGNhbmRpZGF0ZSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjYW5kaWRhdGVUZXh0ID0gY2FuZGlkYXRlLnRleHRDb250ZW50Py5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gICAgICAgIHJldHVybiBjYW5kaWRhdGVUZXh0ID09PSBzb3VyY2VUZXh0O1xuICAgICAgfSk7XG5cbiAgICAgIGlmICghdGFyZ2V0RWwpIGNvbnRpbnVlO1xuXG4gICAgICB1c2VkVGFyZ2V0cy5hZGQodGFyZ2V0RWwpO1xuICAgICAgZm9yIChjb25zdCBhdHRyIG9mIHNvdXJjZUVsLmdldEF0dHJpYnV0ZU5hbWVzKCkpIHtcbiAgICAgICAgdGFyZ2V0RWwuc2V0QXR0cmlidXRlKGF0dHIsIHNvdXJjZUVsLmdldEF0dHJpYnV0ZShhdHRyKSA/PyBcIlwiKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGltZXJTaWRlYmFyUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgYXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFZJRVdfVFlQRV9USU1FUl9TSURFQkFSLCAobGVhZikgPT4gbmV3IFRpbWVyU2lkZWJhclZpZXcobGVhZiwgdGhpcykpO1xuXG4gICAgdGhpcy5hZGRSaWJib25JY29uKFwidGltZXJcIiwgXCJPcGVuIEpXIFRpbWVyIHNpZGViYXJcIiwgKCkgPT4ge1xuICAgICAgdm9pZCB0aGlzLmFjdGl2YXRlVmlldygpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm9wZW4tanctdGltZXItc2lkZWJhclwiLFxuICAgICAgbmFtZTogXCJPcGVuIEpXIFRpbWVyIHNpZGViYXJcIixcbiAgICAgIGNhbGxiYWNrOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMuYWN0aXZhdGVWaWV3KCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB7XG4gICAgICB2b2lkIHRoaXMuYWN0aXZhdGVWaWV3KCk7XG4gICAgfSk7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9USU1FUl9TSURFQkFSKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgYWN0aXZhdGVWaWV3KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGV4aXN0aW5nTGVhdmVzID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfVElNRVJfU0lERUJBUik7XG4gICAgaWYgKGV4aXN0aW5nTGVhdmVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGV4aXN0aW5nTGVhdmVzWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldFJpZ2h0TGVhZihmYWxzZSk7XG4gICAgaWYgKCFsZWFmKSByZXR1cm47XG5cbiAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7XG4gICAgICB0eXBlOiBWSUVXX1RZUEVfVElNRVJfU0lERUJBUixcbiAgICAgIGFjdGl2ZTogdHJ1ZVxuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQU9PO0FBRVAsSUFBTSwwQkFBMEI7QUFDaEMsSUFBTSxVQUFVO0FBQUEsRUFDZCxPQUFPO0FBQUEsRUFDUCxPQUFPO0FBQUEsRUFDUCxNQUFNO0FBQUEsRUFDTixPQUFPO0FBQUEsRUFDUCxPQUFPO0FBQUEsRUFDUCxRQUFRO0FBQUEsRUFDUixVQUFVO0FBQ1o7QUFpQkEsU0FBUyxhQUFhLFVBQWtCLFNBQStCO0FBQ3JFLFFBQU0sT0FBTyxRQUFRLFVBQVUsTUFBTSxRQUFRO0FBQzdDLFNBQU8sR0FBRyxRQUFRLEtBQUssSUFBSSxLQUFLLFFBQVEsT0FBTztBQUNqRDtBQUVBLFNBQVMsZUFBZSxJQUFvQjtBQUMxQyxRQUFNLGVBQWUsS0FBSyxJQUFJLEdBQUcsS0FBSyxNQUFNLEtBQUssR0FBSSxDQUFDO0FBQ3RELFFBQU0sUUFBUSxLQUFLLE1BQU0sZUFBZSxJQUFJO0FBQzVDLFFBQU0sVUFBVSxLQUFLLE1BQU8sZUFBZSxPQUFR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
