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
      this.deleteAllTimers();
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
        this.deleteTimer(entry.id);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcbiAgQXBwLFxuICBJdGVtVmlldyxcbiAgTWFya2Rvd25SZW5kZXJlcixcbiAgUGx1Z2luLFxuICBXb3Jrc3BhY2VMZWFmLFxuICBIZWFkaW5nQ2FjaGVcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmNvbnN0IFZJRVdfVFlQRV9USU1FUl9TSURFQkFSID0gXCJqdy10aW1lci1zaWRlYmFyLXZpZXdcIjtcbmNvbnN0IFVJX1RFWFQgPSB7XG4gIHRpdGxlOiBcIlx1MjNGMVx1RkUwRlwiLFxuICBlbXB0eTogXCJcdTIyMDVcIixcbiAgb3BlbjogXCJcdTI1QjZcdUZFMEZcIixcbiAgcGF1c2U6IFwiXHUyM0Y4XHVGRTBGXCIsXG4gIHJlc2V0OiBcIlx1RDgzRFx1REQwNFwiLFxuICBkZWxldGU6IFwiXHVEODNEXHVEREQxXHVGRTBGXCIsXG4gIHJlc2V0QWxsOiBcIlx1MjY3Qlx1RkUwRlwiXG59IGFzIGNvbnN0O1xuXG5pbnRlcmZhY2UgVGltZXJFbnRyeSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGVsYXBzZWRNczogbnVtYmVyO1xuICBydW5uaW5nOiBib29sZWFuO1xuICBzdGFydGVkQXQ6IG51bWJlciB8IG51bGw7XG59XG5cbmludGVyZmFjZSBUaW1lclVpUmVmIHtcbiAgY2FyZEVsOiBIVE1MRWxlbWVudDtcbiAgdGltZXJFbDogSFRNTEVsZW1lbnQ7XG4gIHBsYXlTdG9wQnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgcmVzZXRCdG46IEhUTUxCdXR0b25FbGVtZW50O1xufVxuXG5mdW5jdGlvbiBidWlsZFRpbWVySWQoZmlsZVBhdGg6IHN0cmluZywgaGVhZGluZzogSGVhZGluZ0NhY2hlKTogc3RyaW5nIHtcbiAgY29uc3QgbGluZSA9IGhlYWRpbmcucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gMDtcbiAgcmV0dXJuIGAke2ZpbGVQYXRofTo6JHtsaW5lfTo6JHtoZWFkaW5nLmhlYWRpbmd9YDtcbn1cblxuZnVuY3Rpb24gZm9ybWF0RHVyYXRpb24obXM6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IHRvdGFsU2Vjb25kcyA9IE1hdGgubWF4KDAsIE1hdGguZmxvb3IobXMgLyAxMDAwKSk7XG4gIGNvbnN0IGhvdXJzID0gTWF0aC5mbG9vcih0b3RhbFNlY29uZHMgLyAzNjAwKTtcbiAgY29uc3QgbWludXRlcyA9IE1hdGguZmxvb3IoKHRvdGFsU2Vjb25kcyAlIDM2MDApIC8gNjApO1xuICBjb25zdCBzZWNvbmRzID0gdG90YWxTZWNvbmRzICUgNjA7XG5cbiAgcmV0dXJuIGAke1N0cmluZyhob3VycykucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhtaW51dGVzKS5wYWRTdGFydCgyLCBcIjBcIil9OiR7U3RyaW5nKHNlY29uZHMpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xufVxuXG5jbGFzcyBUaW1lclNpZGViYXJWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIHRpbWVycyA9IG5ldyBNYXA8c3RyaW5nLCBUaW1lckVudHJ5PigpO1xuICBwcml2YXRlIGRlbGV0ZWRUaW1lcklkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBwcml2YXRlIHRpbWVyVWlSZWZzID0gbmV3IE1hcDxzdHJpbmcsIFRpbWVyVWlSZWY+KCk7XG4gIHByaXZhdGUgY3VycmVudEhlYWRpbmdJZHM6IHN0cmluZ1tdID0gW107XG4gIHByaXZhdGUgY3VycmVudEZpbGVQYXRoOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICBwcml2YXRlIGxpc3RFbCE6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGVtcHR5U3RhdGVFbCE6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIHRpY2tIYW5kbGU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBUSVRMRV9NQVhfTEVOR1RIID0gNjA7XG5cbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZiwgcHJpdmF0ZSByZWFkb25seSBwbHVnaW46IFRpbWVyU2lkZWJhclBsdWdpbikge1xuICAgIHN1cGVyKGxlYWYpO1xuICB9XG5cbiAgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gVklFV19UWVBFX1RJTUVSX1NJREVCQVI7XG4gIH1cblxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcge1xuICAgIHJldHVybiBcIkpXIFRpbWVyc1wiO1xuICB9XG5cbiAgZ2V0SWNvbigpOiBzdHJpbmcge1xuICAgIHJldHVybiBcInRpbWVyXCI7XG4gIH1cblxuICBhc3luYyBvbk9wZW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5jb250ZW50RWwuZW1wdHkoKTtcbiAgICB0aGlzLmNvbnRlbnRFbC5hZGRDbGFzcyhcImp3LXRpbWVyLXNpZGViYXItcm9vdFwiKTtcblxuICAgIGNvbnN0IHdyYXBwZXIgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItd3JhcHBlclwiIH0pO1xuXG4gICAgY29uc3QgdGl0bGVFbCA9IHdyYXBwZXIuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFVJX1RFWFQudGl0bGUsIGNsczogXCJqdy10aW1lci10aXRsZVwiIH0pO1xuICAgIHRpdGxlRWwuc2V0QXR0cihcImFyaWEtbGl2ZVwiLCBcInBvbGl0ZVwiKTtcbiAgICB0aXRsZUVsLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiVGltZXJzIGJ5IGhlYWRpbmdcIik7XG5cbiAgICB0aGlzLmxpc3RFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWxpc3RcIiB9KTtcbiAgICB0aGlzLmVtcHR5U3RhdGVFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWVtcHR5XCIgfSk7XG5cbiAgICBjb25zdCBmb290ZXJFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWZvb3RlclwiIH0pO1xuICAgIGNvbnN0IGRlbGV0ZUFsbEJ0biA9IGZvb3RlckVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgIHRleHQ6IFVJX1RFWFQucmVzZXRBbGwsXG4gICAgICBjbHM6IFwianctdGltZXItYnRuIGp3LXRpbWVyLWJ0bi1kYW5nZXJcIlxuICAgIH0pO1xuICAgIGRlbGV0ZUFsbEJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIlJlc2V0IGFsbCB0aW1lcnNcIik7XG4gICAgZGVsZXRlQWxsQnRuLnNldEF0dHIoXCJ0aXRsZVwiLCBcIlJlc2V0IGFsbCB0aW1lcnNcIik7XG5cbiAgICBkZWxldGVBbGxCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIHRoaXMuZGVsZXRlQWxsVGltZXJzKCk7XG4gICAgfSk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAud29ya3NwYWNlLm9uKFwiYWN0aXZlLWxlYWYtY2hhbmdlXCIsICgpID0+IHZvaWQgdGhpcy5yZWZyZXNoRnJvbUFjdGl2ZUZpbGUoKSkpO1xuXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5vbihcImNoYW5nZWRcIiwgKGZpbGUpID0+IHtcbiAgICAgICAgaWYgKGZpbGUucGF0aCA9PT0gdGhpcy5jdXJyZW50RmlsZVBhdGgpIHtcbiAgICAgICAgICB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHRoaXMudGlja0hhbmRsZSA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgICB9LCAyNTApO1xuXG4gICAgdm9pZCB0aGlzLnJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpO1xuICB9XG5cbiAgYXN5bmMgb25DbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy50aWNrSGFuZGxlICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLnRpY2tIYW5kbGUpO1xuICAgICAgdGhpcy50aWNrSGFuZGxlID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5jb250ZW50RWwucmVtb3ZlQ2xhc3MoXCJqdy10aW1lci1zaWRlYmFyLXJvb3RcIik7XG4gICAgdGhpcy50aW1lclVpUmVmcy5jbGVhcigpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZWZyZXNoRnJvbUFjdGl2ZUZpbGUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cbiAgICBpZiAoIWFjdGl2ZUZpbGUpIHtcbiAgICAgIHRoaXMuY3VycmVudEZpbGVQYXRoID0gbnVsbDtcbiAgICAgIHRoaXMuY3VycmVudEhlYWRpbmdJZHMgPSBbXTtcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyTGlzdCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuY3VycmVudEZpbGVQYXRoID0gYWN0aXZlRmlsZS5wYXRoO1xuICAgIGNvbnN0IGZpbGVDb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChhY3RpdmVGaWxlKTtcbiAgICBjb25zdCBmaWxlQ2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShhY3RpdmVGaWxlKTtcbiAgICBjb25zdCBoZWFkaW5ncyA9IChmaWxlQ2FjaGU/LmhlYWRpbmdzID8/IFtdKS5zbGljZSgpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGNvbnN0IGxpbmVBID0gYS5wb3NpdGlvbj8uc3RhcnQubGluZSA/PyAwO1xuICAgICAgY29uc3QgbGluZUIgPSBiLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IDA7XG4gICAgICByZXR1cm4gbGluZUEgLSBsaW5lQjtcbiAgICB9KTtcbiAgICBjb25zdCByYXdIZWFkaW5nVGl0bGVzID0gdGhpcy5leHRyYWN0UmF3SGVhZGluZ1RpdGxlcyhmaWxlQ29udGVudCwgaGVhZGluZ3MpO1xuXG4gICAgY29uc3QgbmV4dEhlYWRpbmdJZHM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgYWxsSGVhZGluZ0lkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgZm9yIChjb25zdCBoZWFkaW5nIG9mIGhlYWRpbmdzKSB7XG4gICAgICBjb25zdCBpZCA9IGJ1aWxkVGltZXJJZChhY3RpdmVGaWxlLnBhdGgsIGhlYWRpbmcpO1xuICAgICAgYWxsSGVhZGluZ0lkcy5hZGQoaWQpO1xuICAgICAgaWYgKHRoaXMuZGVsZXRlZFRpbWVySWRzLmhhcyhpZCkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGhlYWRpbmdMaW5lID0gaGVhZGluZy5wb3NpdGlvbj8uc3RhcnQubGluZSA/PyAwO1xuICAgICAgY29uc3QgaGVhZGluZ1RpdGxlID0gcmF3SGVhZGluZ1RpdGxlcy5nZXQoaGVhZGluZ0xpbmUpID8/IGhlYWRpbmcuaGVhZGluZztcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcblxuICAgICAgaWYgKCFleGlzdGluZykge1xuICAgICAgICB0aGlzLnRpbWVycy5zZXQoaWQsIHtcbiAgICAgICAgICBpZCxcbiAgICAgICAgICB0aXRsZTogaGVhZGluZ1RpdGxlLFxuICAgICAgICAgIGVsYXBzZWRNczogMCxcbiAgICAgICAgICBydW5uaW5nOiBmYWxzZSxcbiAgICAgICAgICBzdGFydGVkQXQ6IG51bGxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBleGlzdGluZy50aXRsZSA9IGhlYWRpbmdUaXRsZTtcbiAgICAgIH1cblxuICAgICAgbmV4dEhlYWRpbmdJZHMucHVzaChpZCk7XG4gICAgfVxuXG4gICAgY29uc3QgbmV4dElkc1NldCA9IG5ldyBTZXQobmV4dEhlYWRpbmdJZHMpO1xuICAgIGZvciAoY29uc3QgZXhpc3RpbmdJZCBvZiBbLi4udGhpcy50aW1lcnMua2V5cygpXSkge1xuICAgICAgaWYgKGV4aXN0aW5nSWQuc3RhcnRzV2l0aChgJHthY3RpdmVGaWxlLnBhdGh9OjpgKSAmJiAhbmV4dElkc1NldC5oYXMoZXhpc3RpbmdJZCkpIHtcbiAgICAgICAgdGhpcy50aW1lcnMuZGVsZXRlKGV4aXN0aW5nSWQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3QgZGVsZXRlZElkIG9mIFsuLi50aGlzLmRlbGV0ZWRUaW1lcklkc10pIHtcbiAgICAgIGlmIChkZWxldGVkSWQuc3RhcnRzV2l0aChgJHthY3RpdmVGaWxlLnBhdGh9OjpgKSAmJiAhYWxsSGVhZGluZ0lkcy5oYXMoZGVsZXRlZElkKSkge1xuICAgICAgICB0aGlzLmRlbGV0ZWRUaW1lcklkcy5kZWxldGUoZGVsZXRlZElkKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzID0gbmV4dEhlYWRpbmdJZHM7XG4gICAgYXdhaXQgdGhpcy5yZW5kZXJMaXN0KCk7XG4gIH1cblxuICBwcml2YXRlIGV4dHJhY3RSYXdIZWFkaW5nVGl0bGVzKGNvbnRlbnQ6IHN0cmluZywgaGVhZGluZ3M6IEhlYWRpbmdDYWNoZVtdKTogTWFwPG51bWJlciwgc3RyaW5nPiB7XG4gICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KC9cXHI/XFxuLyk7XG4gICAgY29uc3QgdGl0bGVzQnlMaW5lID0gbmV3IE1hcDxudW1iZXIsIHN0cmluZz4oKTtcblxuICAgIGZvciAoY29uc3QgaGVhZGluZyBvZiBoZWFkaW5ncykge1xuICAgICAgY29uc3QgbGluZUluZGV4ID0gaGVhZGluZy5wb3NpdGlvbj8uc3RhcnQubGluZSA/PyAtMTtcbiAgICAgIGlmIChsaW5lSW5kZXggPCAwIHx8IGxpbmVJbmRleCA+PSBsaW5lcy5sZW5ndGgpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBsaW5lID0gbGluZXNbbGluZUluZGV4XTtcbiAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXlxcc3swLDN9I3sxLDZ9XFxzKyguKikkLyk7XG4gICAgICBpZiAoIW1hdGNoKSBjb250aW51ZTtcblxuICAgICAgY29uc3QgcmF3ID0gbWF0Y2hbMV0ucmVwbGFjZSgvXFxzKyMrXFxzKiQvLCBcIlwiKS50cmltKCk7XG4gICAgICB0aXRsZXNCeUxpbmUuc2V0KGxpbmVJbmRleCwgcmF3Lmxlbmd0aCA+IDAgPyByYXcgOiBoZWFkaW5nLmhlYWRpbmcpO1xuICAgIH1cblxuICAgIHJldHVybiB0aXRsZXNCeUxpbmU7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlckxpc3QoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5saXN0RWwuZW1wdHkoKTtcbiAgICB0aGlzLnRpbWVyVWlSZWZzLmNsZWFyKCk7XG5cbiAgICBpZiAodGhpcy5jdXJyZW50SGVhZGluZ0lkcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuZW1wdHlTdGF0ZUVsLnNldFRleHQoVUlfVEVYVC5lbXB0eSk7XG4gICAgICB0aGlzLmVtcHR5U3RhdGVFbC5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIk5vIGhlYWRlcnMgZm91bmQgaW4gdGhlIGN1cnJlbnQgbm90ZVwiKTtcbiAgICAgIHRoaXMuZW1wdHlTdGF0ZUVsLnNob3coKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmVtcHR5U3RhdGVFbC5oaWRlKCk7XG5cbiAgICBmb3IgKGNvbnN0IGlkIG9mIHRoaXMuY3VycmVudEhlYWRpbmdJZHMpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICAgIGlmICghZW50cnkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBjYXJkID0gdGhpcy5saXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNhcmRcIiB9KTtcbiAgICAgIGNvbnN0IHRpdGxlRWwgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jYXJkLXRpdGxlXCIgfSk7XG4gICAgICBjb25zdCB0aXRsZURhdGEgPSBhd2FpdCB0aGlzLmdldFJlbmRlcmVkVGl0bGUoZW50cnkudGl0bGUpO1xuICAgICAgaWYgKHRpdGxlRGF0YS50cmltbWVkKSB7XG4gICAgICAgIHRpdGxlRWwuc2V0VGV4dCh0aXRsZURhdGEuY29udGVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgdGl0bGVEYXRhLmNvbnRlbnQsIHRpdGxlRWwsIHRoaXMuY3VycmVudEZpbGVQYXRoID8/IFwiXCIsIHRoaXMpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB0aW1lckVsID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2xvY2tcIiwgdGV4dDogZm9ybWF0RHVyYXRpb24odGhpcy5nZXRFbGFwc2VkKGVudHJ5KSkgfSk7XG5cbiAgICAgIGNvbnN0IGNvbnRyb2xzID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY29udHJvbHNcIiB9KTtcblxuICAgICAgY29uc3QgcGxheVN0b3BCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJqdy10aW1lci1idG5cIixcbiAgICAgICAgdGV4dDogZW50cnkucnVubmluZyA/IFVJX1RFWFQucGF1c2UgOiBVSV9URVhULm9wZW5cbiAgICAgIH0pO1xuICAgICAgcGxheVN0b3BCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgZW50cnkucnVubmluZyA/IFwiUGF1c2UgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG4gICAgICBwbGF5U3RvcEJ0bi5zZXRBdHRyKFwidGl0bGVcIiwgZW50cnkucnVubmluZyA/IFwiUGF1c2UgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG5cbiAgICAgIGNvbnN0IHJlc2V0QnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwianctdGltZXItYnRuXCIsXG4gICAgICAgIHRleHQ6IFVJX1RFWFQucmVzZXRcbiAgICAgIH0pO1xuICAgICAgcmVzZXRCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJSZXNldCB0aW1lclwiKTtcbiAgICAgIHJlc2V0QnRuLnNldEF0dHIoXCJ0aXRsZVwiLCBcIlJlc2V0IHRpbWVyXCIpO1xuXG4gICAgICBjb25zdCBkZWxldGVCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJqdy10aW1lci1idG4ganctdGltZXItYnRuLWRhbmdlclwiLFxuICAgICAgICB0ZXh0OiBVSV9URVhULmRlbGV0ZVxuICAgICAgfSk7XG4gICAgICBkZWxldGVCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJEZWxldGUgdGltZXJcIik7XG4gICAgICBkZWxldGVCdG4uc2V0QXR0cihcInRpdGxlXCIsIFwiRGVsZXRlIHRpbWVyXCIpO1xuXG4gICAgICBwbGF5U3RvcEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICBpZiAoZW50cnkucnVubmluZykge1xuICAgICAgICAgIHRoaXMucGF1c2VUaW1lcihlbnRyeS5pZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5zdGFydFRpbWVyKGVudHJ5LmlkKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHJlc2V0QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIHRoaXMucmVzZXRUaW1lcihlbnRyeS5pZCk7XG4gICAgICB9KTtcblxuICAgICAgZGVsZXRlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuZGVsZXRlVGltZXIoZW50cnkuaWQpO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudGltZXJVaVJlZnMuc2V0KGVudHJ5LmlkLCB7IGNhcmRFbDogY2FyZCwgdGltZXJFbCwgcGxheVN0b3BCdG4sIHJlc2V0QnRuIH0pO1xuICAgIH1cblxuICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRFbGFwc2VkKGVudHJ5OiBUaW1lckVudHJ5KTogbnVtYmVyIHtcbiAgICBpZiAoIWVudHJ5LnJ1bm5pbmcgfHwgZW50cnkuc3RhcnRlZEF0ID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gZW50cnkuZWxhcHNlZE1zO1xuICAgIH1cblxuICAgIHJldHVybiBlbnRyeS5lbGFwc2VkTXMgKyAoRGF0ZS5ub3coKSAtIGVudHJ5LnN0YXJ0ZWRBdCk7XG4gIH1cblxuICBwcml2YXRlIHN0YXJ0VGltZXIoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICBpZiAoIWVudHJ5IHx8IGVudHJ5LnJ1bm5pbmcpIHJldHVybjtcblxuICAgIGVudHJ5LnJ1bm5pbmcgPSB0cnVlO1xuICAgIGVudHJ5LnN0YXJ0ZWRBdCA9IERhdGUubm93KCk7XG4gICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gIH1cblxuICBwcml2YXRlIHBhdXNlVGltZXIoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICBpZiAoIWVudHJ5IHx8ICFlbnRyeS5ydW5uaW5nKSByZXR1cm47XG5cbiAgICBlbnRyeS5lbGFwc2VkTXMgPSB0aGlzLmdldEVsYXBzZWQoZW50cnkpO1xuICAgIGVudHJ5LnJ1bm5pbmcgPSBmYWxzZTtcbiAgICBlbnRyeS5zdGFydGVkQXQgPSBudWxsO1xuICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICB9XG5cbiAgcHJpdmF0ZSByZXNldFRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgaWYgKCFlbnRyeSkgcmV0dXJuO1xuXG4gICAgZW50cnkuZWxhcHNlZE1zID0gMDtcbiAgICBlbnRyeS5ydW5uaW5nID0gZmFsc2U7XG4gICAgZW50cnkuc3RhcnRlZEF0ID0gbnVsbDtcbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgZGVsZXRlVGltZXIoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuZGVsZXRlZFRpbWVySWRzLmFkZChpZCk7XG4gICAgdGhpcy50aW1lcnMuZGVsZXRlKGlkKTtcbiAgICB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzID0gdGhpcy5jdXJyZW50SGVhZGluZ0lkcy5maWx0ZXIoKGhlYWRpbmdJZCkgPT4gaGVhZGluZ0lkICE9PSBpZCk7XG4gICAgdm9pZCB0aGlzLnJlbmRlckxpc3QoKTtcbiAgfVxuXG4gIHByaXZhdGUgZGVsZXRlQWxsVGltZXJzKCk6IHZvaWQge1xuICAgIHRoaXMudGltZXJzLmNsZWFyKCk7XG4gICAgdGhpcy5kZWxldGVkVGltZXJJZHMuY2xlYXIoKTtcbiAgICB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZVRpbWVyRGlzcGxheXMoKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBpZCBvZiB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzKSB7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgICBjb25zdCB1aSA9IHRoaXMudGltZXJVaVJlZnMuZ2V0KGlkKTtcbiAgICAgIGlmICghZW50cnkgfHwgIXVpKSBjb250aW51ZTtcblxuICAgICAgdWkudGltZXJFbC5zZXRUZXh0KGZvcm1hdER1cmF0aW9uKHRoaXMuZ2V0RWxhcHNlZChlbnRyeSkpKTtcbiAgICAgIHVpLnBsYXlTdG9wQnRuLnNldFRleHQoZW50cnkucnVubmluZyA/IFVJX1RFWFQucGF1c2UgOiBVSV9URVhULm9wZW4pO1xuICAgICAgdWkucGxheVN0b3BCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgZW50cnkucnVubmluZyA/IFwiUGF1c2UgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG4gICAgICB1aS5wbGF5U3RvcEJ0bi5zZXRBdHRyKFwidGl0bGVcIiwgZW50cnkucnVubmluZyA/IFwiUGF1c2UgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG5cbiAgICAgIGNvbnN0IGVsYXBzZWQgPSB0aGlzLmdldEVsYXBzZWQoZW50cnkpO1xuICAgICAgdWkuY2FyZEVsLnJlbW92ZUNsYXNzKFwianctdGltZXItY2FyZC0tcnVubmluZ1wiLCBcImp3LXRpbWVyLWNhcmQtLXN0b3BwZWRcIik7XG4gICAgICBpZiAoZW50cnkucnVubmluZykge1xuICAgICAgICB1aS5jYXJkRWwuYWRkQ2xhc3MoXCJqdy10aW1lci1jYXJkLS1ydW5uaW5nXCIpO1xuICAgICAgfSBlbHNlIGlmIChlbGFwc2VkID4gMCkge1xuICAgICAgICB1aS5jYXJkRWwuYWRkQ2xhc3MoXCJqdy10aW1lci1jYXJkLS1zdG9wcGVkXCIpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZ2V0UmVuZGVyZWRUaXRsZShyYXdUaXRsZTogc3RyaW5nKTogUHJvbWlzZTx7IGNvbnRlbnQ6IHN0cmluZzsgdHJpbW1lZDogYm9vbGVhbiB9PiB7XG4gICAgY29uc3QgdGVtcEVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgcmF3VGl0bGUsIHRlbXBFbCwgdGhpcy5jdXJyZW50RmlsZVBhdGggPz8gXCJcIiwgdGhpcyk7XG5cbiAgICBjb25zdCBwbGFpbiA9ICh0ZW1wRWwudGV4dENvbnRlbnQgPz8gXCJcIikucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xuICAgIGlmIChwbGFpbi5sZW5ndGggPD0gVGltZXJTaWRlYmFyVmlldy5USVRMRV9NQVhfTEVOR1RIKSB7XG4gICAgICByZXR1cm4geyBjb250ZW50OiByYXdUaXRsZSwgdHJpbW1lZDogZmFsc2UgfTtcbiAgICB9XG5cbiAgICBjb25zdCBzaG9ydGVuZWQgPSBgJHtwbGFpbi5zbGljZSgwLCBUaW1lclNpZGViYXJWaWV3LlRJVExFX01BWF9MRU5HVEggLSAzKS50cmltRW5kKCl9Li4uYDtcbiAgICByZXR1cm4geyBjb250ZW50OiBzaG9ydGVuZWQsIHRyaW1tZWQ6IHRydWUgfTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUaW1lclNpZGViYXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5yZWdpc3RlclZpZXcoVklFV19UWVBFX1RJTUVSX1NJREVCQVIsIChsZWFmKSA9PiBuZXcgVGltZXJTaWRlYmFyVmlldyhsZWFmLCB0aGlzKSk7XG5cbiAgICB0aGlzLmFkZFJpYmJvbkljb24oXCJ0aW1lclwiLCBcIk9wZW4gSlcgVGltZXIgc2lkZWJhclwiLCAoKSA9PiB7XG4gICAgICB2b2lkIHRoaXMuYWN0aXZhdGVWaWV3KCk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwib3Blbi1qdy10aW1lci1zaWRlYmFyXCIsXG4gICAgICBuYW1lOiBcIk9wZW4gSlcgVGltZXIgc2lkZWJhclwiLFxuICAgICAgY2FsbGJhY2s6IGFzeW5jICgpID0+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIHZvaWQgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcbiAgICB9KTtcbiAgfVxuXG4gIG9udW5sb2FkKCk6IHZvaWQge1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoVklFV19UWVBFX1RJTUVSX1NJREVCQVIpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBhY3RpdmF0ZVZpZXcoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZXhpc3RpbmdMZWF2ZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9USU1FUl9TSURFQkFSKTtcbiAgICBpZiAoZXhpc3RpbmdMZWF2ZXMubGVuZ3RoID4gMCkge1xuICAgICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYoZXhpc3RpbmdMZWF2ZXNbMF0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKTtcbiAgICBpZiAoIWxlYWYpIHJldHVybjtcblxuICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHtcbiAgICAgIHR5cGU6IFZJRVdfVFlQRV9USU1FUl9TSURFQkFSLFxuICAgICAgYWN0aXZlOiB0cnVlXG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBT087QUFFUCxJQUFNLDBCQUEwQjtBQUNoQyxJQUFNLFVBQVU7QUFBQSxFQUNkLE9BQU87QUFBQSxFQUNQLE9BQU87QUFBQSxFQUNQLE1BQU07QUFBQSxFQUNOLE9BQU87QUFBQSxFQUNQLE9BQU87QUFBQSxFQUNQLFFBQVE7QUFBQSxFQUNSLFVBQVU7QUFDWjtBQWlCQSxTQUFTLGFBQWEsVUFBa0IsU0FBK0I7QUFDckUsUUFBTSxPQUFPLFFBQVEsVUFBVSxNQUFNLFFBQVE7QUFDN0MsU0FBTyxHQUFHLFFBQVEsS0FBSyxJQUFJLEtBQUssUUFBUSxPQUFPO0FBQ2pEO0FBRUEsU0FBUyxlQUFlLElBQW9CO0FBQzFDLFFBQU0sZUFBZSxL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
