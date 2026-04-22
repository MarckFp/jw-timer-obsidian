import { ItemView, WorkspaceLeaf } from "obsidian";
import type JwTimerPlugin from "./main";
import type { WeeklySchedule, MeetingPart } from "./types";
import type { TimerSnapshot } from "./timer-engine";
import { cacheKey, currentWeekNumber, fetchWeekSchedule } from "./scraper";

export const VIEW_TYPE_JW_TIMER = "jw-timer-sidebar";

// ─── Colour thresholds ────────────────────────────────────────────────────────
// green  = elapsed < 90% of allowed
// orange = elapsed >= 90% and <= 100%
// red    = elapsed > 100%
const WARN_THRESHOLD = 0.9;

function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Parse "HH:MM" into minutes from midnight */
function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

/** Format minutes-from-midnight as "HH:MM" */
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type TimerColorState = "idle" | "ok" | "warn" | "over";

function colorState(elapsedMs: number, durationSec: number, status: TimerSnapshot["status"]): TimerColorState {
  if (status === "idle") return "idle";
  const ratio = elapsedMs / (durationSec * 1000);
  if (ratio > 1) return "over";
  if (ratio >= WARN_THRESHOLD) return "warn";
  return "ok";
}

interface CardRefs {
  cardEl: HTMLElement;
  elapsedEl: HTMLElement;
  deltaEl: HTMLElement;
  playBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  barFillEl: HTMLElement;
}

// ─── Section labels ───────────────────────────────────────────────────────────
const SECTION_LABELS: Record<string, string> = {
  opening:   "Opening",
  treasures: "Treasures from God's Word",
  ministry:  "Apply Yourself to the Ministry",
  living:    "Living as Christians",
  closing:   "Closing",
};

