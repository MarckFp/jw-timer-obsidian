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
    this.containerEl.empty();
    this.containerEl.addClass("jw-timer-sidebar-root");
    const wrapper = this.containerEl.createDiv({ cls: "jw-timer-wrapper" });
    const titleEl = wrapper.createEl("h2", { text: "Timers by heading", cls: "jw-timer-title" });
    titleEl.setAttr("aria-live", "polite");
    this.listEl = wrapper.createDiv({ cls: "jw-timer-list" });
    this.emptyStateEl = wrapper.createDiv({ cls: "jw-timer-empty" });
    const footerEl = wrapper.createDiv({ cls: "jw-timer-footer" });
    const deleteAllBtn = footerEl.createEl("button", {
      text: "Delete all timers",
      cls: "jw-timer-btn jw-timer-btn-danger"
    });
    deleteAllBtn.addEventListener("click", () => {
      this.deleteAllTimers();
    });
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refreshFromActiveFile()));
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (file.path === this.currentFilePath) {
          this.refreshFromActiveFile();
        }
      })
    );
    this.tickHandle = window.setInterval(() => {
      this.updateTimerDisplays();
    }, 250);
    this.refreshFromActiveFile();
  }
  async onClose() {
    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    this.timerUiRefs.clear();
  }
  refreshFromActiveFile() {
    const markdownView = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
    const activeFile = markdownView?.file;
    if (!activeFile) {
      this.currentFilePath = null;
      this.currentHeadingIds = [];
      this.renderList();
      return;
    }
    this.currentFilePath = activeFile.path;
    const fileCache = this.app.metadataCache.getFileCache(activeFile);
    const headings = (fileCache?.headings ?? []).slice().sort((a, b) => {
      const lineA = a.position?.start.line ?? 0;
      const lineB = b.position?.start.line ?? 0;
      return lineA - lineB;
    });
    const nextHeadingIds = [];
    for (const heading of headings) {
      const id = buildTimerId(activeFile.path, heading);
      const headingPrefix = "#".repeat(Math.max(1, heading.level));
      const headingTitle = `${headingPrefix} ${heading.heading}`;
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
    for (const existingId of this.timers.keys()) {
      if (existingId.startsWith(`${activeFile.path}::`) && !nextIdsSet.has(existingId)) {
        this.timers.delete(existingId);
      }
    }
    this.currentHeadingIds = nextHeadingIds;
    this.renderList();
  }
  renderList() {
    this.listEl.empty();
    this.timerUiRefs.clear();
    if (this.currentHeadingIds.length === 0) {
      this.emptyStateEl.setText("No headers found in the current note.");
      this.emptyStateEl.show();
      return;
    }
    this.emptyStateEl.hide();
    for (const id of this.currentHeadingIds) {
      const entry = this.timers.get(id);
      if (!entry) continue;
      const card = this.listEl.createDiv({ cls: "jw-timer-card" });
      card.createDiv({ cls: "jw-timer-card-title", text: entry.title });
      const timerEl = card.createDiv({ cls: "jw-timer-clock", text: formatDuration(this.getElapsed(entry)) });
      const controls = card.createDiv({ cls: "jw-timer-controls" });
      const playStopBtn = controls.createEl("button", {
        cls: "jw-timer-btn",
        text: entry.running ? "Stop" : "Play"
      });
      const pauseBtn = controls.createEl("button", {
        cls: "jw-timer-btn",
        text: "Pause"
      });
      const deleteBtn = controls.createEl("button", {
        cls: "jw-timer-btn jw-timer-btn-danger",
        text: "Delete"
      });
      pauseBtn.disabled = !entry.running;
      playStopBtn.addEventListener("click", () => {
        if (entry.running) {
          this.stopTimer(entry.id);
        } else {
          this.startTimer(entry.id);
        }
      });
      pauseBtn.addEventListener("click", () => {
        this.pauseTimer(entry.id);
      });
      deleteBtn.addEventListener("click", () => {
        this.deleteTimer(entry.id);
      });
      this.timerUiRefs.set(entry.id, { timerEl, playStopBtn, pauseBtn });
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
  stopTimer(id) {
    const entry = this.timers.get(id);
    if (!entry) return;
    entry.elapsedMs = 0;
    entry.running = false;
    entry.startedAt = null;
    this.updateTimerDisplays();
  }
  deleteTimer(id) {
    this.timers.delete(id);
    this.currentHeadingIds = this.currentHeadingIds.filter((headingId) => headingId !== id);
    this.renderList();
  }
  deleteAllTimers() {
    this.timers.clear();
    this.refreshFromActiveFile();
  }
  updateTimerDisplays() {
    for (const id of this.currentHeadingIds) {
      const entry = this.timers.get(id);
      const ui = this.timerUiRefs.get(id);
      if (!entry || !ui) continue;
      ui.timerEl.setText(formatDuration(this.getElapsed(entry)));
      ui.playStopBtn.setText(entry.running ? "Stop" : "Play");
      ui.pauseBtn.disabled = !entry.running;
    }
  }
};
var TimerSidebarPlugin = class extends import_obsidian.Plugin {
  async onload() {
    this.registerView(VIEW_TYPE_TIMER_SIDEBAR, (leaf) => new TimerSidebarView(leaf, this));
    this.addCommand({
      id: "open-jw-timer-sidebar",
      name: "Open JW Timer sidebar",
      callback: async () => {
        await this.activateView();
      }
    });
    await this.activateView();
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcbiAgQXBwLFxuICBJdGVtVmlldyxcbiAgTWFya2Rvd25WaWV3LFxuICBQbHVnaW4sXG4gIFRGaWxlLFxuICBXb3Jrc3BhY2VMZWFmLFxuICBIZWFkaW5nQ2FjaGVcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmNvbnN0IFZJRVdfVFlQRV9USU1FUl9TSURFQkFSID0gXCJqdy10aW1lci1zaWRlYmFyLXZpZXdcIjtcblxuaW50ZXJmYWNlIFRpbWVyRW50cnkge1xuICBpZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBlbGFwc2VkTXM6IG51bWJlcjtcbiAgcnVubmluZzogYm9vbGVhbjtcbiAgc3RhcnRlZEF0OiBudW1iZXIgfCBudWxsO1xufVxuXG5pbnRlcmZhY2UgVGltZXJVaVJlZiB7XG4gIHRpbWVyRWw6IEhUTUxFbGVtZW50O1xuICBwbGF5U3RvcEJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHBhdXNlQnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbn1cblxuZnVuY3Rpb24gYnVpbGRUaW1lcklkKGZpbGVQYXRoOiBzdHJpbmcsIGhlYWRpbmc6IEhlYWRpbmdDYWNoZSk6IHN0cmluZyB7XG4gIGNvbnN0IGxpbmUgPSBoZWFkaW5nLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IDA7XG4gIHJldHVybiBgJHtmaWxlUGF0aH06OiR7bGluZX06OiR7aGVhZGluZy5oZWFkaW5nfWA7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdER1cmF0aW9uKG1zOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCB0b3RhbFNlY29uZHMgPSBNYXRoLm1heCgwLCBNYXRoLmZsb29yKG1zIC8gMTAwMCkpO1xuICBjb25zdCBob3VycyA9IE1hdGguZmxvb3IodG90YWxTZWNvbmRzIC8gMzYwMCk7XG4gIGNvbnN0IG1pbnV0ZXMgPSBNYXRoLmZsb29yKCh0b3RhbFNlY29uZHMgJSAzNjAwKSAvIDYwKTtcbiAgY29uc3Qgc2Vjb25kcyA9IHRvdGFsU2Vjb25kcyAlIDYwO1xuXG4gIHJldHVybiBgJHtTdHJpbmcoaG91cnMpLnBhZFN0YXJ0KDIsIFwiMFwiKX06JHtTdHJpbmcobWludXRlcykucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhzZWNvbmRzKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbn1cblxuY2xhc3MgVGltZXJTaWRlYmFyVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgcHJpdmF0ZSB0aW1lcnMgPSBuZXcgTWFwPHN0cmluZywgVGltZXJFbnRyeT4oKTtcbiAgcHJpdmF0ZSB0aW1lclVpUmVmcyA9IG5ldyBNYXA8c3RyaW5nLCBUaW1lclVpUmVmPigpO1xuICBwcml2YXRlIGN1cnJlbnRIZWFkaW5nSWRzOiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIGN1cnJlbnRGaWxlUGF0aDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbiAgcHJpdmF0ZSBsaXN0RWwhOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBlbXB0eVN0YXRlRWwhOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSB0aWNrSGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmLCBwcml2YXRlIHJlYWRvbmx5IHBsdWdpbjogVGltZXJTaWRlYmFyUGx1Z2luKSB7XG4gICAgc3VwZXIobGVhZik7XG4gIH1cblxuICBnZXRWaWV3VHlwZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiBWSUVXX1RZUEVfVElNRVJfU0lERUJBUjtcbiAgfVxuXG4gIGdldERpc3BsYXlUZXh0KCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIFwiSlcgVGltZXJzXCI7XG4gIH1cblxuICBnZXRJY29uKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIFwidGltZXJcIjtcbiAgfVxuXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmNvbnRhaW5lckVsLmVtcHR5KCk7XG4gICAgdGhpcy5jb250YWluZXJFbC5hZGRDbGFzcyhcImp3LXRpbWVyLXNpZGViYXItcm9vdFwiKTtcblxuICAgIGNvbnN0IHdyYXBwZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci13cmFwcGVyXCIgfSk7XG5cbiAgICBjb25zdCB0aXRsZUVsID0gd3JhcHBlci5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJUaW1lcnMgYnkgaGVhZGluZ1wiLCBjbHM6IFwianctdGltZXItdGl0bGVcIiB9KTtcbiAgICB0aXRsZUVsLnNldEF0dHIoXCJhcmlhLWxpdmVcIiwgXCJwb2xpdGVcIik7XG5cbiAgICB0aGlzLmxpc3RFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWxpc3RcIiB9KTtcbiAgICB0aGlzLmVtcHR5U3RhdGVFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWVtcHR5XCIgfSk7XG5cbiAgICBjb25zdCBmb290ZXJFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWZvb3RlclwiIH0pO1xuICAgIGNvbnN0IGRlbGV0ZUFsbEJ0biA9IGZvb3RlckVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgIHRleHQ6IFwiRGVsZXRlIGFsbCB0aW1lcnNcIixcbiAgICAgIGNsczogXCJqdy10aW1lci1idG4ganctdGltZXItYnRuLWRhbmdlclwiXG4gICAgfSk7XG5cbiAgICBkZWxldGVBbGxCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIHRoaXMuZGVsZXRlQWxsVGltZXJzKCk7XG4gICAgfSk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAud29ya3NwYWNlLm9uKFwiYWN0aXZlLWxlYWYtY2hhbmdlXCIsICgpID0+IHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCkpKTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUub24oXCJjaGFuZ2VkXCIsIChmaWxlKSA9PiB7XG4gICAgICAgIGlmIChmaWxlLnBhdGggPT09IHRoaXMuY3VycmVudEZpbGVQYXRoKSB7XG4gICAgICAgICAgdGhpcy5yZWZyZXNoRnJvbUFjdGl2ZUZpbGUoKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICApO1xuXG4gICAgdGhpcy50aWNrSGFuZGxlID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICAgIH0sIDI1MCk7XG5cbiAgICB0aGlzLnJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpO1xuICB9XG5cbiAgYXN5bmMgb25DbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy50aWNrSGFuZGxlICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLnRpY2tIYW5kbGUpO1xuICAgICAgdGhpcy50aWNrSGFuZGxlID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy50aW1lclVpUmVmcy5jbGVhcigpO1xuICB9XG5cbiAgcHJpdmF0ZSByZWZyZXNoRnJvbUFjdGl2ZUZpbGUoKTogdm9pZCB7XG4gICAgY29uc3QgbWFya2Rvd25WaWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcbiAgICBjb25zdCBhY3RpdmVGaWxlID0gbWFya2Rvd25WaWV3Py5maWxlO1xuXG4gICAgaWYgKCFhY3RpdmVGaWxlKSB7XG4gICAgICB0aGlzLmN1cnJlbnRGaWxlUGF0aCA9IG51bGw7XG4gICAgICB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzID0gW107XG4gICAgICB0aGlzLnJlbmRlckxpc3QoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmN1cnJlbnRGaWxlUGF0aCA9IGFjdGl2ZUZpbGUucGF0aDtcbiAgICBjb25zdCBmaWxlQ2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShhY3RpdmVGaWxlKTtcbiAgICBjb25zdCBoZWFkaW5ncyA9IChmaWxlQ2FjaGU/LmhlYWRpbmdzID8/IFtdKS5zbGljZSgpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGNvbnN0IGxpbmVBID0gYS5wb3NpdGlvbj8uc3RhcnQubGluZSA/PyAwO1xuICAgICAgY29uc3QgbGluZUIgPSBiLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IDA7XG4gICAgICByZXR1cm4gbGluZUEgLSBsaW5lQjtcbiAgICB9KTtcblxuICAgIGNvbnN0IG5leHRIZWFkaW5nSWRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBoZWFkaW5nIG9mIGhlYWRpbmdzKSB7XG4gICAgICBjb25zdCBpZCA9IGJ1aWxkVGltZXJJZChhY3RpdmVGaWxlLnBhdGgsIGhlYWRpbmcpO1xuICAgICAgY29uc3QgaGVhZGluZ1ByZWZpeCA9IFwiI1wiLnJlcGVhdChNYXRoLm1heCgxLCBoZWFkaW5nLmxldmVsKSk7XG4gICAgICBjb25zdCBoZWFkaW5nVGl0bGUgPSBgJHtoZWFkaW5nUHJlZml4fSAke2hlYWRpbmcuaGVhZGluZ31gO1xuICAgICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuXG4gICAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICAgIHRoaXMudGltZXJzLnNldChpZCwge1xuICAgICAgICAgIGlkLFxuICAgICAgICAgIHRpdGxlOiBoZWFkaW5nVGl0bGUsXG4gICAgICAgICAgZWxhcHNlZE1zOiAwLFxuICAgICAgICAgIHJ1bm5pbmc6IGZhbHNlLFxuICAgICAgICAgIHN0YXJ0ZWRBdDogbnVsbFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGV4aXN0aW5nLnRpdGxlID0gaGVhZGluZ1RpdGxlO1xuICAgICAgfVxuXG4gICAgICBuZXh0SGVhZGluZ0lkcy5wdXNoKGlkKTtcbiAgICB9XG5cbiAgICBjb25zdCBuZXh0SWRzU2V0ID0gbmV3IFNldChuZXh0SGVhZGluZ0lkcyk7XG4gICAgZm9yIChjb25zdCBleGlzdGluZ0lkIG9mIHRoaXMudGltZXJzLmtleXMoKSkge1xuICAgICAgaWYgKGV4aXN0aW5nSWQuc3RhcnRzV2l0aChgJHthY3RpdmVGaWxlLnBhdGh9OjpgKSAmJiAhbmV4dElkc1NldC5oYXMoZXhpc3RpbmdJZCkpIHtcbiAgICAgICAgdGhpcy50aW1lcnMuZGVsZXRlKGV4aXN0aW5nSWQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuY3VycmVudEhlYWRpbmdJZHMgPSBuZXh0SGVhZGluZ0lkcztcbiAgICB0aGlzLnJlbmRlckxpc3QoKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyTGlzdCgpOiB2b2lkIHtcbiAgICB0aGlzLmxpc3RFbC5lbXB0eSgpO1xuICAgIHRoaXMudGltZXJVaVJlZnMuY2xlYXIoKTtcblxuICAgIGlmICh0aGlzLmN1cnJlbnRIZWFkaW5nSWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5lbXB0eVN0YXRlRWwuc2V0VGV4dChcIk5vIGhlYWRlcnMgZm91bmQgaW4gdGhlIGN1cnJlbnQgbm90ZS5cIik7XG4gICAgICB0aGlzLmVtcHR5U3RhdGVFbC5zaG93KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5lbXB0eVN0YXRlRWwuaGlkZSgpO1xuXG4gICAgZm9yIChjb25zdCBpZCBvZiB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzKSB7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgICBpZiAoIWVudHJ5KSBjb250aW51ZTtcblxuICAgICAgY29uc3QgY2FyZCA9IHRoaXMubGlzdEVsLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jYXJkXCIgfSk7XG4gICAgICBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jYXJkLXRpdGxlXCIsIHRleHQ6IGVudHJ5LnRpdGxlIH0pO1xuXG4gICAgICBjb25zdCB0aW1lckVsID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2xvY2tcIiwgdGV4dDogZm9ybWF0RHVyYXRpb24odGhpcy5nZXRFbGFwc2VkKGVudHJ5KSkgfSk7XG5cbiAgICAgIGNvbnN0IGNvbnRyb2xzID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY29udHJvbHNcIiB9KTtcblxuICAgICAgY29uc3QgcGxheVN0b3BCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJqdy10aW1lci1idG5cIixcbiAgICAgICAgdGV4dDogZW50cnkucnVubmluZyA/IFwiU3RvcFwiIDogXCJQbGF5XCJcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBwYXVzZUJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgICAgY2xzOiBcImp3LXRpbWVyLWJ0blwiLFxuICAgICAgICB0ZXh0OiBcIlBhdXNlXCJcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBkZWxldGVCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJqdy10aW1lci1idG4ganctdGltZXItYnRuLWRhbmdlclwiLFxuICAgICAgICB0ZXh0OiBcIkRlbGV0ZVwiXG4gICAgICB9KTtcblxuICAgICAgcGF1c2VCdG4uZGlzYWJsZWQgPSAhZW50cnkucnVubmluZztcblxuICAgICAgcGxheVN0b3BCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgaWYgKGVudHJ5LnJ1bm5pbmcpIHtcbiAgICAgICAgICB0aGlzLnN0b3BUaW1lcihlbnRyeS5pZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5zdGFydFRpbWVyKGVudHJ5LmlkKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHBhdXNlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIHRoaXMucGF1c2VUaW1lcihlbnRyeS5pZCk7XG4gICAgICB9KTtcblxuICAgICAgZGVsZXRlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuZGVsZXRlVGltZXIoZW50cnkuaWQpO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudGltZXJVaVJlZnMuc2V0KGVudHJ5LmlkLCB7IHRpbWVyRWwsIHBsYXlTdG9wQnRuLCBwYXVzZUJ0biB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0RWxhcHNlZChlbnRyeTogVGltZXJFbnRyeSk6IG51bWJlciB7XG4gICAgaWYgKCFlbnRyeS5ydW5uaW5nIHx8IGVudHJ5LnN0YXJ0ZWRBdCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGVudHJ5LmVsYXBzZWRNcztcbiAgICB9XG5cbiAgICByZXR1cm4gZW50cnkuZWxhcHNlZE1zICsgKERhdGUubm93KCkgLSBlbnRyeS5zdGFydGVkQXQpO1xuICB9XG5cbiAgcHJpdmF0ZSBzdGFydFRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgaWYgKCFlbnRyeSB8fCBlbnRyeS5ydW5uaW5nKSByZXR1cm47XG5cbiAgICBlbnRyeS5ydW5uaW5nID0gdHJ1ZTtcbiAgICBlbnRyeS5zdGFydGVkQXQgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICB9XG5cbiAgcHJpdmF0ZSBwYXVzZVRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgaWYgKCFlbnRyeSB8fCAhZW50cnkucnVubmluZykgcmV0dXJuO1xuXG4gICAgZW50cnkuZWxhcHNlZE1zID0gdGhpcy5nZXRFbGFwc2VkKGVudHJ5KTtcbiAgICBlbnRyeS5ydW5uaW5nID0gZmFsc2U7XG4gICAgZW50cnkuc3RhcnRlZEF0ID0gbnVsbDtcbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RvcFRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgaWYgKCFlbnRyeSkgcmV0dXJuO1xuXG4gICAgZW50cnkuZWxhcHNlZE1zID0gMDtcbiAgICBlbnRyeS5ydW5uaW5nID0gZmFsc2U7XG4gICAgZW50cnkuc3RhcnRlZEF0ID0gbnVsbDtcbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgZGVsZXRlVGltZXIoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMudGltZXJzLmRlbGV0ZShpZCk7XG4gICAgdGhpcy5jdXJyZW50SGVhZGluZ0lkcyA9IHRoaXMuY3VycmVudEhlYWRpbmdJZHMuZmlsdGVyKChoZWFkaW5nSWQpID0+IGhlYWRpbmdJZCAhPT0gaWQpO1xuICAgIHRoaXMucmVuZGVyTGlzdCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBkZWxldGVBbGxUaW1lcnMoKTogdm9pZCB7XG4gICAgdGhpcy50aW1lcnMuY2xlYXIoKTtcbiAgICB0aGlzLnJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVUaW1lckRpc3BsYXlzKCk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgaWQgb2YgdGhpcy5jdXJyZW50SGVhZGluZ0lkcykge1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgICAgY29uc3QgdWkgPSB0aGlzLnRpbWVyVWlSZWZzLmdldChpZCk7XG4gICAgICBpZiAoIWVudHJ5IHx8ICF1aSkgY29udGludWU7XG5cbiAgICAgIHVpLnRpbWVyRWwuc2V0VGV4dChmb3JtYXREdXJhdGlvbih0aGlzLmdldEVsYXBzZWQoZW50cnkpKSk7XG4gICAgICB1aS5wbGF5U3RvcEJ0bi5zZXRUZXh0KGVudHJ5LnJ1bm5pbmcgPyBcIlN0b3BcIiA6IFwiUGxheVwiKTtcbiAgICAgIHVpLnBhdXNlQnRuLmRpc2FibGVkID0gIWVudHJ5LnJ1bm5pbmc7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRpbWVyU2lkZWJhclBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEVfVElNRVJfU0lERUJBUiwgKGxlYWYpID0+IG5ldyBUaW1lclNpZGViYXJWaWV3KGxlYWYsIHRoaXMpKTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJvcGVuLWp3LXRpbWVyLXNpZGViYXJcIixcbiAgICAgIG5hbWU6IFwiT3BlbiBKVyBUaW1lciBzaWRlYmFyXCIsXG4gICAgICBjYWxsYmFjazogYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLmFjdGl2YXRlVmlldygpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcbiAgfVxuXG4gIG9udW5sb2FkKCk6IHZvaWQge1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoVklFV19UWVBFX1RJTUVSX1NJREVCQVIpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBhY3RpdmF0ZVZpZXcoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZXhpc3RpbmdMZWF2ZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9USU1FUl9TSURFQkFSKTtcbiAgICBpZiAoZXhpc3RpbmdMZWF2ZXMubGVuZ3RoID4gMCkge1xuICAgICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYoZXhpc3RpbmdMZWF2ZXNbMF0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKTtcbiAgICBpZiAoIWxlYWYpIHJldHVybjtcblxuICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHtcbiAgICAgIHR5cGU6IFZJRVdfVFlQRV9USU1FUl9TSURFQkFSLFxuICAgICAgYWN0aXZlOiB0cnVlXG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBUU87QUFFUCxJQUFNLDBCQUEwQjtBQWdCaEMsU0FBUyxhQUFhLFVBQWtCLFNBQStCO0FBQ3JFLFFBQU0sT0FBTyxRQUFRLFVBQVUsTUFBTSxRQUFRO0FBQzdDLFNBQU8sR0FBRyxRQUFRLEtBQUssSUFBSSxLQUFLLFFBQVEsT0FBTztBQUNqRDtBQUVBLFNBQVMsZUFBZSxJQUFvQjtBQUMxQyxRQUFNLGVBQWUsS0FBSyxJQUFJLEdBQUcsS0FBSyxNQUFNLEtBQUssR0FBSSxDQUFDO0FBQ3RELFFBQU0sUUFBUSxLQUFLLE1BQU0sZUFBZSxJQUFJO0FBQzVDLFFBQU0sVUFBVSxLQUFLLE1BQU8sZUFBZSxPQUFRLEVBQUU7QUFDckQsUUFBTSxVQUFVLGVBQWU7QUFFL0IsU0FBTyxHQUFHLE9BQU8sS0FBSyxFQUFFLFNBQVMsR0FBRyxHQUFHLENBQUMsSUFBSSxPQUFPLE9BQU8sRUFBRSxTQUFTLEdBQUcsR0FBRyxDQUFDLElBQUksT0FBTyxPQUFPLEVBQUUsU0FBUyxHQUFHLEdBQUcsQ0FBQztBQUNsSDtBQUVBLElBQU0sbUJBQU4sY0FBK0IseUJBQVM7QUFBQSxFQVV0QyxZQUFZLE1BQXNDLFFBQTRCO0FBQzVFLFVBQU0sSUFBSTtBQURzQztBQVRsRCxTQUFRLFNBQVMsb0JBQUksSUFBd0I7QUFDN0MsU0FBUSxjQUFjLG9CQUFJLElBQXdCO0FBQ2xELFNBQVEsb0JBQThCLENBQUM7QUFDdkMsU0FBUSxrQkFBaUM7QUFJekMsU0FBUSxhQUE0QjtBQUFBLEVBSXBDO0FBQUEsRUFFQSxjQUFzQjtBQUNwQixXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsaUJBQXlCO0FBQ3ZCLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFQSxVQUFrQjtBQUNoQixXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsTUFBTSxTQUF3QjtBQUM1QixTQUFLLFlBQVksTUFBTTtBQUN2QixTQUFLLFlBQVksU0FBUyx1QkFBdUI7QUFFakQsVUFBTSxVQUFVLEtBQUssWUFBWSxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUV0RSxVQUFNLFVBQVUsUUFBUSxTQUFTLE1BQU0sRUFBRSxNQUFNLHFCQUFxQixLQUFLLGlCQUFpQixDQUFDO0FBQzNGLFlBQVEsUUFBUSxhQUFhLFFBQVE7QUFFckMsU0FBSyxTQUFTLFFBQVEsVUFBVSxFQUFFLEtBQUssZ0JBQWdCLENBQUM7QUFDeEQsU0FBSyxlQUFlLFFBQVEsVUFBVSxFQUFFLEtBQUssaUJBQWlCLENBQUM7QUFFL0QsVUFBTSxXQUFXLFFBQVEsVUFBVSxFQUFFLEtBQUssa0JBQWtCLENBQUM7QUFDN0QsVUFBTSxlQUFlLFNBQVMsU0FBUyxVQUFVO0FBQUEsTUFDL0MsTUFBTTtBQUFBLE1BQ04sS0FBSztBQUFBLElBQ1AsQ0FBQztBQUVELGlCQUFhLGlCQUFpQixTQUFTLE1BQU07QUFDM0MsV0FBSyxnQkFBZ0I7QUFBQSxJQUN2QixDQUFDO0FBRUQsU0FBSyxjQUFjLEtBQUssSUFBSSxVQUFVLEdBQUcsc0JBQXNCLE1BQU0sS0FBSyxzQkFBc0IsQ0FBQyxDQUFDO0FBRWxHLFNBQUs7QUFBQSxNQUNILEtBQUssSUFBSSxjQUFjLEdBQUcsV0FBVyxDQUFDLFNBQVM7QUFDN0MsWUFBSSxLQUFLLFNBQVMsS0FBSyxpQkFBaUI7QUFDdEMsZUFBSyxzQkFBc0I7QUFBQSxRQUM3QjtBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0g7QUFFQSxTQUFLLGFBQWEsT0FBTyxZQUFZLE1BQU07QUFDekMsV0FBSyxvQkFBb0I7QUFBQSxJQUMzQixHQUFHLEdBQUc7QUFFTixTQUFLLHNCQUFzQjtBQUFBLEVBQzdCO0FBQUEsRUFFQSxNQUFNLFVBQXlCO0FBQzdCLFFBQUksS0FBSyxlQUFlLE1BQU07QUFDNUIsYUFBTyxjQUFjLEtBQUssVUFBVTtBQUNwQyxXQUFLLGFBQWE7QUFBQSxJQUNwQjtBQUNBLFNBQUssWUFBWSxNQUFNO0FBQUEsRUFDekI7QUFBQSxFQUVRLHdCQUE4QjtBQUNwQyxVQUFNLGVBQWUsS0FBSyxJQUFJLFVBQVUsb0JBQW9CLDRCQUFZO0FBQ3hFLFVBQU0sYUFBYSxjQUFjO0FBRWpDLFFBQUksQ0FBQyxZQUFZO0FBQ2YsV0FBSyxrQkFBa0I7QUFDdkIsV0FBSyxvQkFBb0IsQ0FBQztBQUMxQixXQUFLLFdBQVc7QUFDaEI7QUFBQSxJQUNGO0FBRUEsU0FBSyxrQkFBa0IsV0FBVztBQUNsQyxVQUFNLFlBQVksS0FBSyxJQUFJLGNBQWMsYUFBYSxVQUFVO0FBQ2hFLFVBQU0sWUFBWSxXQUFXLFlBQVksQ0FBQyxHQUFHLE1BQU0sRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNO0FBQ2xFLFlBQU0sUUFBUSxFQUFFLFVBQVUsTUFBTSxRQUFRO0FBQ3hDLFlBQU0sUUFBUSxFQUFFLFVBQVUsTUFBTSxRQUFRO0FBQ3hDLGFBQU8sUUFBUTtBQUFBLElBQ2pCLENBQUM7QUFFRCxVQUFNLGlCQUEyQixDQUFDO0FBRWxDLGVBQVcsV0FBVyxVQUFVO0FBQzlCLFlBQU0sS0FBSyxhQUFhLFdBQVcsTUFBTSxPQUFPO0FBQ2hELFlBQU0sZ0JBQWdCLElBQUksT0FBTyxLQUFLLElBQUksR0FBRyxRQUFRLEtBQUssQ0FBQztBQUMzRCxZQUFNLGVBQWUsR0FBRyxhQUFhLElBQUksUUFBUSxPQUFPO0FBQ3hELFlBQU0sV0FBVyxLQUFLLE9BQU8sSUFBSSxFQUFFO0FBRW5DLFVBQUksQ0FBQyxVQUFVO0FBQ2IsYUFBSyxPQUFPLElBQUksSUFBSTtBQUFBLFVBQ2xCO0FBQUEsVUFDQSxPQUFPO0FBQUEsVUFDUCxXQUFXO0FBQUEsVUFDWCxTQUFTO0FBQUEsVUFDVCxXQUFXO0FBQUEsUUFDYixDQUFDO0FBQUEsTUFDSCxPQUFPO0FBQ0wsaUJBQVMsUUFBUTtBQUFBLE1BQ25CO0FBRUEscUJBQWUsS0FBSyxFQUFFO0FBQUEsSUFDeEI7QUFFQSxVQUFNLGFBQWEsSUFBSSxJQUFJLGNBQWM7QUFDekMsZUFBVyxjQUFjLEtBQUssT0FBTyxLQUFLLEdBQUc7QUFDM0MsVUFBSSxXQUFXLFdBQVcsR0FBRyxXQUFXLElBQUksSUFBSSxLQUFLLENBQUMsV0FBVyxJQUFJLFVBQVUsR0FBRztBQUNoRixhQUFLLE9BQU8sT0FBTyxVQUFVO0FBQUEsTUFDL0I7QUFBQSxJQUNGO0FBRUEsU0FBSyxvQkFBb0I7QUFDekIsU0FBSyxXQUFXO0FBQUEsRUFDbEI7QUFBQSxFQUVRLGFBQW1CO0FBQ3pCLFNBQUssT0FBTyxNQUFNO0FBQ2xCLFNBQUssWUFBWSxNQUFNO0FBRXZCLFFBQUksS0FBSyxrQkFBa0IsV0FBVyxHQUFHO0FBQ3ZDLFdBQUssYUFBYSxRQUFRLHVDQUF1QztBQUNqRSxXQUFLLGFBQWEsS0FBSztBQUN2QjtBQUFBLElBQ0Y7QUFFQSxTQUFLLGFBQWEsS0FBSztBQUV2QixlQUFXLE1BQU0sS0FBSyxtQkFBbUI7QUFDdkMsWUFBTSxRQUFRLEtBQUssT0FBTyxJQUFJLEVBQUU7QUFDaEMsVUFBSSxDQUFDLE1BQU87QUFFWixZQUFNLE9BQU8sS0FBSyxPQUFPLFVBQVUsRUFBRSxLQUFLLGdCQUFnQixDQUFDO0FBQzNELFdBQUssVUFBVSxFQUFFLEtBQUssdUJBQXVCLE1BQU0sTUFBTSxNQUFNLENBQUM7QUFFaEUsWUFBTSxVQUFVLEtBQUssVUFBVSxFQUFFLEtBQUssa0JBQWtCLE1BQU0sZUFBZSxLQUFLLFdBQVcsS0FBSyxDQUFDLEVBQUUsQ0FBQztBQUV0RyxZQUFNLFdBQVcsS0FBSyxVQUFVLEVBQUUsS0FBSyxvQkFBb0IsQ0FBQztBQUU1RCxZQUFNLGNBQWMsU0FBUyxTQUFTLFVBQVU7QUFBQSxRQUM5QyxLQUFLO0FBQUEsUUFDTCxNQUFNLE1BQU0sVUFBVSxTQUFTO0FBQUEsTUFDakMsQ0FBQztBQUVELFlBQU0sV0FBVyxTQUFTLFNBQVMsVUFBVTtBQUFBLFFBQzNDLEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxNQUNSLENBQUM7QUFFRCxZQUFNLFlBQVksU0FBUyxTQUFTLFVBQVU7QUFBQSxRQUM1QyxLQUFLO0FBQUEsUUFDTCxNQUFNO0FBQUEsTUFDUixDQUFDO0FBRUQsZUFBUyxXQUFXLENBQUMsTUFBTTtBQUUzQixrQkFBWSxpQkFBaUIsU0FBUyxNQUFNO0FBQzFDLFlBQUksTUFBTSxTQUFTO0FBQ2pCLGVBQUssVUFBVSxNQUFNLEVBQUU7QUFBQSxRQUN6QixPQUFPO0FBQ0wsZUFBSyxXQUFXLE1BQU0sRUFBRTtBQUFBLFFBQzFCO0FBQUEsTUFDRixDQUFDO0FBRUQsZUFBUyxpQkFBaUIsU0FBUyxNQUFNO0FBQ3ZDLGFBQUssV0FBVyxNQUFNLEVBQUU7QUFBQSxNQUMxQixDQUFDO0FBRUQsZ0JBQVUsaUJBQWlCLFNBQVMsTUFBTTtBQUN4QyxhQUFLLFlBQVksTUFBTSxFQUFFO0FBQUEsTUFDM0IsQ0FBQztBQUVELFdBQUssWUFBWSxJQUFJLE1BQU0sSUFBSSxFQUFFLFNBQVMsYUFBYSxTQUFTLENBQUM7QUFBQSxJQUNuRTtBQUVBLFNBQUssb0JBQW9CO0FBQUEsRUFDM0I7QUFBQSxFQUVRLFdBQVcsT0FBMkI7QUFDNUMsUUFBSSxDQUFDLE1BQU0sV0FBVyxNQUFNLGNBQWMsTUFBTTtBQUM5QyxhQUFPLE1BQU07QUFBQSxJQUNmO0FBRUEsV0FBTyxNQUFNLGFBQWEsS0FBSyxJQUFJLElBQUksTUFBTTtBQUFBLEVBQy9DO0FBQUEsRUFFUSxXQUFXLElBQWtCO0FBQ25DLFVBQU0sUUFBUSxLQUFLLE9BQU8sSUFBSSxFQUFFO0FBQ2hDLFFBQUksQ0FBQyxTQUFTLE1BQU0sUUFBUztBQUU3QixVQUFNLFVBQVU7QUFDaEIsVUFBTSxZQUFZLEtBQUssSUFBSTtBQUMzQixTQUFLLG9CQUFvQjtBQUFBLEVBQzNCO0FBQUEsRUFFUSxXQUFXLElBQWtCO0FBQ25DLFVBQU0sUUFBUSxLQUFLLE9BQU8sSUFBSSxFQUFFO0FBQ2hDLFFBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxRQUFTO0FBRTlCLFVBQU0sWUFBWSxLQUFLLFdBQVcsS0FBSztBQUN2QyxVQUFNLFVBQVU7QUFDaEIsVUFBTSxZQUFZO0FBQ2xCLFNBQUssb0JBQW9CO0FBQUEsRUFDM0I7QUFBQSxFQUVRLFVBQVUsSUFBa0I7QUFDbEMsVUFBTSxRQUFRLEtBQUssT0FBTyxJQUFJLEVBQUU7QUFDaEMsUUFBSSxDQUFDLE1BQU87QUFFWixVQUFNLFlBQVk7QUFDbEIsVUFBTSxVQUFVO0FBQ2hCLFVBQU0sWUFBWTtBQUNsQixTQUFLLG9CQUFvQjtBQUFBLEVBQzNCO0FBQUEsRUFFUSxZQUFZLElBQWtCO0FBQ3BDLFNBQUssT0FBTyxPQUFPLEVBQUU7QUFDckIsU0FBSyxvQkFBb0IsS0FBSyxrQkFBa0IsT0FBTyxDQUFDLGNBQWMsY0FBYyxFQUFFO0FBQ3RGLFNBQUssV0FBVztBQUFBLEVBQ2xCO0FBQUEsRUFFUSxrQkFBd0I7QUFDOUIsU0FBSyxPQUFPLE1BQU07QUFDbEIsU0FBSyxzQkFBc0I7QUFBQSxFQUM3QjtBQUFBLEVBRVEsc0JBQTRCO0FBQ2xDLGVBQVcsTUFBTSxLQUFLLG1CQUFtQjtBQUN2QyxZQUFNLFFBQVEsS0FBSyxPQUFPLElBQUksRUFBRTtBQUNoQyxZQUFNLEtBQUssS0FBSyxZQUFZLElBQUksRUFBRTtBQUNsQyxVQUFJLENBQUMsU0FBUyxDQUFDLEdBQUk7QUFFbkIsU0FBRyxRQUFRLFFBQVEsZUFBZSxLQUFLLFdBQVcsS0FBSyxDQUFDLENBQUM7QUFDekQsU0FBRyxZQUFZLFFBQVEsTUFBTSxVQUFVLFNBQVMsTUFBTTtBQUN0RCxTQUFHLFNBQVMsV0FBVyxDQUFDLE1BQU07QUFBQSxJQUNoQztBQUFBLEVBQ0Y7QUFDRjtBQUVBLElBQXFCLHFCQUFyQixjQUFnRCx1QkFBTztBQUFBLEVBQ3JELE1BQU0sU0FBd0I7QUFDNUIsU0FBSyxhQUFhLHlCQUF5QixDQUFDLFNBQVMsSUFBSSxpQkFBaUIsTUFBTSxJQUFJLENBQUM7QUFFckYsU0FBSyxXQUFXO0FBQUEsTUFDZCxJQUFJO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixVQUFVLFlBQVk7QUFDcEIsY0FBTSxLQUFLLGFBQWE7QUFBQSxNQUMxQjtBQUFBLElBQ0YsQ0FBQztBQUVELFVBQU0sS0FBSyxhQUFhO0FBQUEsRUFDMUI7QUFBQSxFQUVBLFdBQWlCO0FBQ2YsU0FBSyxJQUFJLFVBQVUsbUJBQW1CLHVCQUF1QjtBQUFBLEVBQy9EO0FBQUEsRUFFQSxNQUFjLGVBQThCO0FBQzFDLFVBQU0saUJBQWlCLEtBQUssSUFBSSxVQUFVLGdCQUFnQix1QkFBdUI7QUFDakYsUUFBSSxlQUFlLFNBQVMsR0FBRztBQUM3QixZQUFNLEtBQUssSUFBSSxVQUFVLFdBQVcsZUFBZSxDQUFDLENBQUM7QUFDckQ7QUFBQSxJQUNGO0FBRUEsVUFBTSxPQUFPLEtBQUssSUFBSSxVQUFVLGFBQWEsS0FBSztBQUNsRCxRQUFJLENBQUMsS0FBTTtBQUVYLFVBQU0sS0FBSyxhQUFhO0FBQUEsTUFDdEIsTUFBTTtBQUFBLE1BQ04sUUFBUTtBQUFBLElBQ1YsQ0FBQztBQUVELFVBQU0sS0FBSyxJQUFJLFVBQVUsV0FBVyxJQUFJO0FBQUEsRUFDMUM7QUFDRjsiLAogICJuYW1lcyI6IFtdCn0K
