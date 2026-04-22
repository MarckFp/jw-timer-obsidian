import {
  App,
  ItemView,
  MarkdownRenderer,
  Modal,
  Plugin,
  Setting,
  WorkspaceLeaf,
  HeadingCache
} from "obsidian";

const VIEW_TYPE_TIMER_SIDEBAR = "jw-timer-sidebar-view";
const STORAGE_VERSION = 1;
const TIMER_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const UI_TEXT = {
  title: "⏱️",
  empty: "∅",
  open: "▶️",
  pause: "⏸️",
  target: "🎯",
  reset: "🔄",
  delete: "🗑️",
  resetAll: "♻️"
} as const;

interface TimerEntry {
  id: string;
  title: string;
  elapsedMs: number;
  targetMs: number | null;
  running: boolean;
  startedAt: number | null;
}

interface TimerUiRef {
  cardEl: HTMLElement;
  timerEl: HTMLElement;
  playStopBtn: HTMLButtonElement;
  targetBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
}

interface StoredTimerState {
  title: string;
  elapsedMs: number;
  targetMs: number | null;
  deleted: boolean;
  updatedAt: number;
}

interface TimerStorageData {
  version: number;
  timers: Record<string, StoredTimerState>;
}

function buildTimerId(filePath: string, heading: HeadingCache): string {
  const line = heading.position?.start.line ?? 0;
  return `${filePath}::${line}::${heading.heading}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

class TimerSidebarView extends ItemView {
  private timers = new Map<string, TimerEntry>();
  private deletedTimerIds = new Set<string>();
  private timerUiRefs = new Map<string, TimerUiRef>();
  private currentHeadingIds: string[] = [];
  private currentFilePath: string | null = null;

  private listEl!: HTMLElement;
  private emptyStateEl!: HTMLElement;
  private tickHandle: number | null = null;
  private persistHandle: number | null = null;
  private static readonly TITLE_MAX_LENGTH = 60;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: TimerSidebarPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_TIMER_SIDEBAR;
  }

  getDisplayText(): string {
    return "JW Timers";
  }

  getIcon(): string {
    return "timer";
  }

  async onOpen(): Promise<void> {
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
    }, 5000);

    void this.refreshFromActiveFile();
  }

  async onClose(): Promise<void> {
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

  private async refreshFromActiveFile(): Promise<void> {
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

    const nextHeadingIds: string[] = [];
    const allHeadingIds = new Set<string>();

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
        if (existing.targetMs === null && stored?.targetMs !== undefined) {
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

  private extractRawHeadingTitles(content: string, headings: HeadingCache[]): Map<number, string> {
    const lines = content.split(/\r?\n/);
    const titlesByLine = new Map<number, string>();

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

  private async renderList(): Promise<void> {
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

  private getElapsed(entry: TimerEntry): number {
    if (!entry.running || entry.startedAt === null) {
      return entry.elapsedMs;
    }

    return entry.elapsedMs + (Date.now() - entry.startedAt);
  }

  private startTimer(id: string): void {
    const entry = this.timers.get(id);
    if (!entry || entry.running) return;

    entry.running = true;
    entry.startedAt = Date.now();
    this.persistTimer(entry);
    this.updateTimerDisplays();
  }

  private pauseTimer(id: string): void {
    const entry = this.timers.get(id);
    if (!entry || !entry.running) return;

    entry.elapsedMs = this.getElapsed(entry);
    entry.running = false;
    entry.startedAt = null;
    this.persistTimer(entry);
    this.updateTimerDisplays();
  }

  private resetTimer(id: string): void {
    const entry = this.timers.get(id);
    if (!entry) return;

    entry.elapsedMs = 0;
    entry.running = false;
    entry.startedAt = null;
    this.persistTimer(entry);
    this.updateTimerDisplays();
  }

  private configureTargetTime(id: string): void {
    const entry = this.timers.get(id);
    if (!entry) return;

    new TargetTimeModal(this.app, entry.targetMs, (newTargetMs) => {
      entry.targetMs = newTargetMs;
      this.persistTimer(entry);
      this.updateTimerDisplays();
    }).open();
  }

  private deleteTimer(id: string): void {
    const entry = this.timers.get(id);
    this.deletedTimerIds.add(id);
    this.timers.delete(id);
    void this.plugin.markTimerDeleted(id, entry?.title ?? "", entry?.targetMs ?? null, entry?.elapsedMs ?? 0);
    this.currentHeadingIds = this.currentHeadingIds.filter((headingId) => headingId !== id);
    void this.renderList();
  }

  private deleteAllTimers(): void {
    const filePath = this.currentFilePath;
    this.timers.clear();
    this.deletedTimerIds.clear();
    if (filePath) {
      void this.plugin.clearFileTimers(filePath);
    }
    void this.refreshFromActiveFile();
  }

  private confirmAction(message: string): boolean {
    return window.confirm(message);
  }
}

class TargetTimeModal extends Modal {
  private inputValue: string;

  constructor(
    app: App,
    private readonly currentTargetMs: number | null,
    private readonly onSubmit: (targetMs: number | null) => void
  ) {
    super(app);
    this.inputValue = currentTargetMs === null ? "" : (currentTargetMs / 60000).toString();
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Set target time" });

    new Setting(contentEl)
      .setName("Target (minutes)")
      .setDesc("Leave empty to remove the target. Decimals allowed (e.g. 1.5 = 1 min 30 s).")
      .addText((text) => {
        text.setValue(this.inputValue);
        text.inputEl.setAttribute("type", "number");
        text.inputEl.setAttribute("min", "0");
        text.inputEl.setAttribute("step", "0.5");
        text.inputEl.style.width = "6rem";
        text.onChange((value) => {
          this.inputValue = value;
        });
        // Submit on Enter
        text.inputEl.addEventListener("keydown", (evt) => {
          if (evt.key === "Enter") {
            this.submit();
          }
        });
        // Auto-focus
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

  private submit(): void {
    const normalized = this.inputValue.trim().replace(",", ".");
    if (!normalized) {
      this.onSubmit(null);
      this.close();
      return;
    }
    const minutes = Number(normalized);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      const errorEl = this.contentEl.querySelector(".jw-target-error") as HTMLElement | null ?? (() => {
        const el = this.contentEl.createEl("p", { cls: "jw-target-error" });
        el.style.color = "var(--color-red)";
        return el;
      })();
      errorEl.setText("Enter a positive number of minutes.");
      return;
    }
    this.onSubmit(Math.round(minutes * 60 * 1000));
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private updateTimerDisplays(): void {
    for (const id of this.currentHeadingIds) {
      const entry = this.timers.get(id);
      const ui = this.timerUiRefs.get(id);
      if (!entry || !ui) continue;

      ui.timerEl.setText(formatDuration(this.getElapsed(entry)));
      ui.playStopBtn.setText(entry.running ? UI_TEXT.pause : UI_TEXT.open);
      ui.playStopBtn.setAttr("aria-label", entry.running ? "Pause timer" : "Start timer");
      ui.playStopBtn.setAttr("title", entry.running ? "Pause timer" : "Start timer");

      const targetMinutes = entry.targetMs === null ? "" : (entry.targetMs / 60000).toFixed(1).replace(/\.0$/, "");
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

  private persistTimer(entry: TimerEntry): void {
    const elapsed = this.getElapsed(entry);
    void this.plugin.upsertStoredTimer(entry.id, {
      title: entry.title,
      elapsedMs: elapsed,
      targetMs: entry.targetMs,
      deleted: false
    });
  }

  private async persistAllTimers(freezeRunning: boolean): Promise<void> {
    const updates: Promise<void>[] = [];

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

  private persistRunningSnapshots(): void {
    for (const entry of this.timers.values()) {
      if (entry.running) {
        this.persistTimer(entry);
      }
    }
  }

  private async renderTitleContent(titleEl: HTMLElement, rawTitle: string): Promise<void> {
    const renderedEl = document.createElement("div");
    await MarkdownRenderer.render(this.app, rawTitle, renderedEl, this.currentFilePath ?? "", this);
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

  private restoreInlineHtmlAttributes(containerEl: HTMLElement, rawTitle: string): void {
    const parsedRoot = document.createElement("div");
    parsedRoot.innerHTML = rawTitle;

    const sourceElements = Array.from(parsedRoot.querySelectorAll("*")).filter((element) => {
      const attributeNames = element.getAttributeNames();
      return attributeNames.length > 0;
    });
    this.applyMatchingAttributes(sourceElements, containerEl);
  }

  private applyMatchingAttributes(sourceElements: Element[], containerEl: HTMLElement): void {
    const usedTargets = new Set<Element>();

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

  private truncateRenderedContent(containerEl: HTMLElement, maxLength: number): void {
    const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
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

  private removeEmptyNodes(rootEl: HTMLElement): void {
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
}

export default class TimerSidebarPlugin extends Plugin {
  private storage: TimerStorageData = { version: STORAGE_VERSION, timers: {} };
  private saveHandle: number | null = null;

  async onload(): Promise<void> {
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

  onunload(): void {
    if (this.saveHandle !== null) {
      window.clearTimeout(this.saveHandle);
      this.saveHandle = null;
      void this.saveData(this.storage);
    }
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_TIMER_SIDEBAR);
  }

  getStoredTimer(id: string): StoredTimerState | undefined {
    return this.storage.timers[id];
  }

  getDeletedTimerIdsForFile(filePath: string): Set<string> {
    const deletedIds = new Set<string>();
    const prefix = `${filePath}::`;

    for (const [id, state] of Object.entries(this.storage.timers)) {
      if (id.startsWith(prefix) && state.deleted) {
        deletedIds.add(id);
      }
    }

    return deletedIds;
  }

  async upsertStoredTimer(
    id: string,
    state: { title: string; elapsedMs: number; targetMs: number | null; deleted: boolean }
  ): Promise<void> {
    this.storage.timers[id] = {
      title: state.title,
      elapsedMs: Math.max(0, Math.floor(state.elapsedMs)),
      targetMs: state.targetMs,
      deleted: state.deleted,
      updatedAt: Date.now()
    };

    this.scheduleSave();
  }

  async markTimerDeleted(id: string, title: string, targetMs: number | null, elapsedMs: number): Promise<void> {
    this.storage.timers[id] = {
      title,
      elapsedMs: Math.max(0, Math.floor(elapsedMs)),
      targetMs,
      deleted: true,
      updatedAt: Date.now()
    };

    this.scheduleSave();
  }

  async removeStoredTimer(id: string): Promise<void> {
    if (!(id in this.storage.timers)) {
      return;
    }

    delete this.storage.timers[id];
    this.scheduleSave();
  }

  async clearFileTimers(filePath: string): Promise<void> {
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

  private normalizeStorageData(raw: unknown): TimerStorageData {
    const fallback: TimerStorageData = { version: STORAGE_VERSION, timers: {} };
    if (!raw || typeof raw !== "object") {
      return fallback;
    }

    const maybeData = raw as Partial<TimerStorageData>;
    if (!maybeData.timers || typeof maybeData.timers !== "object") {
      return fallback;
    }

    const normalizedTimers: Record<string, StoredTimerState> = {};
    for (const [id, value] of Object.entries(maybeData.timers)) {
      if (!value || typeof value !== "object") {
        continue;
      }

      const timer = value as Partial<StoredTimerState>;
      normalizedTimers[id] = {
        title: typeof timer.title === "string" ? timer.title : "",
        elapsedMs: Number.isFinite(timer.elapsedMs) ? Math.max(0, Math.floor(timer.elapsedMs ?? 0)) : 0,
        targetMs:
          timer.targetMs === null || timer.targetMs === undefined
            ? null
            : Number.isFinite(timer.targetMs)
              ? Math.max(0, Math.floor(timer.targetMs))
              : null,
        deleted: Boolean(timer.deleted),
        updatedAt:
          Number.isFinite(timer.updatedAt) && (timer.updatedAt ?? 0) > 0
            ? Math.floor(timer.updatedAt as number)
            : Date.now()
      };
    }

    return {
      version: STORAGE_VERSION,
      timers: normalizedTimers
    };
  }

  private pruneOldTimers(): boolean {
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

  private scheduleSave(): void {
    if (this.pruneOldTimers()) {
      // Keep storage bounded before persisting to disk.
    }

    if (this.saveHandle !== null) {
      window.clearTimeout(this.saveHandle);
    }

    this.saveHandle = window.setTimeout(() => {
      this.saveHandle = null;
      void this.saveData(this.storage);
    }, 400);
  }

  private async activateView(): Promise<void> {
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
}
