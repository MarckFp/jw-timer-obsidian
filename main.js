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
      text: "Reset timers",
      cls: "jw-timer-btn jw-timer-btn-danger"
    });
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
    for (const heading of headings) {
      const id = buildTimerId(activeFile.path, heading);
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
    for (const existingId of this.timers.keys()) {
      if (existingId.startsWith(`${activeFile.path}::`) && !nextIdsSet.has(existingId)) {
        this.timers.delete(existingId);
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
      this.emptyStateEl.setText("No headers found in the current note.");
      this.emptyStateEl.show();
      return;
    }
    this.emptyStateEl.hide();
    for (const id of this.currentHeadingIds) {
      const entry = this.timers.get(id);
      if (!entry) continue;
      const card = this.listEl.createDiv({ cls: "jw-timer-card" });
      const titleEl = card.createDiv({ cls: "jw-timer-card-title" });
      await import_obsidian.MarkdownRenderer.render(this.app, entry.title, titleEl, this.currentFilePath ?? "", this);
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
    void this.renderList();
  }
  deleteAllTimers() {
    this.timers.clear();
    void this.refreshFromActiveFile();
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcbiAgQXBwLFxuICBJdGVtVmlldyxcbiAgTWFya2Rvd25SZW5kZXJlcixcbiAgUGx1Z2luLFxuICBXb3Jrc3BhY2VMZWFmLFxuICBIZWFkaW5nQ2FjaGVcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmNvbnN0IFZJRVdfVFlQRV9USU1FUl9TSURFQkFSID0gXCJqdy10aW1lci1zaWRlYmFyLXZpZXdcIjtcblxuaW50ZXJmYWNlIFRpbWVyRW50cnkge1xuICBpZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBlbGFwc2VkTXM6IG51bWJlcjtcbiAgcnVubmluZzogYm9vbGVhbjtcbiAgc3RhcnRlZEF0OiBudW1iZXIgfCBudWxsO1xufVxuXG5pbnRlcmZhY2UgVGltZXJVaVJlZiB7XG4gIHRpbWVyRWw6IEhUTUxFbGVtZW50O1xuICBwbGF5U3RvcEJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHBhdXNlQnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbn1cblxuZnVuY3Rpb24gYnVpbGRUaW1lcklkKGZpbGVQYXRoOiBzdHJpbmcsIGhlYWRpbmc6IEhlYWRpbmdDYWNoZSk6IHN0cmluZyB7XG4gIGNvbnN0IGxpbmUgPSBoZWFkaW5nLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IDA7XG4gIHJldHVybiBgJHtmaWxlUGF0aH06OiR7bGluZX06OiR7aGVhZGluZy5oZWFkaW5nfWA7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdER1cmF0aW9uKG1zOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCB0b3RhbFNlY29uZHMgPSBNYXRoLm1heCgwLCBNYXRoLmZsb29yKG1zIC8gMTAwMCkpO1xuICBjb25zdCBob3VycyA9IE1hdGguZmxvb3IodG90YWxTZWNvbmRzIC8gMzYwMCk7XG4gIGNvbnN0IG1pbnV0ZXMgPSBNYXRoLmZsb29yKCh0b3RhbFNlY29uZHMgJSAzNjAwKSAvIDYwKTtcbiAgY29uc3Qgc2Vjb25kcyA9IHRvdGFsU2Vjb25kcyAlIDYwO1xuXG4gIHJldHVybiBgJHtTdHJpbmcoaG91cnMpLnBhZFN0YXJ0KDIsIFwiMFwiKX06JHtTdHJpbmcobWludXRlcykucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhzZWNvbmRzKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbn1cblxuY2xhc3MgVGltZXJTaWRlYmFyVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgcHJpdmF0ZSB0aW1lcnMgPSBuZXcgTWFwPHN0cmluZywgVGltZXJFbnRyeT4oKTtcbiAgcHJpdmF0ZSB0aW1lclVpUmVmcyA9IG5ldyBNYXA8c3RyaW5nLCBUaW1lclVpUmVmPigpO1xuICBwcml2YXRlIGN1cnJlbnRIZWFkaW5nSWRzOiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIGN1cnJlbnRGaWxlUGF0aDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbiAgcHJpdmF0ZSBsaXN0RWwhOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBlbXB0eVN0YXRlRWwhOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSB0aWNrSGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmLCBwcml2YXRlIHJlYWRvbmx5IHBsdWdpbjogVGltZXJTaWRlYmFyUGx1Z2luKSB7XG4gICAgc3VwZXIobGVhZik7XG4gIH1cblxuICBnZXRWaWV3VHlwZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiBWSUVXX1RZUEVfVElNRVJfU0lERUJBUjtcbiAgfVxuXG4gIGdldERpc3BsYXlUZXh0KCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIFwiSlcgVGltZXJzXCI7XG4gIH1cblxuICBnZXRJY29uKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIFwidGltZXJcIjtcbiAgfVxuXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmNvbnRhaW5lckVsLmVtcHR5KCk7XG4gICAgdGhpcy5jb250YWluZXJFbC5hZGRDbGFzcyhcImp3LXRpbWVyLXNpZGViYXItcm9vdFwiKTtcblxuICAgIGNvbnN0IHdyYXBwZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci13cmFwcGVyXCIgfSk7XG5cbiAgICBjb25zdCB0aXRsZUVsID0gd3JhcHBlci5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJUaW1lcnMgYnkgaGVhZGluZ1wiLCBjbHM6IFwianctdGltZXItdGl0bGVcIiB9KTtcbiAgICB0aXRsZUVsLnNldEF0dHIoXCJhcmlhLWxpdmVcIiwgXCJwb2xpdGVcIik7XG5cbiAgICB0aGlzLmxpc3RFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWxpc3RcIiB9KTtcbiAgICB0aGlzLmVtcHR5U3RhdGVFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWVtcHR5XCIgfSk7XG5cbiAgICBjb25zdCBmb290ZXJFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWZvb3RlclwiIH0pO1xuICAgIGNvbnN0IGRlbGV0ZUFsbEJ0biA9IGZvb3RlckVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgIHRleHQ6IFwiUmVzZXQgdGltZXJzXCIsXG4gICAgICBjbHM6IFwianctdGltZXItYnRuIGp3LXRpbWVyLWJ0bi1kYW5nZXJcIlxuICAgIH0pO1xuXG4gICAgZGVsZXRlQWxsQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICB0aGlzLmRlbGV0ZUFsbFRpbWVycygpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCAoKSA9PiB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCkpKTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUub24oXCJjaGFuZ2VkXCIsIChmaWxlKSA9PiB7XG4gICAgICAgIGlmIChmaWxlLnBhdGggPT09IHRoaXMuY3VycmVudEZpbGVQYXRoKSB7XG4gICAgICAgICAgdm9pZCB0aGlzLnJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICk7XG5cbiAgICB0aGlzLnRpY2tIYW5kbGUgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gICAgfSwgMjUwKTtcblxuICAgIHZvaWQgdGhpcy5yZWZyZXNoRnJvbUFjdGl2ZUZpbGUoKTtcbiAgfVxuXG4gIGFzeW5jIG9uQ2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKHRoaXMudGlja0hhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy50aWNrSGFuZGxlKTtcbiAgICAgIHRoaXMudGlja0hhbmRsZSA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMudGltZXJVaVJlZnMuY2xlYXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVmcmVzaEZyb21BY3RpdmVGaWxlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGFjdGl2ZUZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXG4gICAgaWYgKCFhY3RpdmVGaWxlKSB7XG4gICAgICB0aGlzLmN1cnJlbnRGaWxlUGF0aCA9IG51bGw7XG4gICAgICB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzID0gW107XG4gICAgICBhd2FpdCB0aGlzLnJlbmRlckxpc3QoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmN1cnJlbnRGaWxlUGF0aCA9IGFjdGl2ZUZpbGUucGF0aDtcbiAgICBjb25zdCBmaWxlQ29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoYWN0aXZlRmlsZSk7XG4gICAgY29uc3QgZmlsZUNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoYWN0aXZlRmlsZSk7XG4gICAgY29uc3QgaGVhZGluZ3MgPSAoZmlsZUNhY2hlPy5oZWFkaW5ncyA/PyBbXSkuc2xpY2UoKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICBjb25zdCBsaW5lQSA9IGEucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gMDtcbiAgICAgIGNvbnN0IGxpbmVCID0gYi5wb3NpdGlvbj8uc3RhcnQubGluZSA/PyAwO1xuICAgICAgcmV0dXJuIGxpbmVBIC0gbGluZUI7XG4gICAgfSk7XG4gICAgY29uc3QgcmF3SGVhZGluZ1RpdGxlcyA9IHRoaXMuZXh0cmFjdFJhd0hlYWRpbmdUaXRsZXMoZmlsZUNvbnRlbnQsIGhlYWRpbmdzKTtcblxuICAgIGNvbnN0IG5leHRIZWFkaW5nSWRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBoZWFkaW5nIG9mIGhlYWRpbmdzKSB7XG4gICAgICBjb25zdCBpZCA9IGJ1aWxkVGltZXJJZChhY3RpdmVGaWxlLnBhdGgsIGhlYWRpbmcpO1xuICAgICAgY29uc3QgaGVhZGluZ0xpbmUgPSBoZWFkaW5nLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IDA7XG4gICAgICBjb25zdCBoZWFkaW5nVGl0bGUgPSByYXdIZWFkaW5nVGl0bGVzLmdldChoZWFkaW5nTGluZSkgPz8gaGVhZGluZy5oZWFkaW5nO1xuICAgICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuXG4gICAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICAgIHRoaXMudGltZXJzLnNldChpZCwge1xuICAgICAgICAgIGlkLFxuICAgICAgICAgIHRpdGxlOiBoZWFkaW5nVGl0bGUsXG4gICAgICAgICAgZWxhcHNlZE1zOiAwLFxuICAgICAgICAgIHJ1bm5pbmc6IGZhbHNlLFxuICAgICAgICAgIHN0YXJ0ZWRBdDogbnVsbFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGV4aXN0aW5nLnRpdGxlID0gaGVhZGluZ1RpdGxlO1xuICAgICAgfVxuXG4gICAgICBuZXh0SGVhZGluZ0lkcy5wdXNoKGlkKTtcbiAgICB9XG5cbiAgICBjb25zdCBuZXh0SWRzU2V0ID0gbmV3IFNldChuZXh0SGVhZGluZ0lkcyk7XG4gICAgZm9yIChjb25zdCBleGlzdGluZ0lkIG9mIHRoaXMudGltZXJzLmtleXMoKSkge1xuICAgICAgaWYgKGV4aXN0aW5nSWQuc3RhcnRzV2l0aChgJHthY3RpdmVGaWxlLnBhdGh9OjpgKSAmJiAhbmV4dElkc1NldC5oYXMoZXhpc3RpbmdJZCkpIHtcbiAgICAgICAgdGhpcy50aW1lcnMuZGVsZXRlKGV4aXN0aW5nSWQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuY3VycmVudEhlYWRpbmdJZHMgPSBuZXh0SGVhZGluZ0lkcztcbiAgICBhd2FpdCB0aGlzLnJlbmRlckxpc3QoKTtcbiAgfVxuXG4gIHByaXZhdGUgZXh0cmFjdFJhd0hlYWRpbmdUaXRsZXMoY29udGVudDogc3RyaW5nLCBoZWFkaW5nczogSGVhZGluZ0NhY2hlW10pOiBNYXA8bnVtYmVyLCBzdHJpbmc+IHtcbiAgICBjb25zdCBsaW5lcyA9IGNvbnRlbnQuc3BsaXQoL1xccj9cXG4vKTtcbiAgICBjb25zdCB0aXRsZXNCeUxpbmUgPSBuZXcgTWFwPG51bWJlciwgc3RyaW5nPigpO1xuXG4gICAgZm9yIChjb25zdCBoZWFkaW5nIG9mIGhlYWRpbmdzKSB7XG4gICAgICBjb25zdCBsaW5lSW5kZXggPSBoZWFkaW5nLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IC0xO1xuICAgICAgaWYgKGxpbmVJbmRleCA8IDAgfHwgbGluZUluZGV4ID49IGxpbmVzLmxlbmd0aCkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tsaW5lSW5kZXhdO1xuICAgICAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzezAsM30jezEsNn1cXHMrKC4qKSQvKTtcbiAgICAgIGlmICghbWF0Y2gpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCByYXcgPSBtYXRjaFsxXS5yZXBsYWNlKC9cXHMrIytcXHMqJC8sIFwiXCIpLnRyaW0oKTtcbiAgICAgIHRpdGxlc0J5TGluZS5zZXQobGluZUluZGV4LCByYXcubGVuZ3RoID4gMCA/IHJhdyA6IGhlYWRpbmcuaGVhZGluZyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRpdGxlc0J5TGluZTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVuZGVyTGlzdCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmxpc3RFbC5lbXB0eSgpO1xuICAgIHRoaXMudGltZXJVaVJlZnMuY2xlYXIoKTtcblxuICAgIGlmICh0aGlzLmN1cnJlbnRIZWFkaW5nSWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5lbXB0eVN0YXRlRWwuc2V0VGV4dChcIk5vIGhlYWRlcnMgZm91bmQgaW4gdGhlIGN1cnJlbnQgbm90ZS5cIik7XG4gICAgICB0aGlzLmVtcHR5U3RhdGVFbC5zaG93KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5lbXB0eVN0YXRlRWwuaGlkZSgpO1xuXG4gICAgZm9yIChjb25zdCBpZCBvZiB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzKSB7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgICBpZiAoIWVudHJ5KSBjb250aW51ZTtcblxuICAgICAgY29uc3QgY2FyZCA9IHRoaXMubGlzdEVsLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jYXJkXCIgfSk7XG4gICAgICBjb25zdCB0aXRsZUVsID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2FyZC10aXRsZVwiIH0pO1xuICAgICAgYXdhaXQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIodGhpcy5hcHAsIGVudHJ5LnRpdGxlLCB0aXRsZUVsLCB0aGlzLmN1cnJlbnRGaWxlUGF0aCA/PyBcIlwiLCB0aGlzKTtcblxuICAgICAgY29uc3QgdGltZXJFbCA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNsb2NrXCIsIHRleHQ6IGZvcm1hdER1cmF0aW9uKHRoaXMuZ2V0RWxhcHNlZChlbnRyeSkpIH0pO1xuXG4gICAgICBjb25zdCBjb250cm9scyA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNvbnRyb2xzXCIgfSk7XG5cbiAgICAgIGNvbnN0IHBsYXlTdG9wQnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwianctdGltZXItYnRuXCIsXG4gICAgICAgIHRleHQ6IGVudHJ5LnJ1bm5pbmcgPyBcIlN0b3BcIiA6IFwiUGxheVwiXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgcGF1c2VCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJqdy10aW1lci1idG5cIixcbiAgICAgICAgdGV4dDogXCJQYXVzZVwiXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgZGVsZXRlQnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwianctdGltZXItYnRuIGp3LXRpbWVyLWJ0bi1kYW5nZXJcIixcbiAgICAgICAgdGV4dDogXCJEZWxldGVcIlxuICAgICAgfSk7XG5cbiAgICAgIHBhdXNlQnRuLmRpc2FibGVkID0gIWVudHJ5LnJ1bm5pbmc7XG5cbiAgICAgIHBsYXlTdG9wQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIGlmIChlbnRyeS5ydW5uaW5nKSB7XG4gICAgICAgICAgdGhpcy5zdG9wVGltZXIoZW50cnkuaWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuc3RhcnRUaW1lcihlbnRyeS5pZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBwYXVzZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICB0aGlzLnBhdXNlVGltZXIoZW50cnkuaWQpO1xuICAgICAgfSk7XG5cbiAgICAgIGRlbGV0ZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICB0aGlzLmRlbGV0ZVRpbWVyKGVudHJ5LmlkKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnRpbWVyVWlSZWZzLnNldChlbnRyeS5pZCwgeyB0aW1lckVsLCBwbGF5U3RvcEJ0biwgcGF1c2VCdG4gfSk7XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gIH1cblxuICBwcml2YXRlIGdldEVsYXBzZWQoZW50cnk6IFRpbWVyRW50cnkpOiBudW1iZXIge1xuICAgIGlmICghZW50cnkucnVubmluZyB8fCBlbnRyeS5zdGFydGVkQXQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBlbnRyeS5lbGFwc2VkTXM7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVudHJ5LmVsYXBzZWRNcyArIChEYXRlLm5vdygpIC0gZW50cnkuc3RhcnRlZEF0KTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhcnRUaW1lcihpZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgIGlmICghZW50cnkgfHwgZW50cnkucnVubmluZykgcmV0dXJuO1xuXG4gICAgZW50cnkucnVubmluZyA9IHRydWU7XG4gICAgZW50cnkuc3RhcnRlZEF0ID0gRGF0ZS5ub3coKTtcbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgcGF1c2VUaW1lcihpZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgIGlmICghZW50cnkgfHwgIWVudHJ5LnJ1bm5pbmcpIHJldHVybjtcblxuICAgIGVudHJ5LmVsYXBzZWRNcyA9IHRoaXMuZ2V0RWxhcHNlZChlbnRyeSk7XG4gICAgZW50cnkucnVubmluZyA9IGZhbHNlO1xuICAgIGVudHJ5LnN0YXJ0ZWRBdCA9IG51bGw7XG4gICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gIH1cblxuICBwcml2YXRlIHN0b3BUaW1lcihpZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgIGlmICghZW50cnkpIHJldHVybjtcblxuICAgIGVudHJ5LmVsYXBzZWRNcyA9IDA7XG4gICAgZW50cnkucnVubmluZyA9IGZhbHNlO1xuICAgIGVudHJ5LnN0YXJ0ZWRBdCA9IG51bGw7XG4gICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gIH1cblxuICBwcml2YXRlIGRlbGV0ZVRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLnRpbWVycy5kZWxldGUoaWQpO1xuICAgIHRoaXMuY3VycmVudEhlYWRpbmdJZHMgPSB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzLmZpbHRlcigoaGVhZGluZ0lkKSA9PiBoZWFkaW5nSWQgIT09IGlkKTtcbiAgICB2b2lkIHRoaXMucmVuZGVyTGlzdCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBkZWxldGVBbGxUaW1lcnMoKTogdm9pZCB7XG4gICAgdGhpcy50aW1lcnMuY2xlYXIoKTtcbiAgICB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZVRpbWVyRGlzcGxheXMoKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBpZCBvZiB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzKSB7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgICBjb25zdCB1aSA9IHRoaXMudGltZXJVaVJlZnMuZ2V0KGlkKTtcbiAgICAgIGlmICghZW50cnkgfHwgIXVpKSBjb250aW51ZTtcblxuICAgICAgdWkudGltZXJFbC5zZXRUZXh0KGZvcm1hdER1cmF0aW9uKHRoaXMuZ2V0RWxhcHNlZChlbnRyeSkpKTtcbiAgICAgIHVpLnBsYXlTdG9wQnRuLnNldFRleHQoZW50cnkucnVubmluZyA/IFwiU3RvcFwiIDogXCJQbGF5XCIpO1xuICAgICAgdWkucGF1c2VCdG4uZGlzYWJsZWQgPSAhZW50cnkucnVubmluZztcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGltZXJTaWRlYmFyUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgYXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFZJRVdfVFlQRV9USU1FUl9TSURFQkFSLCAobGVhZikgPT4gbmV3IFRpbWVyU2lkZWJhclZpZXcobGVhZiwgdGhpcykpO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm9wZW4tanctdGltZXItc2lkZWJhclwiLFxuICAgICAgbmFtZTogXCJPcGVuIEpXIFRpbWVyIHNpZGViYXJcIixcbiAgICAgIGNhbGxiYWNrOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMuYWN0aXZhdGVWaWV3KCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLmFjdGl2YXRlVmlldygpO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShWSUVXX1RZUEVfVElNRVJfU0lERUJBUik7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGFjdGl2YXRlVmlldygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBleGlzdGluZ0xlYXZlcyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX1RJTUVSX1NJREVCQVIpO1xuICAgIGlmIChleGlzdGluZ0xlYXZlcy5sZW5ndGggPiAwKSB7XG4gICAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihleGlzdGluZ0xlYXZlc1swXSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRSaWdodExlYWYoZmFsc2UpO1xuICAgIGlmICghbGVhZikgcmV0dXJuO1xuXG4gICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoe1xuICAgICAgdHlwZTogVklFV19UWVBFX1RJTUVSX1NJREVCQVIsXG4gICAgICBhY3RpdmU6IHRydWVcbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGxlYWYpO1xuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQkFPTztBQUVQLElBQU0sMEJBQTBCO0FBZ0JoQyxTQUFTLGFBQWEsVUFBa0IsU0FBK0I7QUFDckUsUUFBTSxPQUFPLFFBQVEsVUFBVSxNQUFNLFFBQVE7QUFDN0MsU0FBTyxHQUFHLFFBQVEsS0FBSyxJQUFJLEtBQUssUUFBUSxPQUFPO0FBQ2pEO0FBRUEsU0FBUyxlQUFlLElBQW9CO0FBQzFDLFFBQU0sZUFBZSxLQUFLLElBQUksR0FBRyxLQUFLLE1BQU0sS0FBSyxHQUFJLENBQUM7QUFDdEQsUUFBTSxRQUFRLEtBQUssTUFBTSxlQUFlLElBQUk7QUFDNUMsUUFBTSxVQUFVLEtBQUssTUFBTyxlQUFlLE9BQVEsRUFBRTtBQUNyRCxRQUFNLFVBQVUsZUFBZTtBQUUvQixTQUFPLEdBQUcsT0FBTyxLQUFLLEVBQUUsU0FBUyxHQUFHLEdBQUcsQ0FBQyxJQUFJLE9BQU8sT0FBTyxFQUFFLFNBQVMsR0FBRyxHQUFHLENBQUMsSUFBSSxPQUFPLE9BQU8sRUFBRSxTQUFTLEdBQUcsR0FBRyxDQUFDO0FBQ2xIO0FBRUEsSUFBTSxtQkFBTixjQUErQix5QkFBUztBQUFBLEVBVXRDLFlBQVksTUFBc0MsUUFBNEI7QUFDNUUsVUFBTSxJQUFJO0FB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
