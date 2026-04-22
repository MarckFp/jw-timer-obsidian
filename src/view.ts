import { ItemView, WorkspaceLeaf } from "obsidian";
import type JwTimerPlugin from "./main";
import type { WeeklySchedule, MeetingPart } from "./types";
import type { TimerSnapshot } from "./timer-engine";
import { cacheKey, currentWeekNumber, fetchWeekSchedule } from "./scraper";

export const VIEW_TYPE_JW_TIMER = "jw-timer-sidebar";

// ─── Constants ────────────────────────────────────────────────────────────────
const WARN_THRESHOLD = 0.9;

// Fallback section labels — used when scraper sectionLabels is absent (old cache)
const SECTION_FALLBACK: Record<string, string> = {
  opening:   "Opening",
  treasures: "Treasures from God's Word",
  ministry:  "Apply Yourself to the Ministry",
  living:    "Living as Christians",
  closing:   "Closing",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timestampToHHMM(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Number of ISO weeks in a year (52 or 53). Dec 28 is always in the last ISO week. */
function isoWeeksInYear(year: number): number {
  const d = new Date(Date.UTC(year, 11, 28));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

type TimerColorState = "idle" | "ok" | "warn" | "over";

function colorState(elapsedMs: number, durationSec: number, status: TimerSnapshot["status"]): TimerColorState {
  if (status === "idle") return "idle";
  const ratio = elapsedMs / (durationSec * 1000);
  if (ratio > 1) return "over";
  if (ratio >= WARN_THRESHOLD) return "warn";
  return "ok";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardRefs {
  cardEl: HTMLElement;
  elapsedEl: HTMLElement;
  endTimeEl: HTMLElement;
  stoppedAtEl: HTMLElement;
  playBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  barFillEl: HTMLElement;
}

// ─── View ─────────────────────────────────────────────────────────────────────

export class JwTimerView extends ItemView {
  private schedule: WeeklySchedule | null = null;
  private weekKey = "";
  private cards = new Map<number, CardRefs>();
  private tickHandle: number | null = null;
  private statusEl!: HTMLElement;
  private navLabelEl!: HTMLElement;
  private listEl!: HTMLElement;

  // Pagination state — initialised to current week in onOpen
  private viewYear: number = new Date().getFullYear();
  private viewWeek: number = currentWeekNumber();

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

    // ── Week navigation ──────────────────────────────────────────────────────
    const navEl = root.createDiv({ cls: "jw-timer-nav" });
    const prevBtn = navEl.createEl("button", { cls: "jw-timer-nav-btn", text: "◀" });
    this.navLabelEl = navEl.createDiv({ cls: "jw-timer-nav-label" });
    const nextBtn = navEl.createEl("button", { cls: "jw-timer-nav-btn", text: "▶" });
    prevBtn.addEventListener("click", () => void this.navigateWeek(-1));
    nextBtn.addEventListener("click", () => void this.navigateWeek(+1));

    // ── Status + list ────────────────────────────────────────────────────────
    this.statusEl = root.createDiv({ cls: "jw-timer-status" });
    this.listEl = root.createDiv({ cls: "jw-timer-list" });

    this.tickHandle = window.setInterval(() => this.tick(), 250);

    this.viewYear = new Date().getFullYear();
    this.viewWeek = currentWeekNumber();
    await this.loadScheduleForWeek(this.viewYear, this.viewWeek);
  }

  async onClose(): Promise<void> {
    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    await this.plugin.persistTimers();
  }

  // ─── Public: called when settings change ────────────────────────────────────

  async reload(): Promise<void> {
    this.schedule = null;
    this.cards.clear();
    this.listEl.empty();
    await this.loadScheduleForWeek(this.viewYear, this.viewWeek);
  }

  // ─── Week navigation ─────────────────────────────────────────────────────────

  private async navigateWeek(delta: number): Promise<void> {
    let w = this.viewWeek + delta;
    let y = this.viewYear;
    if (w < 1) {
      y--;
      w = isoWeeksInYear(y);
    } else if (w > isoWeeksInYear(y)) {
      y++;
      w = 1;
    }
    this.viewYear = y;
    this.viewWeek = w;
    this.schedule = null;
    this.cards.clear();
    this.listEl.empty();
    await this.loadScheduleForWeek(y, w);
  }

  // ─── Schedule loading ─────────────────────────────────────────────────────────

  private async loadScheduleForWeek(year: number, week: number): Promise<void> {
    this.weekKey = cacheKey(year, week);
    this.navLabelEl.setText(`${year} · W${String(week).padStart(2, "0")}`);

    let schedule = this.plugin.getCachedSchedule(this.weekKey);

    if (!schedule) {
      this.setStatus("loading", "Fetching schedule from wol.jw.org…");
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
    this.navLabelEl.setText(schedule.weekLabel);
    this.setStatus("ok", "");
    this.renderSchedule(schedule);
  }

  private setStatus(type: "ok" | "loading" | "error", text: string): void {
    this.statusEl.empty();
    this.statusEl.className = `jw-timer-status jw-timer-status--${type}`;
    this.statusEl.setText(text);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  private renderSchedule(schedule: WeeklySchedule): void {
    this.listEl.empty();
    this.cards.clear();

    const startMinutes = timeToMinutes(this.plugin.settings.meetingStartTime);
    let cursor = startMinutes + this.plugin.settings.openingSongMinutes;

    const scheduledStart = new Map<number, number>();
    for (const part of schedule.parts) {
      scheduledStart.set(part.order, cursor);
      cursor += Math.ceil(part.durationSec / 60);
    }

    // Merge scraped section labels (in page language) with English fallback
    const sectionLabels: Record<string, string> = {
      ...SECTION_FALLBACK,
      ...(schedule.sectionLabels ?? {}),
    };

    // Group parts by section
    const sections = new Map<string, MeetingPart[]>();
    for (const part of schedule.parts) {
      const list = sections.get(part.section) ?? [];
      list.push(part);
      sections.set(part.section, list);
    }

    const sectionOrder = ["opening", "treasures", "ministry", "living", "closing"];
    for (const sectionKey of sectionOrder) {
      const parts = sections.get(sectionKey);
      if (!parts?.length) continue;

      const sectionEl = this.listEl.createDiv({ cls: "jw-timer-section" });
      sectionEl.createEl("h3", {
        cls: "jw-timer-section-title",
        text: sectionLabels[sectionKey] ?? sectionKey,
      });

      for (const part of parts) {
        if (part.isSeparator) continue;
        this.renderCard(sectionEl, part, scheduledStart.get(part.order) ?? startMinutes);
      }
    }
  }

  private renderCard(parentEl: HTMLElement, part: MeetingPart, scheduledStartMins: number): void {
    const card = parentEl.createDiv({ cls: "jw-timer-card" });
    card.setAttribute("data-state", "idle");
    card.setAttribute("data-running", "false");

    // Title + allotted minutes
    const header = card.createDiv({ cls: "jw-timer-card-header" });
    header.createDiv({ cls: "jw-timer-card-title", text: part.label });
    header.createDiv({ cls: "jw-timer-card-allotted", text: `${Math.round(part.durationSec / 60)} min` });

    // Scheduled end time + actual stopped-at time
    const endTimeMins = scheduledStartMins + Math.ceil(part.durationSec / 60);
    const timeRow = card.createDiv({ cls: "jw-timer-time-row" });
    const endTimeEl = timeRow.createSpan({
      cls: "jw-timer-end-time",
      text: `End ${minutesToTime(endTimeMins)}`,
    });
    const stoppedAtEl = timeRow.createSpan({ cls: "jw-timer-stopped-at" });

    // Progress bar
    const barEl = card.createDiv({ cls: "jw-timer-bar" });
    const barFillEl = barEl.createDiv({ cls: "jw-timer-bar-fill" });

    // Large elapsed clock
    const clockRow = card.createDiv({ cls: "jw-timer-clock-row" });
    const elapsedEl = clockRow.createDiv({ cls: "jw-timer-elapsed", text: "00:00" });

    // Controls
    const controls = card.createDiv({ cls: "jw-timer-controls" });
    const playBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-play", text: "▶" });
    playBtn.setAttr("aria-label", "Start timer");
    const resetBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-reset", text: "↺" });
    resetBtn.setAttr("aria-label", "Reset timer");

    playBtn.addEventListener("click", () => this.handlePlayPause(part));
    resetBtn.addEventListener("click", () => this.handleReset(part));

    // Suppress unused-var warning — endTimeEl content is set once and never changes
    void endTimeEl;

    this.cards.set(part.order, { cardEl: card, elapsedEl, endTimeEl, stoppedAtEl, playBtn, resetBtn, barFillEl });
    this.updateCard(part, scheduledStartMins);
  }

  // ─── Timer controls ─────────────────────────────────────────────────────────

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

  // ─── Tick & display update ───────────────────────────────────────────────────

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
    const { elapsedMs, status, stoppedAt } = snap;
    const durationMs = part.durationSec * 1000;

    // Elapsed clock
    refs.elapsedEl.setText(formatMmSs(elapsedMs));

    // Progress bar
    refs.barFillEl.style.width = `${(Math.min(1, elapsedMs / durationMs) * 100).toFixed(1)}%`;

    // Stopped-at indicator (shown only when paused)
    const endTimeMins = scheduledStartMins + Math.ceil(part.durationSec / 60);
    if (status === "paused" && stoppedAt != null) {
      const d = new Date(stoppedAt);
      const stoppedMins = d.getHours() * 60 + d.getMinutes();
      const late = stoppedMins > endTimeMins;
      refs.stoppedAtEl.setText(`· Stopped ${timestampToHHMM(stoppedAt)}`);
      refs.stoppedAtEl.className = late
        ? "jw-timer-stopped-at jw-timer-stopped-at--late"
        : "jw-timer-stopped-at";
    } else {
      refs.stoppedAtEl.setText("");
      refs.stoppedAtEl.className = "jw-timer-stopped-at";
    }

    // Card colour state + running indicator for CSS
    const state = colorState(elapsedMs, part.durationSec, status);
    refs.cardEl.setAttribute("data-state", state);
    refs.cardEl.setAttribute("data-running", status === "running" ? "true" : "false");

    // Play/pause button icon
    if (status === "running") {
      refs.playBtn.setText("⏸");
      refs.playBtn.setAttr("aria-label", "Pause timer");
    } else {
      refs.playBtn.setText("▶");
      refs.playBtn.setAttr("aria-label", status === "paused" ? "Resume timer" : "Start timer");
    }
  }
}
