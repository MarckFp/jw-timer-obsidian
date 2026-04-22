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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcbiAgQXBwLFxuICBJdGVtVmlldyxcbiAgTWFya2Rvd25SZW5kZXJlcixcbiAgUGx1Z2luLFxuICBXb3Jrc3BhY2VMZWFmLFxuICBIZWFkaW5nQ2FjaGVcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmNvbnN0IFZJRVdfVFlQRV9USU1FUl9TSURFQkFSID0gXCJqdy10aW1lci1zaWRlYmFyLXZpZXdcIjtcbmNvbnN0IFVJX1RFWFQgPSB7XG4gIHRpdGxlOiBcIlx1MjNGMVx1RkUwRlwiLFxuICBlbXB0eTogXCJcdTIyMDVcIixcbiAgb3BlbjogXCJcdTI1QjZcdUZFMEZcIixcbiAgcGF1c2U6IFwiXHUyM0Y4XHVGRTBGXCIsXG4gIHJlc2V0OiBcIlx1RDgzRFx1REQwNFwiLFxuICBkZWxldGU6IFwiXHVEODNEXHVEREQxXHVGRTBGXCIsXG4gIHJlc2V0QWxsOiBcIlx1MjY3Qlx1RkUwRlwiXG59IGFzIGNvbnN0O1xuXG5pbnRlcmZhY2UgVGltZXJFbnRyeSB7XG4gIGlkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGVsYXBzZWRNczogbnVtYmVyO1xuICBydW5uaW5nOiBib29sZWFuO1xuICBzdGFydGVkQXQ6IG51bWJlciB8IG51bGw7XG59XG5cbmludGVyZmFjZSBUaW1lclVpUmVmIHtcbiAgY2FyZEVsOiBIVE1MRWxlbWVudDtcbiAgdGltZXJFbDogSFRNTEVsZW1lbnQ7XG4gIHBsYXlTdG9wQnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgcmVzZXRCdG46IEhUTUxCdXR0b25FbGVtZW50O1xufVxuXG5mdW5jdGlvbiBidWlsZFRpbWVySWQoZmlsZVBhdGg6IHN0cmluZywgaGVhZGluZzogSGVhZGluZ0NhY2hlKTogc3RyaW5nIHtcbiAgY29uc3QgbGluZSA9IGhlYWRpbmcucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gMDtcbiAgcmV0dXJuIGAke2ZpbGVQYXRofTo6JHtsaW5lfTo6JHtoZWFkaW5nLmhlYWRpbmd9YDtcbn1cblxuZnVuY3Rpb24gZm9ybWF0RHVyYXRpb24obXM6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IHRvdGFsU2Vjb25kcyA9IE1hdGgubWF4KDAsIE1hdGguZmxvb3IobXMgLyAxMDAwKSk7XG4gIGNvbnN0IGhvdXJzID0gTWF0aC5mbG9vcih0b3RhbFNlY29uZHMgLyAzNjAwKTtcbiAgY29uc3QgbWludXRlcyA9IE1hdGguZmxvb3IoKHRvdGFsU2Vjb25kcyAlIDM2MDApIC8gNjApO1xuICBjb25zdCBzZWNvbmRzID0gdG90YWxTZWNvbmRzICUgNjA7XG5cbiAgcmV0dXJuIGAke1N0cmluZyhob3VycykucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhtaW51dGVzKS5wYWRTdGFydCgyLCBcIjBcIil9OiR7U3RyaW5nKHNlY29uZHMpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xufVxuXG5jbGFzcyBUaW1lclNpZGViYXJWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIHRpbWVycyA9IG5ldyBNYXA8c3RyaW5nLCBUaW1lckVudHJ5PigpO1xuICBwcml2YXRlIGRlbGV0ZWRUaW1lcklkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBwcml2YXRlIHRpbWVyVWlSZWZzID0gbmV3IE1hcDxzdHJpbmcsIFRpbWVyVWlSZWY+KCk7XG4gIHByaXZhdGUgY3VycmVudEhlYWRpbmdJZHM6IHN0cmluZ1tdID0gW107XG4gIHByaXZhdGUgY3VycmVudEZpbGVQYXRoOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICBwcml2YXRlIGxpc3RFbCE6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGVtcHR5U3RhdGVFbCE6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIHRpY2tIYW5kbGU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBUSVRMRV9NQVhfTEVOR1RIID0gNjA7XG5cbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZiwgcHJpdmF0ZSByZWFkb25seSBwbHVnaW46IFRpbWVyU2lkZWJhclBsdWdpbikge1xuICAgIHN1cGVyKGxlYWYpO1xuICB9XG5cbiAgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gVklFV19UWVBFX1RJTUVSX1NJREVCQVI7XG4gIH1cblxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcge1xuICAgIHJldHVybiBcIkpXIFRpbWVyc1wiO1xuICB9XG5cbiAgZ2V0SWNvbigpOiBzdHJpbmcge1xuICAgIHJldHVybiBcInRpbWVyXCI7XG4gIH1cblxuICBhc3luYyBvbk9wZW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5jb250ZW50RWwuZW1wdHkoKTtcbiAgICB0aGlzLmNvbnRlbnRFbC5hZGRDbGFzcyhcImp3LXRpbWVyLXNpZGViYXItcm9vdFwiKTtcblxuICAgIGNvbnN0IHdyYXBwZXIgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItd3JhcHBlclwiIH0pO1xuXG4gICAgY29uc3QgdGl0bGVFbCA9IHdyYXBwZXIuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFVJX1RFWFQudGl0bGUsIGNsczogXCJqdy10aW1lci10aXRsZVwiIH0pO1xuICAgIHRpdGxlRWwuc2V0QXR0cihcImFyaWEtbGl2ZVwiLCBcInBvbGl0ZVwiKTtcbiAgICB0aXRsZUVsLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiVGltZXJzIGJ5IGhlYWRpbmdcIik7XG5cbiAgICB0aGlzLmxpc3RFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWxpc3RcIiB9KTtcbiAgICB0aGlzLmVtcHR5U3RhdGVFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWVtcHR5XCIgfSk7XG5cbiAgICBjb25zdCBmb290ZXJFbCA9IHdyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWZvb3RlclwiIH0pO1xuICAgIGNvbnN0IGRlbGV0ZUFsbEJ0biA9IGZvb3RlckVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgIHRleHQ6IFVJX1RFWFQucmVzZXRBbGwsXG4gICAgICBjbHM6IFwianctdGltZXItYnRuIGp3LXRpbWVyLWJ0bi1kYW5nZXJcIlxuICAgIH0pO1xuICAgIGRlbGV0ZUFsbEJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIlJlc2V0IGFsbCB0aW1lcnNcIik7XG4gICAgZGVsZXRlQWxsQnRuLnNldEF0dHIoXCJ0aXRsZVwiLCBcIlJlc2V0IGFsbCB0aW1lcnNcIik7XG5cbiAgICBkZWxldGVBbGxCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGlmICh0aGlzLmNvbmZpcm1BY3Rpb24oXCJSZXNldCBhbGwgdGltZXJzP1wiKSkge1xuICAgICAgICB0aGlzLmRlbGV0ZUFsbFRpbWVycygpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCAoKSA9PiB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCkpKTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUub24oXCJjaGFuZ2VkXCIsIChmaWxlKSA9PiB7XG4gICAgICAgIGlmIChmaWxlLnBhdGggPT09IHRoaXMuY3VycmVudEZpbGVQYXRoKSB7XG4gICAgICAgICAgdm9pZCB0aGlzLnJlZnJlc2hGcm9tQWN0aXZlRmlsZSgpO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICk7XG5cbiAgICB0aGlzLnRpY2tIYW5kbGUgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gICAgfSwgMjUwKTtcblxuICAgIHZvaWQgdGhpcy5yZWZyZXNoRnJvbUFjdGl2ZUZpbGUoKTtcbiAgfVxuXG4gIGFzeW5jIG9uQ2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKHRoaXMudGlja0hhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy50aWNrSGFuZGxlKTtcbiAgICAgIHRoaXMudGlja0hhbmRsZSA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuY29udGVudEVsLnJlbW92ZUNsYXNzKFwianctdGltZXItc2lkZWJhci1yb290XCIpO1xuICAgIHRoaXMudGltZXJVaVJlZnMuY2xlYXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVmcmVzaEZyb21BY3RpdmVGaWxlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGFjdGl2ZUZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXG4gICAgaWYgKCFhY3RpdmVGaWxlKSB7XG4gICAgICB0aGlzLmN1cnJlbnRGaWxlUGF0aCA9IG51bGw7XG4gICAgICB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzID0gW107XG4gICAgICBhd2FpdCB0aGlzLnJlbmRlckxpc3QoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmN1cnJlbnRGaWxlUGF0aCA9IGFjdGl2ZUZpbGUucGF0aDtcbiAgICBjb25zdCBmaWxlQ29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNhY2hlZFJlYWQoYWN0aXZlRmlsZSk7XG4gICAgY29uc3QgZmlsZUNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoYWN0aXZlRmlsZSk7XG4gICAgY29uc3QgaGVhZGluZ3MgPSAoZmlsZUNhY2hlPy5oZWFkaW5ncyA/PyBbXSkuc2xpY2UoKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICBjb25zdCBsaW5lQSA9IGEucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gMDtcbiAgICAgIGNvbnN0IGxpbmVCID0gYi5wb3NpdGlvbj8uc3RhcnQubGluZSA/PyAwO1xuICAgICAgcmV0dXJuIGxpbmVBIC0gbGluZUI7XG4gICAgfSk7XG4gICAgY29uc3QgcmF3SGVhZGluZ1RpdGxlcyA9IHRoaXMuZXh0cmFjdFJhd0hlYWRpbmdUaXRsZXMoZmlsZUNvbnRlbnQsIGhlYWRpbmdzKTtcblxuICAgIGNvbnN0IG5leHRIZWFkaW5nSWRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGFsbEhlYWRpbmdJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAgIGZvciAoY29uc3QgaGVhZGluZyBvZiBoZWFkaW5ncykge1xuICAgICAgY29uc3QgaWQgPSBidWlsZFRpbWVySWQoYWN0aXZlRmlsZS5wYXRoLCBoZWFkaW5nKTtcbiAgICAgIGFsbEhlYWRpbmdJZHMuYWRkKGlkKTtcbiAgICAgIGlmICh0aGlzLmRlbGV0ZWRUaW1lcklkcy5oYXMoaWQpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBoZWFkaW5nTGluZSA9IGhlYWRpbmcucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gMDtcbiAgICAgIGNvbnN0IGhlYWRpbmdUaXRsZSA9IHJhd0hlYWRpbmdUaXRsZXMuZ2V0KGhlYWRpbmdMaW5lKSA/PyBoZWFkaW5nLmhlYWRpbmc7XG4gICAgICBjb25zdCBleGlzdGluZyA9IHRoaXMudGltZXJzLmdldChpZCk7XG5cbiAgICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgICAgdGhpcy50aW1lcnMuc2V0KGlkLCB7XG4gICAgICAgICAgaWQsXG4gICAgICAgICAgdGl0bGU6IGhlYWRpbmdUaXRsZSxcbiAgICAgICAgICBlbGFwc2VkTXM6IDAsXG4gICAgICAgICAgcnVubmluZzogZmFsc2UsXG4gICAgICAgICAgc3RhcnRlZEF0OiBudWxsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZXhpc3RpbmcudGl0bGUgPSBoZWFkaW5nVGl0bGU7XG4gICAgICB9XG5cbiAgICAgIG5leHRIZWFkaW5nSWRzLnB1c2goaWQpO1xuICAgIH1cblxuICAgIGNvbnN0IG5leHRJZHNTZXQgPSBuZXcgU2V0KG5leHRIZWFkaW5nSWRzKTtcbiAgICBmb3IgKGNvbnN0IGV4aXN0aW5nSWQgb2YgWy4uLnRoaXMudGltZXJzLmtleXMoKV0pIHtcbiAgICAgIGlmIChleGlzdGluZ0lkLnN0YXJ0c1dpdGgoYCR7YWN0aXZlRmlsZS5wYXRofTo6YCkgJiYgIW5leHRJZHNTZXQuaGFzKGV4aXN0aW5nSWQpKSB7XG4gICAgICAgIHRoaXMudGltZXJzLmRlbGV0ZShleGlzdGluZ0lkKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGRlbGV0ZWRJZCBvZiBbLi4udGhpcy5kZWxldGVkVGltZXJJZHNdKSB7XG4gICAgICBpZiAoZGVsZXRlZElkLnN0YXJ0c1dpdGgoYCR7YWN0aXZlRmlsZS5wYXRofTo6YCkgJiYgIWFsbEhlYWRpbmdJZHMuaGFzKGRlbGV0ZWRJZCkpIHtcbiAgICAgICAgdGhpcy5kZWxldGVkVGltZXJJZHMuZGVsZXRlKGRlbGV0ZWRJZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5jdXJyZW50SGVhZGluZ0lkcyA9IG5leHRIZWFkaW5nSWRzO1xuICAgIGF3YWl0IHRoaXMucmVuZGVyTGlzdCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBleHRyYWN0UmF3SGVhZGluZ1RpdGxlcyhjb250ZW50OiBzdHJpbmcsIGhlYWRpbmdzOiBIZWFkaW5nQ2FjaGVbXSk6IE1hcDxudW1iZXIsIHN0cmluZz4ge1xuICAgIGNvbnN0IGxpbmVzID0gY29udGVudC5zcGxpdCgvXFxyP1xcbi8pO1xuICAgIGNvbnN0IHRpdGxlc0J5TGluZSA9IG5ldyBNYXA8bnVtYmVyLCBzdHJpbmc+KCk7XG5cbiAgICBmb3IgKGNvbnN0IGhlYWRpbmcgb2YgaGVhZGluZ3MpIHtcbiAgICAgIGNvbnN0IGxpbmVJbmRleCA9IGhlYWRpbmcucG9zaXRpb24/LnN0YXJ0LmxpbmUgPz8gLTE7XG4gICAgICBpZiAobGluZUluZGV4IDwgMCB8fCBsaW5lSW5kZXggPj0gbGluZXMubGVuZ3RoKSBjb250aW51ZTtcblxuICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2xpbmVJbmRleF07XG4gICAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL15cXHN7MCwzfSN7MSw2fVxccysoLiopJC8pO1xuICAgICAgaWYgKCFtYXRjaCkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IHJhdyA9IG1hdGNoWzFdLnJlcGxhY2UoL1xccysjK1xccyokLywgXCJcIikudHJpbSgpO1xuICAgICAgdGl0bGVzQnlMaW5lLnNldChsaW5lSW5kZXgsIHJhdy5sZW5ndGggPiAwID8gcmF3IDogaGVhZGluZy5oZWFkaW5nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGl0bGVzQnlMaW5lO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZW5kZXJMaXN0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMubGlzdEVsLmVtcHR5KCk7XG4gICAgdGhpcy50aW1lclVpUmVmcy5jbGVhcigpO1xuXG4gICAgaWYgKHRoaXMuY3VycmVudEhlYWRpbmdJZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLmVtcHR5U3RhdGVFbC5zZXRUZXh0KFVJX1RFWFQuZW1wdHkpO1xuICAgICAgdGhpcy5lbXB0eVN0YXRlRWwuc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJObyBoZWFkZXJzIGZvdW5kIGluIHRoZSBjdXJyZW50IG5vdGVcIik7XG4gICAgICB0aGlzLmVtcHR5U3RhdGVFbC5zaG93KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5lbXB0eVN0YXRlRWwuaGlkZSgpO1xuXG4gICAgZm9yIChjb25zdCBpZCBvZiB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzKSB7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgICBpZiAoIWVudHJ5KSBjb250aW51ZTtcblxuICAgICAgY29uc3QgY2FyZCA9IHRoaXMubGlzdEVsLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jYXJkXCIgfSk7XG4gICAgICBjb25zdCB0aXRsZUVsID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2FyZC10aXRsZVwiIH0pO1xuICAgICAgYXdhaXQgdGhpcy5yZW5kZXJUaXRsZUNvbnRlbnQodGl0bGVFbCwgZW50cnkudGl0bGUpO1xuXG4gICAgICBjb25zdCB0aW1lckVsID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2xvY2tcIiwgdGV4dDogZm9ybWF0RHVyYXRpb24odGhpcy5nZXRFbGFwc2VkKGVudHJ5KSkgfSk7XG5cbiAgICAgIGNvbnN0IGNvbnRyb2xzID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY29udHJvbHNcIiB9KTtcblxuICAgICAgY29uc3QgcGxheVN0b3BCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJqdy10aW1lci1idG5cIixcbiAgICAgICAgdGV4dDogZW50cnkucnVubmluZyA/IFVJX1RFWFQucGF1c2UgOiBVSV9URVhULm9wZW5cbiAgICAgIH0pO1xuICAgICAgcGxheVN0b3BCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgZW50cnkucnVubmluZyA/IFwiUGF1c2UgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG4gICAgICBwbGF5U3RvcEJ0bi5zZXRBdHRyKFwidGl0bGVcIiwgZW50cnkucnVubmluZyA/IFwiUGF1c2UgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG5cbiAgICAgIGNvbnN0IHJlc2V0QnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICBjbHM6IFwianctdGltZXItYnRuXCIsXG4gICAgICAgIHRleHQ6IFVJX1RFWFQucmVzZXRcbiAgICAgIH0pO1xuICAgICAgcmVzZXRCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJSZXNldCB0aW1lclwiKTtcbiAgICAgIHJlc2V0QnRuLnNldEF0dHIoXCJ0aXRsZVwiLCBcIlJlc2V0IHRpbWVyXCIpO1xuXG4gICAgICBjb25zdCBkZWxldGVCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICAgIGNsczogXCJqdy10aW1lci1idG4ganctdGltZXItYnRuLWRhbmdlclwiLFxuICAgICAgICB0ZXh0OiBVSV9URVhULmRlbGV0ZVxuICAgICAgfSk7XG4gICAgICBkZWxldGVCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJEZWxldGUgdGltZXJcIik7XG4gICAgICBkZWxldGVCdG4uc2V0QXR0cihcInRpdGxlXCIsIFwiRGVsZXRlIHRpbWVyXCIpO1xuXG4gICAgICBwbGF5U3RvcEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICBpZiAoZW50cnkucnVubmluZykge1xuICAgICAgICAgIHRoaXMucGF1c2VUaW1lcihlbnRyeS5pZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5zdGFydFRpbWVyKGVudHJ5LmlkKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHJlc2V0QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIHRoaXMucmVzZXRUaW1lcihlbnRyeS5pZCk7XG4gICAgICB9KTtcblxuICAgICAgZGVsZXRlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIGlmICh0aGlzLmNvbmZpcm1BY3Rpb24oXCJEZWxldGUgdGhpcyB0aW1lcj9cIikpIHtcbiAgICAgICAgICB0aGlzLmRlbGV0ZVRpbWVyKGVudHJ5LmlkKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudGltZXJVaVJlZnMuc2V0KGVudHJ5LmlkLCB7IGNhcmRFbDogY2FyZCwgdGltZXJFbCwgcGxheVN0b3BCdG4sIHJlc2V0QnRuIH0pO1xuICAgIH1cblxuICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRFbGFwc2VkKGVudHJ5OiBUaW1lckVudHJ5KTogbnVtYmVyIHtcbiAgICBpZiAoIWVudHJ5LnJ1bm5pbmcgfHwgZW50cnkuc3RhcnRlZEF0ID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gZW50cnkuZWxhcHNlZE1zO1xuICAgIH1cblxuICAgIHJldHVybiBlbnRyeS5lbGFwc2VkTXMgKyAoRGF0ZS5ub3coKSAtIGVudHJ5LnN0YXJ0ZWRBdCk7XG4gIH1cblxuICBwcml2YXRlIHN0YXJ0VGltZXIoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICBpZiAoIWVudHJ5IHx8IGVudHJ5LnJ1bm5pbmcpIHJldHVybjtcblxuICAgIGVudHJ5LnJ1bm5pbmcgPSB0cnVlO1xuICAgIGVudHJ5LnN0YXJ0ZWRBdCA9IERhdGUubm93KCk7XG4gICAgdGhpcy51cGRhdGVUaW1lckRpc3BsYXlzKCk7XG4gIH1cblxuICBwcml2YXRlIHBhdXNlVGltZXIoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy50aW1lcnMuZ2V0KGlkKTtcbiAgICBpZiAoIWVudHJ5IHx8ICFlbnRyeS5ydW5uaW5nKSByZXR1cm47XG5cbiAgICBlbnRyeS5lbGFwc2VkTXMgPSB0aGlzLmdldEVsYXBzZWQoZW50cnkpO1xuICAgIGVudHJ5LnJ1bm5pbmcgPSBmYWxzZTtcbiAgICBlbnRyeS5zdGFydGVkQXQgPSBudWxsO1xuICAgIHRoaXMudXBkYXRlVGltZXJEaXNwbGF5cygpO1xuICB9XG5cbiAgcHJpdmF0ZSByZXNldFRpbWVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMudGltZXJzLmdldChpZCk7XG4gICAgaWYgKCFlbnRyeSkgcmV0dXJuO1xuXG4gICAgZW50cnkuZWxhcHNlZE1zID0gMDtcbiAgICBlbnRyeS5ydW5uaW5nID0gZmFsc2U7XG4gICAgZW50cnkuc3RhcnRlZEF0ID0gbnVsbDtcbiAgICB0aGlzLnVwZGF0ZVRpbWVyRGlzcGxheXMoKTtcbiAgfVxuXG4gIHByaXZhdGUgZGVsZXRlVGltZXIoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuZGVsZXRlZFRpbWVySWRzLmFkZChpZCk7XG4gICAgdGhpcy50aW1lcnMuZGVsZXRlKGlkKTtcbiAgICB0aGlzLmN1cnJlbnRIZWFkaW5nSWRzID0gdGhpcy5jdXJyZW50SGVhZGluZ0lkcy5maWx0ZXIoKGhlYWRpbmdJZCkgPT4gaGVhZGluZ0lkICE9PSBpZCk7XG4gICAgdm9pZCB0aGlzLnJlbmRlckxpc3QoKTtcbiAgfVxuXG4gIHByaXZhdGUgZGVsZXRlQWxsVGltZXJzKCk6IHZvaWQge1xuICAgIHRoaXMudGltZXJzLmNsZWFyKCk7XG4gICAgdGhpcy5kZWxldGVkVGltZXJJZHMuY2xlYXIoKTtcbiAgICB2b2lkIHRoaXMucmVmcmVzaEZyb21BY3RpdmVGaWxlKCk7XG4gIH1cblxuICBwcml2YXRlIGNvbmZpcm1BY3Rpb24obWVzc2FnZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHdpbmRvdy5jb25maXJtKG1lc3NhZ2UpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVUaW1lckRpc3BsYXlzKCk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgaWQgb2YgdGhpcy5jdXJyZW50SGVhZGluZ0lkcykge1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLnRpbWVycy5nZXQoaWQpO1xuICAgICAgY29uc3QgdWkgPSB0aGlzLnRpbWVyVWlSZWZzLmdldChpZCk7XG4gICAgICBpZiAoIWVudHJ5IHx8ICF1aSkgY29udGludWU7XG5cbiAgICAgIHVpLnRpbWVyRWwuc2V0VGV4dChmb3JtYXREdXJhdGlvbih0aGlzLmdldEVsYXBzZWQoZW50cnkpKSk7XG4gICAgICB1aS5wbGF5U3RvcEJ0bi5zZXRUZXh0KGVudHJ5LnJ1bm5pbmcgPyBVSV9URVhULnBhdXNlIDogVUlfVEVYVC5vcGVuKTtcbiAgICAgIHVpLnBsYXlTdG9wQnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIGVudHJ5LnJ1bm5pbmcgPyBcIlBhdXNlIHRpbWVyXCIgOiBcIlN0YXJ0IHRpbWVyXCIpO1xuICAgICAgdWkucGxheVN0b3BCdG4uc2V0QXR0cihcInRpdGxlXCIsIGVudHJ5LnJ1bm5pbmcgPyBcIlBhdXNlIHRpbWVyXCIgOiBcIlN0YXJ0IHRpbWVyXCIpO1xuXG4gICAgICBjb25zdCBlbGFwc2VkID0gdGhpcy5nZXRFbGFwc2VkKGVudHJ5KTtcbiAgICAgIHVpLmNhcmRFbC5yZW1vdmVDbGFzcyhcImp3LXRpbWVyLWNhcmQtLXJ1bm5pbmdcIiwgXCJqdy10aW1lci1jYXJkLS1zdG9wcGVkXCIpO1xuICAgICAgaWYgKGVudHJ5LnJ1bm5pbmcpIHtcbiAgICAgICAgdWkuY2FyZEVsLmFkZENsYXNzKFwianctdGltZXItY2FyZC0tcnVubmluZ1wiKTtcbiAgICAgIH0gZWxzZSBpZiAoZWxhcHNlZCA+IDApIHtcbiAgICAgICAgdWkuY2FyZEVsLmFkZENsYXNzKFwianctdGltZXItY2FyZC0tc3RvcHBlZFwiKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlbmRlclRpdGxlQ29udGVudCh0aXRsZUVsOiBIVE1MRWxlbWVudCwgcmF3VGl0bGU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJlbmRlcmVkRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIGF3YWl0IE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKHRoaXMuYXBwLCByYXdUaXRsZSwgcmVuZGVyZWRFbCwgdGhpcy5jdXJyZW50RmlsZVBhdGggPz8gXCJcIiwgdGhpcyk7XG4gICAgdGhpcy5yZXN0b3JlSW5saW5lSHRtbEF0dHJpYnV0ZXMocmVuZGVyZWRFbCwgcmF3VGl0bGUpO1xuXG4gICAgY29uc3QgcGxhaW4gPSAocmVuZGVyZWRFbC50ZXh0Q29udGVudCA/PyBcIlwiKS5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gICAgaWYgKHBsYWluLmxlbmd0aCA+IFRpbWVyU2lkZWJhclZpZXcuVElUTEVfTUFYX0xFTkdUSCkge1xuICAgICAgdGhpcy50cnVuY2F0ZVJlbmRlcmVkQ29udGVudChyZW5kZXJlZEVsLCBUaW1lclNpZGViYXJWaWV3LlRJVExFX01BWF9MRU5HVEgpO1xuICAgICAgdGl0bGVFbC5zZXRBdHRyKFwidGl0bGVcIiwgcGxhaW4pO1xuICAgICAgdGl0bGVFbC5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBwbGFpbik7XG4gICAgfVxuXG4gICAgdGl0bGVFbC5lbXB0eSgpO1xuICAgIHdoaWxlIChyZW5kZXJlZEVsLmZpcnN0Q2hpbGQpIHtcbiAgICAgIHRpdGxlRWwuYXBwZW5kQ2hpbGQocmVuZGVyZWRFbC5maXJzdENoaWxkKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHJlc3RvcmVJbmxpbmVIdG1sQXR0cmlidXRlcyhjb250YWluZXJFbDogSFRNTEVsZW1lbnQsIHJhd1RpdGxlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBwYXJzZWRSb290ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBwYXJzZWRSb290LmlubmVySFRNTCA9IHJhd1RpdGxlO1xuXG4gICAgY29uc3Qgc291cmNlRWxlbWVudHMgPSBBcnJheS5mcm9tKHBhcnNlZFJvb3QucXVlcnlTZWxlY3RvckFsbChcIipcIikpLmZpbHRlcigoZWxlbWVudCkgPT4ge1xuICAgICAgY29uc3QgYXR0cmlidXRlTmFtZXMgPSBlbGVtZW50LmdldEF0dHJpYnV0ZU5hbWVzKCk7XG4gICAgICByZXR1cm4gYXR0cmlidXRlTmFtZXMubGVuZ3RoID4gMDtcbiAgICB9KTtcbiAgICB0aGlzLmFwcGx5TWF0Y2hpbmdBdHRyaWJ1dGVzKHNvdXJjZUVsZW1lbnRzLCBjb250YWluZXJFbCk7XG4gIH1cblxuICBwcml2YXRlIGFwcGx5TWF0Y2hpbmdBdHRyaWJ1dGVzKHNvdXJjZUVsZW1lbnRzOiBFbGVtZW50W10sIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGNvbnN0IHVzZWRUYXJnZXRzID0gbmV3IFNldDxFbGVtZW50PigpO1xuXG4gICAgZm9yIChjb25zdCBzb3VyY2VFbCBvZiBzb3VyY2VFbGVtZW50cykge1xuICAgICAgY29uc3Qgc291cmNlVGV4dCA9IHNvdXJjZUVsLnRleHRDb250ZW50Py5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gICAgICBpZiAoIXNvdXJjZVRleHQpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBjYW5kaWRhdGVUYXJnZXRzID0gQXJyYXkuZnJvbShjb250YWluZXJFbC5xdWVyeVNlbGVjdG9yQWxsKHNvdXJjZUVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKSkpO1xuICAgICAgY29uc3QgdGFyZ2V0RWwgPSBjYW5kaWRhdGVUYXJnZXRzLmZpbmQoKGNhbmRpZGF0ZSkgPT4ge1xuICAgICAgICBpZiAodXNlZFRhcmdldHMuaGFzKGNhbmRpZGF0ZSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjYW5kaWRhdGVUZXh0ID0gY2FuZGlkYXRlLnRleHRDb250ZW50Py5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gICAgICAgIHJldHVybiBjYW5kaWRhdGVUZXh0ID09PSBzb3VyY2VUZXh0O1xuICAgICAgfSk7XG5cbiAgICAgIGlmICghdGFyZ2V0RWwpIGNvbnRpbnVlO1xuXG4gICAgICB1c2VkVGFyZ2V0cy5hZGQodGFyZ2V0RWwpO1xuICAgICAgZm9yIChjb25zdCBhdHRyIG9mIHNvdXJjZUVsLmdldEF0dHJpYnV0ZU5hbWVzKCkpIHtcbiAgICAgICAgdGFyZ2V0RWwuc2V0QXR0cmlidXRlKGF0dHIsIHNvdXJjZUVsLmdldEF0dHJpYnV0ZShhdHRyKSA/PyBcIlwiKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHRydW5jYXRlUmVuZGVyZWRDb250ZW50KGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCwgbWF4TGVuZ3RoOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCB3YWxrZXIgPSBkb2N1bWVudC5jcmVhdGVUcmVlV2Fsa2VyKGNvbnRhaW5lckVsLCBOb2RlRmlsdGVyLlNIT1dfVEVYVCk7XG4gICAgY29uc3QgdGV4dE5vZGVzOiBUZXh0W10gPSBbXTtcblxuICAgIHdoaWxlICh3YWxrZXIubmV4dE5vZGUoKSkge1xuICAgICAgdGV4dE5vZGVzLnB1c2god2Fsa2VyLmN1cnJlbnROb2RlIGFzIFRleHQpO1xuICAgIH1cblxuICAgIGxldCB1c2VkTGVuZ3RoID0gMDtcbiAgICBsZXQgcmVhY2hlZExpbWl0ID0gZmFsc2U7XG5cbiAgICBmb3IgKGNvbnN0IHRleHROb2RlIG9mIHRleHROb2Rlcykge1xuICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IHRleHROb2RlLnRleHRDb250ZW50Py5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKSA/PyBcIlwiO1xuICAgICAgaWYgKCFub3JtYWxpemVkLnRyaW0oKSkge1xuICAgICAgICBpZiAocmVhY2hlZExpbWl0KSB7XG4gICAgICAgICAgdGV4dE5vZGUudGV4dENvbnRlbnQgPSBcIlwiO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVhY2hlZExpbWl0KSB7XG4gICAgICAgIHRleHROb2RlLnRleHRDb250ZW50ID0gXCJcIjtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlbWFpbmluZyA9IG1heExlbmd0aCAtIHVzZWRMZW5ndGg7XG4gICAgICBpZiAobm9ybWFsaXplZC5sZW5ndGggPD0gcmVtYWluaW5nKSB7XG4gICAgICAgIHVzZWRMZW5ndGggKz0gbm9ybWFsaXplZC5sZW5ndGg7XG4gICAgICAgIHRleHROb2RlLnRleHRDb250ZW50ID0gbm9ybWFsaXplZDtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNsaWNlTGVuZ3RoID0gTWF0aC5tYXgoMCwgcmVtYWluaW5nIC0gMyk7XG4gICAgICBjb25zdCB0cnVuY2F0ZWRUZXh0ID0gYCR7bm9ybWFsaXplZC5zbGljZSgwLCBzbGljZUxlbmd0aCkudHJpbUVuZCgpfS4uLmA7XG4gICAgICB0ZXh0Tm9kZS50ZXh0Q29udGVudCA9IHRydW5jYXRlZFRleHQ7XG4gICAgICByZWFjaGVkTGltaXQgPSB0cnVlO1xuICAgICAgdXNlZExlbmd0aCA9IG1heExlbmd0aDtcbiAgICB9XG5cbiAgICB0aGlzLnJlbW92ZUVtcHR5Tm9kZXMoY29udGFpbmVyRWwpO1xuICB9XG5cbiAgcHJpdmF0ZSByZW1vdmVFbXB0eU5vZGVzKHJvb3RFbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb25zdCBjaGlsZE5vZGVzID0gQXJyYXkuZnJvbShyb290RWwuY2hpbGROb2Rlcyk7XG5cbiAgICBmb3IgKGNvbnN0IGNoaWxkTm9kZSBvZiBjaGlsZE5vZGVzKSB7XG4gICAgICBpZiAoY2hpbGROb2RlLm5vZGVUeXBlID09PSBOb2RlLlRFWFRfTk9ERSkge1xuICAgICAgICBpZiAoIShjaGlsZE5vZGUudGV4dENvbnRlbnQgPz8gXCJcIikudHJpbSgpKSB7XG4gICAgICAgICAgY2hpbGROb2RlLnJlbW92ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2hpbGROb2RlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVFbXB0eU5vZGVzKGNoaWxkTm9kZSk7XG4gICAgICAgIGNvbnN0IGhhc01lYW5pbmdmdWxUZXh0ID0gKGNoaWxkTm9kZS50ZXh0Q29udGVudCA/PyBcIlwiKS50cmltKCkubGVuZ3RoID4gMDtcbiAgICAgICAgY29uc3QgaGFzRWxlbWVudENoaWxkcmVuID0gY2hpbGROb2RlLmNoaWxkcmVuLmxlbmd0aCA+IDA7XG4gICAgICAgIGlmICghaGFzTWVhbmluZ2Z1bFRleHQgJiYgIWhhc0VsZW1lbnRDaGlsZHJlbikge1xuICAgICAgICAgIGNoaWxkTm9kZS5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUaW1lclNpZGViYXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5yZWdpc3RlclZpZXcoVklFV19UWVBFX1RJTUVSX1NJREVCQVIsIChsZWFmKSA9PiBuZXcgVGltZXJTaWRlYmFyVmlldyhsZWFmLCB0aGlzKSk7XG5cbiAgICB0aGlzLmFkZFJpYmJvbkljb24oXCJ0aW1lclwiLCBcIk9wZW4gSlcgVGltZXIgc2lkZWJhclwiLCAoKSA9PiB7XG4gICAgICB2b2lkIHRoaXMuYWN0aXZhdGVWaWV3KCk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwib3Blbi1qdy10aW1lci1zaWRlYmFyXCIsXG4gICAgICBuYW1lOiBcIk9wZW4gSlcgVGltZXIgc2lkZWJhclwiLFxuICAgICAgY2FsbGJhY2s6IGFzeW5jICgpID0+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIHZvaWQgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcbiAgICB9KTtcbiAgfVxuXG4gIG9udW5sb2FkKCk6IHZvaWQge1xuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5kZXRhY2hMZWF2ZXNPZlR5cGUoVklFV19UWVBFX1RJTUVSX1NJREVCQVIpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBhY3RpdmF0ZVZpZXcoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZXhpc3RpbmdMZWF2ZXMgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9USU1FUl9TSURFQkFSKTtcbiAgICBpZiAoZXhpc3RpbmdMZWF2ZXMubGVuZ3RoID4gMCkge1xuICAgICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYoZXhpc3RpbmdMZWF2ZXNbMF0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKTtcbiAgICBpZiAoIWxlYWYpIHJldHVybjtcblxuICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHtcbiAgICAgIHR5cGU6IFZJRVdfVFlQRV9USU1FUl9TSURFQkFSLFxuICAgICAgYWN0aXZlOiB0cnVlXG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBT087QUFFUCxJQUFNLDBCQUEwQjtBQUNoQyxJQUFNLFVBQVU7QUFBQSxFQUNkLE9BQU87QUFBQSxFQUNQLE9BQU87QUFBQSxFQUNQLE1BQU07QUFBQSxFQUNOLE9BQU87QUFBQSxFQUNQLE9BQU87QUFBQSxFQUNQLFFBQVE7QUFBQSxFQUNSLFVBQVU7QUFDWjtBQWlCQSxTQUFTLGFBQWEsVUFBa0IsU0FBK0I7QUFDckUsUUFBTSxPQUFPLFFBQVEsVUFBVSxNQUFNLFFBQVE7QUFDN0MsU0FBTyxHQUFHLFFBQVEsS0FBSyxJQUFJLEtBQUssUUFBUSxPQUFPO0FBQ2pEO0FBRUEsU0FBUyxlQUFlLElBQW9CO0FBQzFDLFFBQU0sZUFBZSxLQUFLLElBQUksR0FBRyxLQUFLLE1BQU0sS0FBSyxHQUFJLENBQUM7QUFDdEQsUUFBTSxRQUFRLEtBQUssTUFBTSxlQUFlLElBQUk7QUFDNUMsUUFBTSxVQUFVLEtBQUssTUFBTyxlQUFlLE9BQVEsRUFBRTtB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