export class JwTimerView extends ItemView {
  private schedule: WeeklySchedule | null = null;
  private weekKey = "";
  private cards = new Map<number, CardRefs>();
  private tickHandle: number | null = null;
  private statusEl!: HTMLElement;
  private listEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: JwTimerPlugin) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_JW_TIMER; }
  getDisplayText(): string { return "JW Meeting Timer"; }
  getIcon(): string { return "timer"; }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass("jw-timer-root");

    this.statusEl = root.createDiv({ cls: "jw-timer-status" });
    this.listEl = root.createDiv({ cls: "jw-timer-list" });

    this.tickHandle = window.setInterval(() => this.tick(), 250);

    await this.loadSchedule();
  }

  async onClose(): Promise<void> {
    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    await this.plugin.persistTimers();
  }

  // ─── Public: called by plugin when settings change ──────────────────────────

  async reload(): Promise<void> {
    this.schedule = null;
    this.cards.clear();
    this.listEl.empty();
    await this.loadSchedule();
  }

  // ─── Schedule loading ────────────────────────────────────────────────────────

  private async loadSchedule(): Promise<void> {
    const year = new Date().getFullYear();
    const week = currentWeekNumber();
    this.weekKey = cacheKey(year, week);

    // Try cache first
    let schedule = this.plugin.getCachedSchedule(this.weekKey);

    if (!schedule) {
      this.setStatus("loading", "Fetching meeting schedule from wol.jw.org…");
      schedule = await fetchWeekSchedule(this.plugin.settings.wolLocale, year, week);
      if (schedule) {
        this.plugin.cacheSchedule(this.weekKey, schedule);
        await this.plugin.saveSettings();
      }
    }

    if (!schedule) {
      this.setStatus("error", "Could not load schedule. Check your connection and language setting.");
      return;
    }

    this.schedule = schedule;
    this.setStatus("ok", `${schedule.weekLabel}`);
    this.renderSchedule(schedule);
  }

  private setStatus(type: "ok" | "loading" | "error", text: string): void {
    this.statusEl.empty();
    this.statusEl.className = `jw-timer-status jw-timer-status--${type}`;
    this.statusEl.setText(text);
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  private renderSchedule(schedule: WeeklySchedule): void {
    this.listEl.empty();
    this.cards.clear();

    // Compute scheduled start-of-part times
    const startMinutes = timeToMinutes(this.plugin.settings.meetingStartTime);
    // Add opening song offset (song+prayer before first programme item)
    let cursor = startMinutes + this.plugin.settings.openingSongMinutes;

    // Build offset map: partOrder → scheduled start (minutes from midnight)
    const scheduledStart = new Map<number, number>();
    for (const part of schedule.parts) {
      scheduledStart.set(part.order, cursor);
      cursor += Math.ceil(part.durationSec / 60);
    }

    // Group parts by section
    const sections = new Map<string, MeetingPart[]>();
    for (const part of schedule.parts) {
      const list = sections.get(part.section) ?? [];
      list.push(part);
      sections.set(part.section, list);
    }

    const sectionOrder: string[] = ["opening", "treasures", "ministry", "living", "closing"];
    for (const sectionKey of sectionOrder) {
      const parts = sections.get(sectionKey);
      if (!parts?.length) continue;

      const sectionEl = this.listEl.createDiv({ cls: "jw-timer-section" });
      sectionEl.createEl("h3", {
        cls: "jw-timer-section-title",
        text: SECTION_LABELS[sectionKey] ?? sectionKey,
      });

      for (const part of parts) {
        if (part.isSeparator) continue; // counts for scheduling but no stopwatch card
        this.renderCard(sectionEl, part, scheduledStart.get(part.order) ?? startMinutes);
      }
    }
  }

  private renderCard(
    parentEl: HTMLElement,
    part: MeetingPart,
    scheduledStartMins: number
  ): void {
    const card = parentEl.createDiv({ cls: "jw-timer-card" });

    // Title row
    const titleRow = card.createDiv({ cls: "jw-timer-card-header" });
    titleRow.createDiv({ cls: "jw-timer-card-title", text: part.label });
    titleRow.createDiv({
      cls: "jw-timer-card-allotted",
      text: `${Math.round(part.durationSec / 60)} min`,
    });

    // Scheduled start time
    card.createDiv({
      cls: "jw-timer-card-start-time",
      text: `Starts ≈ ${minutesToTime(scheduledStartMins)}`,
    });

    // Progress bar
    const barEl = card.createDiv({ cls: "jw-timer-bar" });
    const barFillEl = barEl.createDiv({ cls: "jw-timer-bar-fill" });

    // Clock row
    const clockRow = card.createDiv({ cls: "jw-timer-clock-row" });
    const elapsedEl = clockRow.createDiv({ cls: "jw-timer-elapsed", text: "00:00" });
    const deltaEl = clockRow.createDiv({ cls: "jw-timer-delta" });

    // Controls
    const controls = card.createDiv({ cls: "jw-timer-controls" });

    const playBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-play", text: "▶" });
    playBtn.setAttr("aria-label", "Start timer");

    const resetBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-reset", text: "↺" });
    resetBtn.setAttr("aria-label", "Reset timer");

    // Wire events
    playBtn.addEventListener("click", () => this.handlePlayPause(part));
    resetBtn.addEventListener("click", () => this.handleReset(part));

    this.cards.set(part.order, { cardEl: card, elapsedEl, deltaEl, playBtn, resetBtn, barFillEl });
    this.updateCard(part, scheduledStartMins);
  }

  // ─── Timer controls ────────────────────────────────────────────────────────

  private handlePlayPause(part: MeetingPart): void {
    const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
    if (snap.status === "running") {
      this.plugin.timerEngine.pause(this.weekKey, part.order);
    } else {
      this.plugin.timerEngine.start(this.weekKey, part.order);
    }
    this.updateCardByOrder(part);
  }

  private handleReset(part: MeetingPart): void {
    this.plugin.timerEngine.reset(this.weekKey, part.order);
    this.updateCardByOrder(part);
  }

  // ─── Tick & display update ─────────────────────────────────────────────────

  private tick(): void {
    if (!this.schedule) return;
    for (const part of this.schedule.parts) {
      const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
      if (snap.status === "running") {
        this.updateCardByOrder(part);
      }
    }
  }

  private updateCardByOrder(part: MeetingPart): void {
    const startMinutes = timeToMinutes(this.plugin.settings.meetingStartTime);
    let cursor = startMinutes + this.plugin.settings.openingSongMinutes;
    let scheduledStart = cursor;
    for (const p of (this.schedule?.parts ?? [])) {
      if (p.order === part.order) { scheduledStart = cursor; break; }
      cursor += Math.ceil(p.durationSec / 60);
    }
    this.updateCard(part, scheduledStart);
  }

  private updateCard(part: MeetingPart, scheduledStartMins: number): void {
    const refs = this.cards.get(part.order);
    if (!refs) return;

    const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
    const { elapsedMs, status } = snap;
    const durationMs = part.durationSec * 1000;

    // Elapsed display
    refs.elapsedEl.setText(formatMmSs(elapsedMs));

    // Progress bar
    const pct = Math.min(1, elapsedMs / durationMs);
    refs.barFillEl.style.width = `${(pct * 100).toFixed(1)}%`;

    // Delta vs allowed
    const remainingMs = durationMs - elapsedMs;
    if (status === "idle") {
      refs.deltaEl.setText(`${Math.round(part.durationSec / 60)} min allotted`);
      refs.deltaEl.className = "jw-timer-delta jw-timer-delta--neutral";
    } else if (remainingMs >= 0) {
      refs.deltaEl.setText(`−${formatMmSs(remainingMs)} left`);
      refs.deltaEl.className = "jw-timer-delta jw-timer-delta--ok";
    } else {
      refs.deltaEl.setText(`+${formatMmSs(-remainingMs)} over`);
      refs.deltaEl.className = "jw-timer-delta jw-timer-delta--over";
    }

    // Card colour state
    const state = colorState(elapsedMs, part.durationSec, status);
    refs.cardEl.setAttribute("data-state", state);

    // Play button label
    if (status === "running") {
      refs.playBtn.setText("⏸");
      refs.playBtn.setAttr("aria-label", "Pause timer");
    } else {
      refs.playBtn.setText("▶");
      refs.playBtn.setAttr("aria-label", status === "paused" ? "Resume timer" : "Start timer");
    }
  }
}
