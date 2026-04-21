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
var _TimerSidebarView = class _TimerSidebarView extends import_obsidian.ItemView {
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
        text: entry.running ? "Stop" : "Play"
      });
      const resetBtn = controls.createEl("button", {
        cls: "jw-timer-btn",
        text: "Reset"
      });
      const deleteBtn = controls.createEl("button", {
        cls: "jw-timer-btn jw-timer-btn-danger",
        text: "Delete"
      });
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcbiAgQXBwLFxuICBJdGVtVmlldyxcbiAgTWFya2Rvd25SZW5kZXJlcixcbiAgUGx1Z2luLFxuICBXb3Jrc3BhY2VMZWFmLFxuICBIZWFkaW5nQ2FjaGVcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmNvbnN0IFZJRVdfVFlQRV9USU1FUl9TSURFQkFSID0gXCJqdy10aW1lci1zaWRlYmFyLXZpZXdcIjtcblxuaW50ZXJmYWNlIFRpbWVyRW50cnkge1xuICBpZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xuICBlbGFwc2VkTXM6IG51bWJlcjtcbiAgcnVubmluZzogYm9vbGVhbjtcbiAgc3RhcnRlZEF0OiBudW1iZXIgfCBudWxsO1xufVxuXG5pbnRlcmZhY2UgVGltZXJVaVJlZiB7XG4gIGNhcmRFbDogSFRNTEVsZW1lbnQ7XG4gIHRpbWVyRWw6IEhUTUxFbGVtZW50O1xuICBwbGF5U3RvcEJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHJlc2V0QnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbn1cblxuZnVuY3Rpb24gYnVpbGRUaW1lcklkKGZpbGVQYXRoOiBzdHJpbmcsIGhlYWRpbmc6IEhlYWRpbmdDYWNoZSk6IHN0cmluZyB7XG4gIGNvbnN0IGxpbmUgPSBoZWFkaW5nLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IDA7XG4gIHJldHVybiBgJHtmaWxlUGF0aH06OiR7bGluZX06OiR7aGVhZGluZy5oZWFkaW5nfWA7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdER1cmF0aW9uKG1zOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCB0b3RhbFNlY29uZHMgPSBNYXRoLm1heCgwLCBNYXRoLmZsb29yKG1zIC8gMTAwMCkpO1xuICBjb25zdCBob3VycyA9IE1hdGguZmxvb3IodG90YWxTZWNvbmRzIC8gMzYwMCk7XG4gIGNvbnN0IG1pbnV0ZXMgPSBNYXRoLmZsb29yKCh0b3RhbFNlY29uZHMgJSAzNjAwKSAvIDYwKTtcbiAgY29uc3Qgc2Vjb25kcyA9IHRvdGFsU2Vjb25kcyAlIDYwO1xuXG4gIHJldHVybiBgJHtTdHJpbmcoaG91cnMpLnBhZFN0YXJ0KDIsIFwiMFwiKX06JHtTdHJpbmcobWludXRlcykucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhzZWNvbmRzKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbn1cblxuY2xhc3MgVGltZXJTaWRlYmFyVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgcHJpdmF0ZSB0aW1lcnMgPSBuZXcgTWFwPHN0cmluZywgVGltZXJFbnRyeT4oKTtcbiAgcHJpdmF0ZSB0aW1lclVpUmVmcyA9IG5ldyBNYXA8c3RyaW5nLCBUaW1lclVpUmVmPigpO1xuICBwcml2YXRlIGN1cnJlbnRIZWFkaW5nSWRzOiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIGN1cnJlbnRGaWxlUGF0aDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbiAgcHJpdmF0ZSBsaXN0RWwhOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBlbXB0eVN0YXRlRWwhOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSB0aWNrSGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgVElUTEVfTUFYX0xFTkdUSCA9IDYwO1xuXG4gIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHByaXZhdGUgcmVhZG9ubHkgcGx1Z2luOiBUaW1lclNpZGViYXJQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIFZJRVdfVFlQRV9USU1FUl9TSURFQkFSO1xuICB9XG5cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gXCJKVyBUaW1lcnNcIjtcbiAgfVxuXG4gIGdldEljb24oKTogc3RyaW5nIHtcbiAgICByZXR1cm4gXCJ0aW1lclwiO1xuICB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICB0aGlzLmNvbnRhaW5lckVsLmFkZENsYXNzKFwianctdGltZXItc2lkZWJhci1yb290XCIpO1xuXG4gICAgY29uc3Qgd3JhcHBlciA9IHRoaXMuY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLXdyYXBwZXJcIiB9KTtcblxuICAgIGNvbnN0IHRpdGxlRWwgPSB3cmFwcGVyLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIlRpbWVycyBieSBoZWFkaW5nXCIsIGNsczogXCJqdy10aW1lci10aXRsZVwiIH0pO1xuICAgIHRpdGxlRWwuc2V0QXR0cihcImFyaWEtbGl2ZVwiLCBcInBvbGl0ZVwiKTtcblxuICAgIHRoaXMubGlzdEVsID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItbGlzdFwiIH0pO1xuICAgIHRoaXMuZW1wdHlTdGF0ZUVsID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItZW1wdHlcIiB9KTtcblxuICAgIGNvbnN0IGZvb3RlckVsID0gd3JhcHBlci5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItZm9vdGVyXCIgfSk7XG4gICAgY29uc3QgZGVsZXRlQWxsQnRuID0gZm9vdGVyRWwuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgdGV4dDogXCJSZXNldCB0aW1lcnNcIixcbiAgICAgIGNsczogXCJqdy10aW1lci1idG4ganctdGltZXItYnRuLWRhbmdlclwiXG4gICAgfSk7XG5cbiAgICBkZWxldGVBbGxCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIHRoaXMuZGVsZXRlQWxsVGltZXJzKCk7XG4gICAgfSk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAud29ya3NwYWNlLm9uKFwiYWN0aXZlLWxlYWYtY2hhbmdlXCIsICgpID0+IHZvaWQgdGhpcy5yZWZyZXNoRnJvbUFjdGl2ZUZpbGUoKSkpO1xuXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5vbihcImNoYW5nZWRcIiwgKGZpbGUpID0+IHtcbiAgICAgICAgaWYgKGZpbGUucGF0aCA9PT0gdGhpcy5jdXJyZW50RmlsZVBhdGgpIHtcbiAgICAgICAgICB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHRoaXMudGlja0hhbmRsZSA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgICB9LCAyNTApO1xuXG4gICAgdm9pZCB0aGlzLnJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpO1xuICB9XG5cbiAgYXN5bmMgb25DbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy50aWNrSGFuZGxlICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLnRpY2tIYW5kbGUpO1xuICAgICAgdGhpcy50aWNrSGFuZGxlID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy50aW1lclVpUmVmcy5jbGVhcigpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZWZyZXNoRnJvbUFjdGl2ZUZpbGUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cbiAgICBpZiAoIWFjdGl2ZUZpbGUpIHtcbiAgICAgIHRoaXMuY3VycmVudEZpbGVQYXRoID0gbnVsbDtcbiAgICAgIHRoaXMuY3VycmVudEhlYWRpbmdJZHMgPSBbXTtcbiAgICAgIGF3YWl0IHRoaXMucmVuZGVyTGlzdCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuY3VycmVudEZpbGVQYXRoID0gYWN0aXZlRmlsZS5wYXRoO1xuICAgIGNvbnN0IGZpbGVDb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZChhY3RpdmVGaWxlKTtcbiAgICBjb25zdCBmaWxlQ2FjaGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShhY3RpdmVGaWxlKTtcbiAgICBjb25zdCBoZWFkaW5ncyA9IChmaWxlQ2FjaGU/LmhlYWRpbmdzID8/IFtdKS5zbGljZSgpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGNvbnN0IGxpbmVBID0gYS5wb3NpdGlvbj8uc3RhcnQubGluZSA/PyAwO1xuICAgICAgY29uc3QgbGluZUIgPSBiLnBvc2l0aW9uPy5zdGFydC5saW5lID8/IDA7XG4gICAgICByZXR1cm4gbGluZUEgLSBsaW5lQjtcbiAgICB9KTtcbiAgICBjb25zdCByYXdIZWFkaW5nVGl0bGVzID0gdGhpcy5leHRyYWN0UmF3SGVhZGluZ1RpdGxlcyhmaWxlQ29udGVudCwgaGVhZGluZ3MpO1xuXG4gICAgY29uc3QgbmV4dEhlYWRpbmdJZHM6IHN0cmluZ1tdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGhlYWRpbmcgb2YgaGVhZGluZ3MpIHtcbiAgICAgIGNvbnN0IGlkID0gYnVpbGRUaW1lcklkKGFjdGl2ZUZpbGUucGF0aCwgaGVhZGluZyk7XG4gICAgICBjb25zdCBoZWFkaW5nTGluZSA9IGhlYWRpbmcucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gMDtcbiAgICAgIGNvbnN0IGhlYWRpbmdUaXRsZSA9IHJhd0hlYWRpbmdUaXRsZXMuZ2V0KGhlYWRpbmdMaW5lKSA/PyBoZWFkaW5nLmhlYWRpbmc7XG4gICAgICBjb25zdCBleGlzdGluZyA9IHRoaXMudGltZXJzLmdldChpZCk7XG5cbiAgICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgICAgdGhpcy50aW1lcnMuc2V0KGlkLCB7XG4gICAgICAgICAgaWQsXG4gICAgICAgICAgdGl0bGU6IGhlYWRpbmdUaXRsZSxcbiAgICAgICAgICBlbGFwc2VkTXM6IDAsXG4gICAgICAgICAgcnVubmluZzogZmFsc2UsXG4gICAgICAgICAgc3RhcnRlZEF0OiBudWxsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZXhpc3RpbmcudGl0bGUgPSBoZWFkaW5nVGl0bGU7XG4gICAgICB9XG5cbiAgICAgIG5leHRIZWFkaW5nSWRzLnB1c2goaWQpO1xuICAgIH1cblxuICAgIGNvbnN0IG5leHRJZHNTZXQgPSBuZXcgU2V0KG5leHRIZWFkaW5nSWRzKTtcbiAgICBmb3IgKGNvbnN0IGV4aXN0aW5nSWQgb2YgdGhpcy50aW1lcnMua2V5cygpKSB7XG4gICAgICBpZiAoZXhpc3RpbmdJZC5zdGFydHNXaXRoKGAke2FjdGl2ZUZpbGUucGF0aH06OmApICYmICFuZXh0SWRzU2V0LmhhcyhleGlzdGluZ0lkKSkge1xuICAgICAgICB0aGlzLnRpbWVycy5kZWxldGUoZXhpc3RpbmdJZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5jdXJyZW50SGVhZGluZ0lkcyA9IG5leHRIZWFkaW5nSWRzO1xuICAgIGF3YWl0IHRoaXMucmVuZGVyTGlzdCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBleHRyYWN0UmF3SGVhZGluZ1RpdGxlcyhjb250ZW50OiBzdHJpbmcsIGhlYWRpbmdzOiBIZWFkaW5nQ2FjaGVbXSk6IE1hcDxudW1iZXIsIHN0cmluZz4ge1xuICAgIGNvbnN0IGxpbmVzID0gY29udGVudC5zcGxpdCgvXFxyP1xcbi8pO1xuICAgIGNvbnN0IHRpdGxlc0J5TGluZSA9IG5ldyBNYXA8bnVtYmVyLCBzdHJpbmc+KCk7XG5cbiAgICBmb3IgKGNvbnN0IGhlYWRpbmcgb2YgaGVhZGluZ3MpIHtcbiAgICAgIGNvbnN0IGxpbmVJbmRleCA9IGhlYWRpbmcucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gLTE7XG4gICAgICBpZiAobGluZUluZGV4IDwgMCB8fCBsaW5lSW5kZXggPj0gbGluZXMubGVuZ3RoKSBjb250aW51ZTtcblxuICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2xpbmVJbmRleF07XG4gICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL15cXHN7MCwzfSN7MSw2fVxccysoLiopJC8pO1xuICAgICAgaWYgKCFtYXRjaCkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IHJhdyA9IG1hdGNoWzFdLnJlcGxhY2UoL1xccysjK1xccyokLywgXCJcIikudHJpbSgpO1xuICAgICAgdGl0bGVzQnlMaW5lLnNldChsaW5lSW5kZXgsIHJhdy5sZW5ndGggPiAwID8gcmF3IDogaGVhZGluZy5oZWFkaW5nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGl0bGVzQnlMaW5lO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZW5kZXJMaXN0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMubGlzdEVsLmVtcHR5KCk7XG4gICAgdGhpcy50aW1lclVpUmVmcy5jbGVhcigpO1xuXG4gICAgaWYgKHRoaXMuY3VycmVudEhlYWRpbmdJZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLmVtcHR5U3RhdGVFbC5zZXRUZXh0KFwiTm8gaGVhZGVycyBmb3VuZCBpbiB0aGUgY3VycmVudCBub3RlLlwiKTtcbiAgICAgIHRoaXMuZW1wdHlTdGF0ZUVsLnNob3coKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmVtcHR5U3RhdGVFbC5oaWRlKCk7XG5cbiAgICBmb3IgKGNvbnN0IGlkIG9mIHRoaXMuY3VycmVudEhlYWRpbmdJZHMpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICAgIGlmICghZW50cnkpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBjYXJkID0gdGhpcy5saXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNhcmRcIiB9KTtcbiAgICAgIGNvbnN0IHRpdGxlRWwgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jYXJkLXRpdGxlXCIgfSk7XG4gICAgICBjb25zdCB0aXRsZURhdGEgPSBhd2FpdCB0aGlzLmdldFJlbmRlcmVkVGl0bGUoZW50cnkudGl0bGUpO1xuICAgICAgaWYgKHRpdGxlRGF0YS50cmltbWVkKSB7XG4gICAgICAgIHRpdGxlRWwuc2V0VGV4dCh0aXRsZURhdGEuY29udGVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcih0aGlzLmFwcCwgdGl0bGVEYXRhLmNvbnRlbnQsIHRpdGxlRWwsIHRoaXMuY3VycmVudEZpbGVQYXRoID8/IFwiXCIsIHRoaXMpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB0aW1lckVsID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2xvY2tcIiwgdGV4dDogZm9ybWF0RHVyYXRpb24odGhpcy5nZXRFbGFwc2VkKGVudHJ5KSkgfSk7XG5cbiAgICAgIGNvbnN0IGNvbnRyb2xzID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY29udHJvbHNcIiB9KTtcblxuICAgICAgY29uc3QgcGxheVN0b3BCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJqdy10aW1lci1idG5cIixcbiAgICAgICAgdGV4dDogZW50cnkucnVubmluZyA/IFwiU3RvcFwiIDogXCJQbGF5XCJcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCByZXNldEJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgICAgY2xzOiBcImp3LXRpbWVyLWJ0blwiLFxuICAgICAgICB0ZXh0OiBcIlJlc2V0XCJcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBkZWxldGVCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJqdy10aW1lci1idG4ganctdGltZXItYnRuLWRhbmdlclwiLFxuICAgICAgICB0ZXh0OiBcIkRlbGV0ZVwiXG4gICAgICB9KTtcblxuICAgICAgcGxheVN0b3BCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgaWYgKGVudHJ5LnJ1bm5pbmcpIHtcbiAgICAgICAgICB0aGlzLnBhdXNlVGltZXIoZW50cnkuaWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuc3RhcnRUaW1lcihlbnRyeS5pZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICByZXNldEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICB0aGlzLnJlc2V0VGltZXIoZW50cnkuaWQpO1xuICAgICAgfSk7XG5cbiAgICAgIGRlbGV0ZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICB0aGlzLmRlbGV0ZVRpbWVyKGVudHJ5LmlkKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLnRpbWVyVWlSZWZzLnNldChlbnRyeS5pZCwgeyBjYXJkRWw6IGNhcmQsIHRpbWVyRWwsIHBsYXlTdG9wQnRuLCByZXNldEJ0biB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0RWxhcHNlZChlbnRyeTogVGltZXJFbnRyeSk6IG51bWJlciB7XG4gICAgaWYgKCFlbnRyeS5ydW5uaW5nIHx8IGVudHJ5LnN0YXJ0ZWRBdCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGVudHJ5LmVsYXBzZWRNcztcbiAgICB9XG5cbiAgICByZXR1cm4gZW50cnkuZWxhcHNlZE1zICsgKERhdGUubm93KCkgLSBlbnRyeS5zdGFydGVkQXQpO1xuICB9XG5cbiAgcHJpdmF0ZSBzdGFydFRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgaWYgKCFlbnRyeSB8fCBlbnRyeS5ydW5uaW5nKSByZXR1cm47XG5cbiAgICBlbnRyeS5ydW5uaW5nID0gdHJ1ZTtcbiAgICBlbnRyeS5zdGFydGVkQXQgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICB9XG5cbiAgcHJpdmF0ZSBwYXVzZVRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgaWYgKCFlbnRyeSB8fCAhZW50cnkucnVubmluZykgcmV0dXJuO1xuXG4gICAgZW50cnkuZWxhcHNlZE1zID0gdGhpcy5nZXRFbGFwc2VkKGVudHJ5KTtcbiAgICBlbnRyeS5ydW5uaW5nID0gZmFsc2U7XG4gICAgZW50cnkuc3RhcnRlZEF0ID0gbnVsbDtcbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzZXRUaW1lcihpZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgIGlmICghZW50cnkpIHJldHVybjtcblxuICAgIGVudHJ5LmVsYXBzZWRNcyA9IDA7XG4gICAgZW50cnkucnVubmluZyA9IGZhbHNlO1xuICAgIGVudHJ5LnN0YXJ0ZWRBdCA9IG51bGw7XG4gICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gIH1cblxuICBwcml2YXRlIGRlbGV0ZVRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLnRpbWVycy5kZWxldGUoaWQpO1xuICAgIHRoaXMuY3VycmVudEhlYWRpbmdJZHMgPSB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzLmZpbHRlcigoaGVhZGluZ0lkKSA9PiBoZWFkaW5nSWQgIT09IGlkKTtcbiAgICB2b2lkIHRoaXMucmVuZGVyTGlzdCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBkZWxldGVBbGxUaW1lcnMoKTogdm9pZCB7XG4gICAgdGhpcy50aW1lcnMuY2xlYXIoKTtcbiAgICB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZVRpbWVyRGlzcGxheXMoKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBpZCBvZiB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzKSB7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgICBjb25zdCB1aSA9IHRoaXMudGltZXJVaVJlZnMuZ2V0KGlkKTtcbiAgICAgIGlmICghZW50cnkgfHwgIXVpKSBjb250aW51ZTtcblxuICAgICAgdWkudGltZXJFbC5zZXRUZXh0KGZvcm1hdER1cmF0aW9uKHRoaXMuZ2V0RWxhcHNlZChlbnRyeSkpKTtcbiAgICAgIHVpLnBsYXlTdG9wQnRuLnNldFRleHQoZW50cnkucnVubmluZyA/IFwiU3RvcFwiIDogXCJQbGF5XCIpO1xuXG4gICAgICBjb25zdCBlbGFwc2VkID0gdGhpcy5nZXRFbGFwc2VkKGVudHJ5KTtcbiAgICAgIHVpLmNhcmRFbC5yZW1vdmVDbGFzcyhcImp3LXRpbWVyLWNhcmQtLXJ1bm5pbmdcIiwgXCJqdy10aW1lci1jYXJkLS1zdG9wcGVkXCIpO1xuICAgICAgaWYgKGVudHJ5LnJ1bm5pbmcpIHtcbiAgICAgICAgdWkuY2FyZEVsLmFkZENsYXNzKFwianctdGltZXItY2FyZC0tcnVubmluZ1wiKTtcbiAgICAgIH0gZWxzZSBpZiAoZWxhcHNlZCA+IDApIHtcbiAgICAgICAgdWkuY2FyZEVsLmFkZENsYXNzKFwianctdGltZXItY2FyZC0tc3RvcHBlZFwiKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGdldFJlbmRlcmVkVGl0bGUocmF3VGl0bGU6IHN0cmluZyk6IFByb21pc2U8eyBjb250ZW50OiBzdHJpbmc7IHRyaW1tZWQ6IGJvb2xlYW4gfT4ge1xuICAgIGNvbnN0IHRlbXBFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgYXdhaXQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIodGhpcy5hcHAsIHJhd1RpdGxlLCB0ZW1wRWwsIHRoaXMuY3VycmVudEZpbGVQYXRoID8/IFwiXCIsIHRoaXMpO1xuXG4gICAgY29uc3QgcGxhaW4gPSAodGVtcEVsLnRleHRDb250ZW50ID8/IFwiXCIpLnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnRyaW0oKTtcbiAgICBpZiAocGxhaW4ubGVuZ3RoIDw9IFRpbWVyU2lkZWJhclZpZXcuVElUTEVfTUFYX0xFTkdUSCkge1xuICAgICAgcmV0dXJuIHsgY29udGVudDogcmF3VGl0bGUsIHRyaW1tZWQ6IGZhbHNlIH07XG4gICAgfVxuXG4gICAgY29uc3Qgc2hvcnRlbmVkID0gYCR7cGxhaW4uc2xpY2UoMCwgVGltZXJTaWRlYmFyVmlldy5USVRMRV9NQVhfTEVOR1RIIC0gMykudHJpbUVuZCgpfS4uLmA7XG4gICAgcmV0dXJuIHsgY29udGVudDogc2hvcnRlbmVkLCB0cmltbWVkOiB0cnVlIH07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGltZXJTaWRlYmFyUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgYXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFZJRVdfVFlQRV9USU1FUl9TSURFQkFSLCAobGVhZikgPT4gbmV3IFRpbWVyU2lkZWJhclZpZXcobGVhZiwgdGhpcykpO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm9wZW4tanctdGltZXItc2lkZWJhclwiLFxuICAgICAgbmFtZTogXCJPcGVuIEpXIFRpbWVyIHNpZGViYXJcIixcbiAgICAgIGNhbGxiYWNrOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMuYWN0aXZhdGVWaWV3KCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLmFjdGl2YXRlVmlldygpO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShWSUVXX1RZUEVfVElNRVJfU0lERUJBUik7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGFjdGl2YXRlVmlldygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBleGlzdGluZ0xlYXZlcyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX1RJTUVSX1NJREVCQVIpO1xuICAgIGlmIChleGlzdGluZ0xlYXZlcy5sZW5ndGggPiAwKSB7XG4gICAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihleGlzdGluZ0xlYXZlc1swXSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRSaWdodExlYWYoZmFsc2UpO1xuICAgIGlmICghbGVhZikgcmV0dXJuO1xuXG4gICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoe1xuICAgICAgdHlwZTogVklFV19UWVBFX1RJTUVSX1NJREVCQVIsXG4gICAgICBhY3RpdmU6IHRydWVcbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGxlYWYpO1xuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQkFPTztBQUVQLElBQU0sMEJBQTBCO0FBaUJoQyxTQUFTLGFBQWEsVUFBa0IsU0FBK0I7QUFDckUsUUFBTSxPQUFPLFFBQVEsVUFBVSxNQUFNLFFBQVE7QUFDN0MsU0FBTyxHQUFHLFFBQVEsS0FBSyxJQUFJLEtBQUssUUFBUSxPQUFPO0FBQ2pEO0FBRUEsU0FBUyxlQUFlLElBQW9CO0FBQzFDLFFBQU0sZUFBZSxLQUFLLElBQUksR0FBRyxLQUFLLE1BQU0sS0FBSyxHQUFJLENBQUM7QUFDdEQsUUFBTSxRQUFRLEtBQUssTUFBTSxlQUFlLElBQUk7QUFDNUMsUUFBTSxVQUFVLEtBQUssTUFBTyxlQUFlLE9BQVEsRUFBRTtBQUNyRCxRQUFNLFVBQVUsZUFBZTtB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
