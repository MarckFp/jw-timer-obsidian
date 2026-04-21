import {
  App,
  ItemView,
  MarkdownRenderer,
  Plugin,
  WorkspaceLeaf,
  HeadingCache
} from "obsidian";

const VIEW_TYPE_TIMER_SIDEBAR = "jw-timer-sidebar-view";

interface TimerEntry {
  id: string;
  title: string;
  elapsedMs: number;
  running: boolean;
  startedAt: number | null;
}

interface TimerUiRef {
  timerEl: HTMLElement;
  playStopBtn: HTMLButtonElement;
  pauseBtn: HTMLButtonElement;
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
  private timerUiRefs = new Map<string, TimerUiRef>();
  private currentHeadingIds: string[] = [];
  private currentFilePath: string | null = null;

  private listEl!: HTMLElement;
  private emptyStateEl!: HTMLElement;
  private tickHandle: number | null = null;

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

  async onClose(): Promise<void> {
    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
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

    const nextHeadingIds: string[] = [];

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
      await MarkdownRenderer.render(this.app, entry.title, titleEl, this.currentFilePath ?? "", this);

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
    this.updateTimerDisplays();
  }

  private pauseTimer(id: string): void {
    const entry = this.timers.get(id);
    if (!entry || !entry.running) return;

    entry.elapsedMs = this.getElapsed(entry);
    entry.running = false;
    entry.startedAt = null;
    this.updateTimerDisplays();
  }

  private stopTimer(id: string): void {
    const entry = this.timers.get(id);
    if (!entry) return;

    entry.elapsedMs = 0;
    entry.running = false;
    entry.startedAt = null;
    this.updateTimerDisplays();
  }

  private deleteTimer(id: string): void {
    this.timers.delete(id);
    this.currentHeadingIds = this.currentHeadingIds.filter((headingId) => headingId !== id);
    void this.renderList();
  }

  private deleteAllTimers(): void {
    this.timers.clear();
    void this.refreshFromActiveFile();
  }

  private updateTimerDisplays(): void {
    for (const id of this.currentHeadingIds) {
      const entry = this.timers.get(id);
      const ui = this.timerUiRefs.get(id);
      if (!entry || !ui) continue;

      ui.timerEl.setText(formatDuration(this.getElapsed(entry)));
      ui.playStopBtn.setText(entry.running ? "Stop" : "Play");
      ui.pauseBtn.disabled = !entry.running;
    }
  }
}

export default class TimerSidebarPlugin extends Plugin {
  async onload(): Promise<void> {
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

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_TIMER_SIDEBAR);
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
