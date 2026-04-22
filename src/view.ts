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

// Opening/Closing labels per locale language code (WOL only has h2 for the 3 middle sections)
const LOCALE_OPENING_CLOSING: Record<string, [string, string]> = {
  "lp-e":   ["Opening",    "Closing"],
  "lp-s":   ["Apertura",   "Conclusión"],
  "lp-f":   ["Ouverture",  "Conclusion"],
  "lp-t":   ["Abertura",   "Conclusão"],
  "lp-g":   ["Eröffnung",  "Abschluss"],
  "lp-i":   ["Apertura",   "Conclusione"],
  "lp-u":   ["Начало",     "Заключение"],
  "lp-d":   ["Opening",    "Sluiting"],
  "lp-p":   ["Otwarcie",   "Zakończenie"],
  "lp-chs": ["开场",        "结束"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── UI labels per locale ──────────────────────────────────────────────────

interface UiLabels {
  play: string;
  pause: string;
  reset: string;
  resetAll: string;
  today: string;
  advice: string;
}

const LOCALE_UI: Record<string, UiLabels> = {
  "lp-e":   { play: "Play",      pause: "Pause",      reset: "Reset",         resetAll: "Reset All",           today: "Today",      advice: "Advice"    },
  "lp-s":   { play: "Iniciar",   pause: "Pausar",     reset: "Reiniciar",     resetAll: "Reiniciar todo",      today: "Hoy",        advice: "Consejo"   },
  "lp-f":   { play: "D\u00e9marrer",  pause: "Pause",      reset: "R\u00e9init.",       resetAll: "Tout r\u00e9init.",        today: "Auj.",       advice: "Conseil"   },
  "lp-t":   { play: "Iniciar",   pause: "Pausar",     reset: "Reiniciar",     resetAll: "Reiniciar tudo",      today: "Hoje",       advice: "Conselho"  },
  "lp-g":   { play: "Start",     pause: "Pause",      reset: "Zur\u00fccksetzen",  resetAll: "Alles zur\u00fccksetzen",  today: "Heute",      advice: "Rat"       },
  "lp-i":   { play: "Avvia",     pause: "Pausa",      reset: "Azzera",        resetAll: "Azzera tutto",        today: "Oggi",       advice: "Consiglio" },
  "lp-u":   { play: "\u0421\u0442\u0430\u0440\u0442",     pause: "\u041f\u0430\u0443\u0437\u0430",      reset: "\u0421\u043a\u0438\u043d\u0443\u0442\u0438",       resetAll: "\u0421\u043a\u0438\u043d\u0443\u0442\u0438 \u0432\u0441\u0435",         today: "\u0421\u044c\u043e\u0433\u043e\u0434\u043d\u0456",   advice: "\u041f\u043e\u0440\u0430\u0434\u0430"    },
  "lp-d":   { play: "Start",     pause: "Pauze",      reset: "Reset",         resetAll: "Alles resetten",      today: "Vandaag",    advice: "Advies"    },
  "lp-p":   { play: "Start",     pause: "Pauza",      reset: "Resetuj",       resetAll: "Resetuj wszystko",    today: "Dzi\u015b",       advice: "Rada"      },
  "lp-j":   { play: "\u30b9\u30bf\u30fc\u30c8",  pause: "\u4e00\u6642\u505c\u6b62",   reset: "\u30ea\u30bb\u30c3\u30c8",       resetAll: "\u5168\u30ea\u30bb\u30c3\u30c8",            today: "\u4eca\u65e5",       advice: "\u52a9\u8a00"      },
  "lp-ko":  { play: "\uc2dc\uc791",      pause: "\uc77c\uc2dc\uc815\uc9c0",   reset: "\ucd08\uae30\ud654",        resetAll: "\uc804\uccb4 \ucd08\uae30\ud654",          today: "\uc624\ub298",       advice: "\uc870\uc5b8"      },
  "lp-chs": { play: "\u5f00\u59cb",      pause: "\u6682\u505c",       reset: "\u91cd\u7f6e",          resetAll: "\u5168\u90e8\u91cd\u7f6e",               today: "\u4eca\u5929",       advice: "\u6307\u5bfc"      },
};

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
  private adviceCards = new Map<number, CardRefs>();
  private tickHandle: number | null = null;
  private statusEl!: HTMLElement;
  private navLabelEl!: HTMLElement;
  private todayBtn!: HTMLButtonElement;
  private resetAllBtn!: HTMLButtonElement;
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
    prevBtn.setAttr("aria-label", "Previous week");
    this.navLabelEl = navEl.createDiv({ cls: "jw-timer-nav-label" });
    const nextBtn = navEl.createEl("button", { cls: "jw-timer-nav-btn", text: "▶" });
    nextBtn.setAttr("aria-label", "Next week");
    this.todayBtn = navEl.createEl("button", { cls: "jw-timer-nav-today", text: this.getLabels().today });
    this.todayBtn.setAttr("aria-label", "Jump to current week");
    this.todayBtn.style.display = "none";
    prevBtn.addEventListener("click", () => void this.navigateWeek(-1));
    nextBtn.addEventListener("click", () => void this.navigateWeek(+1));
    this.todayBtn.addEventListener("click", () => void this.navigateToToday());

    // ── Reset-all toolbar ────────────────────────────────────────────────────
    const toolbar = root.createDiv({ cls: "jw-timer-toolbar" });
    this.resetAllBtn = toolbar.createEl("button", {
      cls: "jw-timer-btn jw-timer-btn-reset-all",
      text: this.getLabels().resetAll,
    });
    this.resetAllBtn.addEventListener("click", () => this.handleResetAll());

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
    this.adviceCards.clear();
    this.listEl.empty();
    const labels = this.getLabels();
    this.resetAllBtn.setText(labels.resetAll);
    this.todayBtn.setText(labels.today);
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
    this.adviceCards.clear();
    this.listEl.empty();
    await this.loadScheduleForWeek(y, w);
  }

  // ─── Today helpers ──────────────────────────────────────────────────────────

  // ─── Locale helpers ──────────────────────────────────────────────────────────

  private getLang(): string {
    return this.plugin.settings.wolLocale.split("/")[1] ?? "lp-e";
  }

  private getLabels(): UiLabels {
    return LOCALE_UI[this.getLang()] ?? LOCALE_UI["lp-e"];
  }

  /** Virtual partOrder for advice timer — avoids clash with real part orders (≤ ~20). */
  private adviceOrder(partOrder: number): number {
    return 1000 + partOrder;
  }

  // ─── Today helpers ────────────────────────────────────────────────────────

  private isCurrentWeek(): boolean {
    const year = new Date().getFullYear();
    const week = currentWeekNumber();
    return this.viewYear === year && this.viewWeek === week;
  }

  private updateTodayVisibility(): void {
    this.todayBtn.style.display = this.isCurrentWeek() ? "none" : "";
  }

  private async navigateToToday(): Promise<void> {
    this.viewYear = new Date().getFullYear();
    this.viewWeek = currentWeekNumber();
    this.schedule = null;
    this.cards.clear();
    this.adviceCards.clear();
    this.listEl.empty();
    await this.loadScheduleForWeek(this.viewYear, this.viewWeek);
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
    this.updateTodayVisibility();
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
    this.adviceCards.clear();

    const startMinutes = timeToMinutes(this.plugin.settings.meetingStartTime);
    let cursor = startMinutes + this.plugin.settings.openingSongMinutes;

    const scheduledStart = new Map<number, number>();
    for (const part of schedule.parts) {
      scheduledStart.set(part.order, cursor);
      cursor += Math.ceil(part.durationSec / 60);
    }

    // Opening/Closing labels from locale map; middle sections from scraper (page language)
    const langKey = this.plugin.settings.wolLocale.split("/")[1] ?? "lp-e";
    const [openingLabel, closingLabel] = LOCALE_OPENING_CLOSING[langKey] ?? ["Opening", "Closing"];
    const sectionLabels: Record<string, string> = {
      ...SECTION_FALLBACK,
      ...(schedule.sectionLabels ?? {}),
      opening: openingLabel,
      closing: closingLabel,
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
    const { play: playLabel, reset: resetLabel } = this.getLabels();
    const playBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-play", text: playLabel });
    playBtn.setAttr("aria-label", "Start timer");
    const resetBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-reset", text: resetLabel });
    resetBtn.setAttr("aria-label", "Reset timer");

    playBtn.addEventListener("click", () => this.handlePlayPause(part));
    resetBtn.addEventListener("click", () => this.handleReset(part));

    // Suppress unused-var warning — endTimeEl content is set once and never changes
    void endTimeEl;

    this.cards.set(part.order, { cardEl: card, elapsedEl, endTimeEl, stoppedAtEl, playBtn, resetBtn, barFillEl });
    this.updateCard(part, scheduledStartMins);

    // Advice sub-card for parts with instructor feedback (Bible reading + ministry parts)
    if (part.hasAdvice) this.renderAdviceCard(parentEl, part);
  }

  // ─── Timer controls ─────────────────────────────────────────────────────────

  private handlePlayPause(part: MeetingPart): void {
    const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
    if (snap.status === "running") {
      this.plugin.timerEngine.pause(this.weekKey, part.order);
      void this.plugin.persistTimers(); // persist elapsed time on pause
    } else {
      this.plugin.timerEngine.start(this.weekKey, part.order);
    }
    this.updateCardByOrder(part);
  }

  private handleReset(part: MeetingPart): void {
    this.plugin.timerEngine.reset(this.weekKey, part.order);
    if (part.hasAdvice) {
      this.plugin.timerEngine.reset(this.weekKey, this.adviceOrder(part.order));
      this.updateAdviceCard(part);
    }
    this.updateCardByOrder(part);
    void this.plugin.persistTimers();
  }

  // ─── Tick & display update ───────────────────────────────────────────────────

  private tick(): void {
    if (!this.schedule) return;
    for (const part of this.schedule.parts) {
      const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
      if (snap.status === "running") this.updateCardByOrder(part);
      if (part.hasAdvice) {
        const aSnap = this.plugin.timerEngine.get(this.weekKey, this.adviceOrder(part.order));
        if (aSnap.status === "running") this.updateAdviceCard(part);
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

    // Play/pause button label
    const labels = this.getLabels();
    if (status === "running") {
      refs.playBtn.setText(labels.pause);
      refs.playBtn.setAttr("aria-label", "Pause timer");
    } else {
      refs.playBtn.setText(labels.play);
      refs.playBtn.setAttr("aria-label", status === "paused" ? "Resume timer" : "Start timer");
    }
  }

  // ─── Reset All ────────────────────────────────────────────────────────────

  private handleResetAll(): void {
    if (!this.schedule) return;
    for (const part of this.schedule.parts) {
      this.plugin.timerEngine.reset(this.weekKey, part.order);
      if (part.hasAdvice) this.plugin.timerEngine.reset(this.weekKey, this.adviceOrder(part.order));
    }
    this.renderSchedule(this.schedule);
    void this.plugin.persistTimers();
  }

  // ─── Advice card ────────────────────────────────────────────────────────────

  private renderAdviceCard(parentEl: HTMLElement, part: MeetingPart): void {
    const labels = this.getLabels();
    const card = parentEl.createDiv({ cls: "jw-timer-card jw-timer-card--advice" });
    card.setAttribute("data-state", "idle");
    card.setAttribute("data-running", "false");

    // Badge: arrow icon + label
    const badge = card.createDiv({ cls: "jw-timer-advice-badge" });
    badge.createSpan({ cls: "jw-timer-advice-icon", text: "↳" });
    badge.createSpan({ cls: "jw-timer-advice-label", text: `${labels.advice} · 1 min` });

    // Progress bar
    const barEl = card.createDiv({ cls: "jw-timer-bar" });
    const barFillEl = barEl.createDiv({ cls: "jw-timer-bar-fill" });

    // Stopped-at row
    const timeRow = card.createDiv({ cls: "jw-timer-time-row" });
    const endTimeEl = timeRow.createSpan();
    const stoppedAtEl = timeRow.createSpan({ cls: "jw-timer-stopped-at" });
    void endTimeEl;

    // Elapsed clock
    const clockRow = card.createDiv({ cls: "jw-timer-clock-row" });
    const elapsedEl = clockRow.createDiv({ cls: "jw-timer-elapsed jw-timer-elapsed--advice", text: "00:00" });

    // Controls
    const controls = card.createDiv({ cls: "jw-timer-controls" });
    const playBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-play", text: labels.play });
    playBtn.setAttr("aria-label", "Start advice timer");
    const resetBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-reset", text: labels.reset });
    resetBtn.setAttr("aria-label", "Reset advice timer");

    playBtn.addEventListener("click", () => this.handleAdvicePlayPause(part));
    resetBtn.addEventListener("click", () => this.handleAdviceReset(part));

    this.adviceCards.set(part.order, { cardEl: card, elapsedEl, endTimeEl, stoppedAtEl, playBtn, resetBtn, barFillEl });
    this.updateAdviceCard(part);
  }

  private handleAdvicePlayPause(part: MeetingPart): void {
    const aOrder = this.adviceOrder(part.order);
    const snap = this.plugin.timerEngine.get(this.weekKey, aOrder);
    if (snap.status === "running") {
      this.plugin.timerEngine.pause(this.weekKey, aOrder);
      void this.plugin.persistTimers();
    } else {
      this.plugin.timerEngine.start(this.weekKey, aOrder);
    }
    this.updateAdviceCard(part);
  }

  private handleAdviceReset(part: MeetingPart): void {
    this.plugin.timerEngine.reset(this.weekKey, this.adviceOrder(part.order));
    this.updateAdviceCard(part);
    void this.plugin.persistTimers();
  }

  private updateAdviceCard(part: MeetingPart): void {
    const refs = this.adviceCards.get(part.order);
    if (!refs) return;
    const labels = this.getLabels();
    const ADVICE_SEC = 60;
    const snap = this.plugin.timerEngine.get(this.weekKey, this.adviceOrder(part.order));
    const { elapsedMs, status, stoppedAt } = snap;

    refs.elapsedEl.setText(formatMmSs(elapsedMs));
    refs.barFillEl.style.width = `${(Math.min(1, elapsedMs / (ADVICE_SEC * 1000)) * 100).toFixed(1)}%`;

    if (status === "paused" && stoppedAt != null) {
      refs.stoppedAtEl.setText(`· ${timestampToHHMM(stoppedAt)}`);
    } else {
      refs.stoppedAtEl.setText("");
    }

    const state = colorState(elapsedMs, ADVICE_SEC, status);
    refs.cardEl.setAttribute("data-state", state);
    refs.cardEl.setAttribute("data-running", status === "running" ? "true" : "false");

    refs.playBtn.setText(status === "running" ? labels.pause : labels.play);
  }
}
