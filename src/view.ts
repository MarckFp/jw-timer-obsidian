import { ItemView, WorkspaceLeaf } from "obsidian";
import type JwTimerPlugin from "./main";
import type { WeeklySchedule, MeetingPart, MeetingSection } from "./types";
import { cacheKey, currentWeekNumber, fetchWeekSchedule } from "./scraper";
import { LOCALE_UI, LOCALE_OPENING_CLOSING, SECTION_FALLBACK, formatFetchedAt } from "./ui/locale";
import type { UiLabels } from "./ui/locale";
import {
  CardRefs,
  colorState,
  formatMmSs,
  timeToMinutes,
  minutesToTime,
  timestampToHHMM,
  isoWeeksInYear,
} from "./ui/helpers";
import { EditPartModal, AddPartModal } from "./ui/modals";

export const VIEW_TYPE_JW_TIMER = "jw-timer-sidebar";

// ─── View ─────────────────────────────────────────────────────────────────────────────

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
  /** Tracks buttons in the pending-confirm state, with their revert timeout id */
  private pendingResets = new Map<HTMLButtonElement, number>();
  private staleEl!: HTMLElement;
  private staleTextEl!: HTMLElement;
  private meetingBarContainerEl!: HTMLElement;
  private meetingBarFillEl!: HTMLElement;
  private meetingBarLabelEl!: HTMLElement;
  private totalTimedMs = 0;
  /** Tracks partOrders that have already fired an overtime alert this session */
  private firedAlerts = new Set<number>();
  /** Currently visible card overlay, if any */
  private activeOverlay: HTMLElement | null = null;

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

    // ── Week navigation ──────────────────────────────────────────────────────────────────────
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

    // ── Staleness indicator ─────────────────────────────────────────────────────────────
    this.staleEl = root.createDiv({ cls: "jw-timer-stale" });
    const staleRefreshBtn = this.staleEl.createEl("button", {
      cls: "jw-timer-stale-refresh",
      text: "↻",
    });
    staleRefreshBtn.setAttr("aria-label", "Re-fetch schedule from wol.jw.org");
    staleRefreshBtn.addEventListener("click", () => void this.refetchSchedule());
    this.staleTextEl = this.staleEl.createSpan();
    this.staleEl.style.display = "none";

    // ── Reset-all toolbar ───────────────────────────────────────────────────────────────
    const toolbar = root.createDiv({ cls: "jw-timer-toolbar" });
    this.resetAllBtn = toolbar.createEl("button", {
      cls: "jw-timer-btn jw-timer-btn-reset-all",
      text: this.getLabels().resetAll,
    });
    this.resetAllBtn.addEventListener("click", () => this.armReset(this.resetAllBtn, () => this.handleResetAll()));
    const addPartBtn = toolbar.createEl("button", {
      cls: "jw-timer-btn jw-timer-btn-add",
      text: "+",
    });
    addPartBtn.setAttr("aria-label", "Add new stopwatch");
    addPartBtn.addEventListener("click", () => this.handleAddPart());

    // ── Status + list ────────────────────────────────────────────────────────────────────
    this.statusEl = root.createDiv({ cls: "jw-timer-status" });

    // ── Meeting progress bar ───────────────────────────────────────────────────────────────
    this.meetingBarContainerEl = root.createDiv({ cls: "jw-timer-meeting-bar-container" });
    this.meetingBarContainerEl.style.display = "none";
    const mBarTrack = this.meetingBarContainerEl.createDiv({ cls: "jw-timer-meeting-bar" });
    this.meetingBarFillEl = mBarTrack.createDiv({ cls: "jw-timer-meeting-bar-fill" });
    this.meetingBarLabelEl = this.meetingBarContainerEl.createDiv({ cls: "jw-timer-meeting-bar-label" });

    this.listEl = root.createDiv({ cls: "jw-timer-list" });
    // Dismiss any open card overlay when tapping outside it
    this.listEl.addEventListener("pointerdown", (e) => {
      if (this.activeOverlay && !(e.target as HTMLElement).closest(".jw-timer-card-overlay")) {
        this.activeOverlay.removeClass("jw-timer-card-overlay--visible");
        this.activeOverlay = null;
      }
    });

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

  // ─── Public: called when settings change ─────────────────────────────────────────────────────────────

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

  // ─── Week navigation ─────────────────────────────────────────────────────────────────────────────

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

  private isCurrentWeek(): boolean {
    return this.viewYear === new Date().getFullYear() && this.viewWeek === currentWeekNumber();
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

  // ─── Locale helpers ────────────────────────────────────────────────────────────────────────────

  private getLang(): string {
    return this.plugin.settings.wolLocale.split("/")[1] ?? "lp-e";
  }

  private getLabels(): UiLabels {
    return LOCALE_UI[this.getLang()] ?? LOCALE_UI["lp-e"];
  }

  // ─── Part helpers ───────────────────────────────────────────────────────────────────────────────

  private getEffectivePart(part: MeetingPart): MeetingPart {
    const override = this.plugin.getPartOverride(`${this.weekKey}:${part.order}`);
    if (!override) return part;
    return {
      ...part,
      ...(override.label !== undefined ? { label: override.label } : {}),
      ...(override.durationSec !== undefined ? { durationSec: override.durationSec } : {}),
      ...(override.hasAdvice !== undefined ? { hasAdvice: override.hasAdvice } : {}),
    };
  }

  private isPartDeleted(part: MeetingPart): boolean {
    return this.plugin.getPartOverride(`${this.weekKey}:${part.order}`)?.deleted === true;
  }

  /** Display rank for sorting within a section (lower = earlier). Falls back to original order. */
  private getEffectiveRank(part: MeetingPart): number {
    return this.plugin.getPartOverride(`${this.weekKey}:${part.order}`)?.rank ?? part.order;
  }

  /**
   * Returns all parts (scraped + custom) merged and sorted by section order,
   * then by effective rank within each section.
   */
  private buildMergedParts(): MeetingPart[] {
    if (!this.schedule) return [];
    const allParts = [
      ...this.schedule.parts,
      ...this.plugin.getCustomParts(this.weekKey),
    ];
    const sectionOrder = ["opening", "treasures", "ministry", "living", "closing"];
    const bySection = new Map<string, MeetingPart[]>();
    for (const key of sectionOrder) bySection.set(key, []);
    for (const p of allParts) {
      const list = bySection.get(p.section);
      if (list) list.push(p);
    }
    for (const [, parts] of bySection) {
      parts.sort((a, b) => this.getEffectiveRank(a) - this.getEffectiveRank(b));
    }
    const result: MeetingPart[] = [];
    for (const key of sectionOrder) result.push(...(bySection.get(key) ?? []));
    return result;
  }

  /**
   * Move a part one step up (delta = -1) or down (delta = 1) within its section.
   * Normalises ranks of all section parts, then swaps the two adjacent ranks.
   */
  private movePartInSection(part: MeetingPart, delta: -1 | 1): void {
    const sectionParts = this.buildMergedParts()
      .filter(p => p.section === part.section && !p.isSeparator && !this.isPartDeleted(p));
    const idx = sectionParts.findIndex(p => p.order === part.order);
    if (idx === -1) return;
    const swapIdx = idx + delta;
    if (swapIdx < 0 || swapIdx >= sectionParts.length) return;
    // Assign normalised ranks (0, 10, 20, …) then swap the two
    sectionParts.forEach((p, i) => {
      this.plugin.setPartOverride(`${this.weekKey}:${p.order}`, { rank: i * 10 });
    });
    this.plugin.setPartOverride(`${this.weekKey}:${sectionParts[idx].order}`, { rank: swapIdx * 10 });
    this.plugin.setPartOverride(`${this.weekKey}:${sectionParts[swapIdx].order}`, { rank: idx * 10 });
    void this.plugin.persistTimers();
    this.renderSchedule(this.schedule!);
    this.updateMeetingBar();
  }

  /** Virtual partOrder for advice timer — avoids clash with real part orders (≤ ~20). */
  private adviceOrder(partOrder: number): number {
    return 1000 + partOrder;
  }

  // ─── Add-part handler ──────────────────────────────────────────────────────────────────────────

  private handleAddPart(): void {
    if (!this.schedule) return;
    const labels = this.getLabels();
    const langKey = this.getLang();
    const [openingLabel, closingLabel] = LOCALE_OPENING_CLOSING[langKey] ?? ["Opening", "Closing"];
    const sectionLabels: Record<string, string> = {
      ...SECTION_FALLBACK,
      ...(this.schedule.sectionLabels ?? {}),
      opening: openingLabel,
      closing: closingLabel,
    };
    new AddPartModal(this.app, sectionLabels, labels, (label, durationSec, section, hasAdvice) => {
      const order = this.plugin.getNextCustomOrder(this.weekKey);
      this.plugin.addCustomPart(this.weekKey, {
        label,
        durationSec,
        section,
        order,
        hasAdvice: hasAdvice || undefined,
        isCustom: true,
      });
      void this.plugin.persistTimers();
      this.renderSchedule(this.schedule!);
      this.updateMeetingBar();
    }).open();
  }

  // ─── Schedule loading ──────────────────────────────────────────────────────────────────────────

  private async loadScheduleForWeek(year: number, week: number): Promise<void> {
    this.weekKey = cacheKey(year, week);
    this.navLabelEl.setText(`${year} · W${String(week).padStart(2, "0")}`);
    this.staleEl.style.display = "none";
    this.meetingBarContainerEl.style.display = "none";
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
    const { text: staleText, level: staleLevel } = formatFetchedAt(schedule.fetchedAt, this.getLang());
    this.staleTextEl.setText(staleText);
    this.staleEl.className = `jw-timer-stale jw-timer-stale--${staleLevel}`;
    this.staleEl.style.display = "";
    this.renderSchedule(schedule);
    this.updateMeetingBar();
    this.updateTodayVisibility();
  }

  private setStatus(type: "ok" | "loading" | "error", text: string): void {
    this.statusEl.empty();
    this.statusEl.className = `jw-timer-status jw-timer-status--${type}`;
    this.statusEl.setText(text);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────────────────────

  private renderSchedule(schedule: WeeklySchedule): void {
    this.listEl.empty();
    this.cards.clear();
    this.adviceCards.clear();
    this.firedAlerts.clear();

    const allParts = this.buildMergedParts();

    // Compute total timed content duration (non-separator, non-deleted parts + advice slots)
    this.totalTimedMs = 0;
    for (const p of allParts) {
      if (p.isSeparator || this.isPartDeleted(p)) continue;
      const ep = this.getEffectivePart(p);
      this.totalTimedMs += ep.durationSec * 1000;
      if (ep.hasAdvice && this.plugin.settings.showAdvice) this.totalTimedMs += 60_000;
    }
    this.meetingBarContainerEl.style.display = "";

    const startMinutes = timeToMinutes(this.plugin.settings.meetingStartTime);
    let cursor = startMinutes + this.plugin.settings.openingSongMinutes;

    const scheduledStart = new Map<number, number>();
    for (const part of allParts) {
      if (part.isSeparator) { cursor += Math.ceil(part.durationSec / 60); continue; }
      if (this.isPartDeleted(part)) continue;
      const ep = this.getEffectivePart(part);
      scheduledStart.set(part.order, cursor);
      cursor += Math.ceil(ep.durationSec / 60) + (ep.hasAdvice && this.plugin.settings.showAdvice ? 1 : 0);
    }

    // Opening/Closing labels from locale map; middle sections from scraper (page language)
    const langKey = this.getLang();
    const [openingLabel, closingLabel] = LOCALE_OPENING_CLOSING[langKey] ?? ["Opening", "Closing"];
    const sectionLabels: Record<string, string> = {
      ...SECTION_FALLBACK,
      ...(schedule.sectionLabels ?? {}),
      opening: openingLabel,
      closing: closingLabel,
    };

    // Group by section (already sorted within each section by buildMergedParts)
    const sectionOrder: MeetingSection[] = ["opening", "treasures", "ministry", "living", "closing"];
    const bySection = new Map<string, MeetingPart[]>();
    for (const key of sectionOrder) bySection.set(key, []);
    for (const p of allParts) {
      if (p.isSeparator || this.isPartDeleted(p)) continue;
      const list = bySection.get(p.section);
      if (list) list.push(p);
    }

    for (const sectionKey of sectionOrder) {
      const parts = bySection.get(sectionKey);
      if (!parts?.length) continue;

      const sectionEl = this.listEl.createDiv({ cls: "jw-timer-section" });
      sectionEl.setAttribute("data-section", sectionKey);
      sectionEl.createEl("h3", {
        cls: "jw-timer-section-title",
        text: sectionLabels[sectionKey] ?? sectionKey,
      });

      for (const part of parts) {
        this.renderCard(sectionEl, this.getEffectivePart(part), scheduledStart.get(part.order) ?? startMinutes);
      }
    }
  }

  private renderCard(parentEl: HTMLElement, part: MeetingPart, scheduledStartMins: number): void {
    const labels = this.getLabels();
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
      text: `${labels.end} ${minutesToTime(endTimeMins)}`,
    });
    const stoppedAtEl = timeRow.createSpan({ cls: "jw-timer-stopped-at" });
    const deltaEl = timeRow.createSpan({ cls: "jw-timer-delta" });
    deltaEl.style.display = "none";

    // Progress bar
    const barEl = card.createDiv({ cls: "jw-timer-bar" });
    const barFillEl = barEl.createDiv({ cls: "jw-timer-bar-fill" });

    // Large elapsed clock
    const clockRow = card.createDiv({ cls: "jw-timer-clock-row" });
    const elapsedEl = clockRow.createDiv({ cls: "jw-timer-elapsed", text: "00:00" });

    // Controls
    const controls = card.createDiv({ cls: "jw-timer-controls" });
    const playBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-play", text: labels.play });
    playBtn.setAttr("aria-label", "Start timer");
    const resetBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-reset", text: labels.reset });
    resetBtn.setAttr("aria-label", "Reset timer");

    playBtn.addEventListener("click", () => this.handlePlayPause(part));
    resetBtn.addEventListener("click", () => this.armReset(resetBtn, () => this.handleReset(part)));

    // Suppress unused-var warning
    void endTimeEl;

    this.cards.set(part.order, { cardEl: card, elapsedEl, endTimeEl, stoppedAtEl, deltaEl, playBtn, resetBtn, barFillEl });
    this.updateCard(part, scheduledStartMins);

    // Advice sub-card for parts with instructor feedback (Bible reading + ministry parts)
    if (part.hasAdvice && this.plugin.settings.showAdvice) this.renderAdviceCard(parentEl, part);

    // ─── Long-press overlay ──────────────────────────────────────────────────────────────────────
    const overlay = card.createDiv({ cls: "jw-timer-card-overlay" });
    const editBtn = overlay.createEl("button", {
      cls: "jw-timer-overlay-btn jw-timer-overlay-btn--edit",
      text: labels.editOverlay,
    });
    const moveRow = overlay.createDiv({ cls: "jw-timer-overlay-move-row" });
    const moveUpBtn = moveRow.createEl("button", {
      cls: "jw-timer-overlay-btn jw-timer-overlay-btn--move",
      text: "↑",
    });
    moveUpBtn.setAttr("aria-label", "Move part up");
    const moveDownBtn = moveRow.createEl("button", {
      cls: "jw-timer-overlay-btn jw-timer-overlay-btn--move",
      text: "↓",
    });
    moveDownBtn.setAttr("aria-label", "Move part down");
    const deleteBtn = overlay.createEl("button", {
      cls: "jw-timer-overlay-btn jw-timer-overlay-btn--delete",
      text: labels.deleteOverlay,
    });

    let longPressTimer: number | null = null;
    let pressStartX = 0;
    let pressStartY = 0;
    const cancelPress = () => {
      if (longPressTimer !== null) {
        window.clearTimeout(longPressTimer);
        longPressTimer = null;
        card.style.touchAction = "";
        card.removeClass("jw-timer-card--pressing");
      }
    };
    card.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest("button, .jw-timer-card-overlay")) return;
      pressStartX = e.clientX;
      pressStartY = e.clientY;
      card.style.touchAction = "none";
      card.addClass("jw-timer-card--pressing");
      longPressTimer = window.setTimeout(() => {
        longPressTimer = null;
        card.style.touchAction = "";
        card.removeClass("jw-timer-card--pressing");
        if (this.activeOverlay && this.activeOverlay !== overlay) {
          this.activeOverlay.removeClass("jw-timer-card-overlay--visible");
        }
        this.activeOverlay = overlay;
        overlay.addClass("jw-timer-card-overlay--visible");
      }, 600);
    });
    card.addEventListener("pointerup", cancelPress);
    card.addEventListener("pointermove", (e) => {
      if (longPressTimer === null) return;
      const dx = e.clientX - pressStartX;
      const dy = e.clientY - pressStartY;
      if (dx * dx + dy * dy > 100) cancelPress();
    });
    card.addEventListener("pointercancel", cancelPress);
    card.addEventListener("contextmenu", (e) => e.preventDefault());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.removeClass("jw-timer-card-overlay--visible");
        if (this.activeOverlay === overlay) this.activeOverlay = null;
      }
    });
    editBtn.addEventListener("click", () => {
      overlay.removeClass("jw-timer-card-overlay--visible");
      if (this.activeOverlay === overlay) this.activeOverlay = null;
      new EditPartModal(this.app, part, labels, (newLabel, newDurationSec, newHasAdvice) => {
        if (part.isCustom) {
          this.plugin.updateCustomPart(this.weekKey, part.order, {
            label: newLabel,
            durationSec: newDurationSec,
            hasAdvice: newHasAdvice || undefined,
          });
        } else {
          this.plugin.setPartOverride(`${this.weekKey}:${part.order}`, {
            label: newLabel,
            durationSec: newDurationSec,
            hasAdvice: newHasAdvice,
          });
        }
        void this.plugin.persistTimers();
        this.renderSchedule(this.schedule!);
        this.updateMeetingBar();
      }).open();
    });
    moveUpBtn.addEventListener("click", () => {
      overlay.removeClass("jw-timer-card-overlay--visible");
      if (this.activeOverlay === overlay) this.activeOverlay = null;
      this.movePartInSection(part, -1);
    });
    moveDownBtn.addEventListener("click", () => {
      overlay.removeClass("jw-timer-card-overlay--visible");
      if (this.activeOverlay === overlay) this.activeOverlay = null;
      this.movePartInSection(part, 1);
    });
    deleteBtn.addEventListener("click", () => {
      overlay.removeClass("jw-timer-card-overlay--visible");
      if (this.activeOverlay === overlay) this.activeOverlay = null;
      if (part.isCustom) {
        this.plugin.removeCustomPart(this.weekKey, part.order);
      } else {
        this.plugin.setPartOverride(`${this.weekKey}:${part.order}`, { deleted: true });
      }
      void this.plugin.persistTimers();
      this.renderSchedule(this.schedule!);
      this.updateMeetingBar();
    });
  }

  // ─── Re-fetch schedule ────────────────────────────────────────────────────────────────────────

  private async refetchSchedule(): Promise<void> {
    this.plugin.evictCachedSchedule(this.weekKey);
    this.plugin.clearPartOverrides(this.weekKey);
    this.staleEl.style.display = "none";
    this.meetingBarContainerEl.style.display = "none";
    this.schedule = null;
    this.cards.clear();
    this.adviceCards.clear();
    this.listEl.empty();
    await this.loadScheduleForWeek(this.viewYear, this.viewWeek);
  }

  // ─── Two-click reset guard ──────────────────────────────────────────────────────────────────────

  private armReset(btn: HTMLButtonElement, onConfirm: () => void): void {
    if (this.pendingResets.has(btn)) {
      const tid = this.pendingResets.get(btn)!;
      window.clearTimeout(tid);
      this.pendingResets.delete(btn);
      btn.removeClass("jw-timer-btn--confirm");
      btn.setText(btn === this.resetAllBtn ? this.getLabels().resetAll : this.getLabels().reset);
      onConfirm();
      return;
    }
    const labels = this.getLabels();
    btn.setText(labels.confirm);
    btn.addClass("jw-timer-btn--confirm");
    const tid = window.setTimeout(() => {
      this.pendingResets.delete(btn);
      btn.removeClass("jw-timer-btn--confirm");
      if (btn === this.resetAllBtn) {
        btn.setText(this.getLabels().resetAll);
      } else {
        btn.setText(this.getLabels().reset);
      }
    }, 3000);
    this.pendingResets.set(btn, tid);
  }

  // ─── Timer controls ────────────────────────────────────────────────────────────────────────────

  private handlePlayPause(part: MeetingPart): void {
    const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
    if (snap.status === "running") {
      this.plugin.timerEngine.pause(this.weekKey, part.order);
      void this.plugin.persistTimers();
    } else {
      this.plugin.timerEngine.start(this.weekKey, part.order);
    }
    this.updateCardByOrder(part);
    this.updateMeetingBar();
  }

  private handleReset(part: MeetingPart): void {
    this.plugin.timerEngine.reset(this.weekKey, part.order);
    this.firedAlerts.delete(part.order);
    if (part.hasAdvice) {
      this.plugin.timerEngine.reset(this.weekKey, this.adviceOrder(part.order));
      this.firedAlerts.delete(this.adviceOrder(part.order));
      this.updateAdviceCard(part);
    }
    this.updateCardByOrder(part);
    this.updateMeetingBar();
    void this.plugin.persistTimers();
  }

  // ─── Tick & display update ───────────────────────────────────────────────────────────────────

  private tick(): void {
    if (!this.schedule) return;
    let anyRunning = false;
    for (const part of this.buildMergedParts()) {
      if (part.isSeparator) continue;
      const ep = this.getEffectivePart(part);
      const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
      if (snap.status === "running") {
        this.updateCardByOrder(part);
        anyRunning = true;
        if (snap.elapsedMs >= ep.durationSec * 1000) this.fireAlert(part.order);
      }
      if (ep.hasAdvice && this.plugin.settings.showAdvice) {
        const aSnap = this.plugin.timerEngine.get(this.weekKey, this.adviceOrder(part.order));
        if (aSnap.status === "running") {
          this.updateAdviceCard(part);
          anyRunning = true;
          if (aSnap.elapsedMs >= 60_000) this.fireAlert(this.adviceOrder(part.order));
        }
      }
    }
    if (anyRunning) this.updateMeetingBar();
  }

  /** Fire a one-shot overtime alert (sound and/or vibration) for the given slot. */
  private fireAlert(slotOrder: number): void {
    if (this.firedAlerts.has(slotOrder)) return;
    this.firedAlerts.add(slotOrder);
    const { alertSound, alertSoundSec, alertVibrate, alertVibrateSec } = this.plugin.settings;
    if (alertSound) this.playBeep(alertSoundSec);
    if (alertVibrate && "vibrate" in navigator) {
      try {
        // Double-pulse "ba-dum" pattern — more attention-grabbing than single pulses.
        // Uses recursive setTimeout since Android WebView ignores pattern arrays.
        const pulse1 = 300;
        const gap    = 120;
        const pulse2 = 300;
        const beatMs = pulse1 + gap + pulse2 + 280; // ~1 000 ms per beat
        const totalBeats = Math.max(1, Math.round((alertVibrateSec * 1000) / beatMs));
        let beat = 0;
        const doBeat = () => {
          navigator.vibrate(pulse1);
          window.setTimeout(() => navigator.vibrate(pulse2), pulse1 + gap);
          beat++;
          if (beat < totalBeats) window.setTimeout(doBeat, beatMs);
        };
        doBeat();
      } catch { /* unsupported */ }
    }
  }

  /** Synthesise a repeating beep using the Web Audio API for the given duration. */
  private playBeep(durationSec: number): void {
    try {
      const ctx = new AudioContext();
      // Each beep cycle: 0.18s tone + 0.07s silence = 0.25s per cycle
      const cycleLen = 0.25;
      const toneLen = 0.18;
      const cycles = Math.max(1, Math.round(durationSec / cycleLen));
      for (let i = 0; i < cycles; i++) {
        const startSec = ctx.currentTime + i * cycleLen;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.4, startSec);
        gain.gain.exponentialRampToValueAtTime(0.001, startSec + toneLen);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startSec);
        osc.stop(startSec + toneLen);
      }
      window.setTimeout(() => ctx.close(), durationSec * 1000 + 300);
    } catch {
      // AudioContext unavailable — silently ignore
    }
  }

  private updateMeetingBar(): void {
    if (!this.schedule || this.totalTimedMs === 0) return;
    let elapsedMs = 0;
    for (const part of this.buildMergedParts()) {
      if (part.isSeparator || this.isPartDeleted(part)) continue;
      const ep = this.getEffectivePart(part);
      elapsedMs += this.plugin.timerEngine.get(this.weekKey, part.order).elapsedMs;
      if (ep.hasAdvice && this.plugin.settings.showAdvice) {
        elapsedMs += this.plugin.timerEngine.get(this.weekKey, this.adviceOrder(part.order)).elapsedMs;
      }
    }
    const ratio = Math.min(1, elapsedMs / this.totalTimedMs);
    this.meetingBarFillEl.style.width = `${(ratio * 100).toFixed(1)}%`;
    this.meetingBarLabelEl.setText(`${formatMmSs(elapsedMs)} / ${formatMmSs(this.totalTimedMs)}`);
  }

  private updateCardByOrder(part: MeetingPart): void {
    const startMinutes = timeToMinutes(this.plugin.settings.meetingStartTime);
    let cursor = startMinutes + this.plugin.settings.openingSongMinutes;
    let scheduledStart = cursor;
    for (const p of this.buildMergedParts()) {
      if (p.isSeparator) { cursor += Math.ceil(p.durationSec / 60); continue; }
      if (p.order === part.order) { scheduledStart = cursor; break; }
      if (!this.isPartDeleted(p)) {
        const ep = this.getEffectivePart(p);
        cursor += Math.ceil(ep.durationSec / 60) + (ep.hasAdvice && this.plugin.settings.showAdvice ? 1 : 0);
      }
    }
    this.updateCard(this.getEffectivePart(part), scheduledStart);
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

    const labels = this.getLabels();

    // Stopped-at indicator + delta badge (shown only when paused)
    const endTimeMins = scheduledStartMins + Math.ceil(part.durationSec / 60);
    if (status === "paused" && stoppedAt != null) {
      const d = new Date(stoppedAt);
      const stoppedMins = d.getHours() * 60 + d.getMinutes();
      const deltaMin = stoppedMins - endTimeMins;
      const late = deltaMin > 0;
      refs.stoppedAtEl.setText(`· ${labels.stopped} ${timestampToHHMM(stoppedAt)}`);
      refs.stoppedAtEl.className = "jw-timer-stopped-at";
      const absMins = Math.abs(deltaMin);
      const fmtDelta = (n: number): string => {
        if (n < 60) return `${n}min`;
        const h = Math.floor(n / 60);
        const m = n % 60;
        return m === 0 ? `${h}h` : `${h}h ${m}min`;
      };
      if (deltaMin === 0) {
        refs.deltaEl.setText("✔");
        refs.deltaEl.className = "jw-timer-delta jw-timer-delta--early";
        refs.deltaEl.style.display = "";
      } else {
        const sign = late ? "+" : "−";
        refs.deltaEl.setText(`${sign}${fmtDelta(absMins)}`);
        refs.deltaEl.className = `jw-timer-delta jw-timer-delta--${late ? "late" : "early"}`;
        refs.deltaEl.style.display = "";
      }
    } else {
      refs.stoppedAtEl.setText("");
      refs.stoppedAtEl.className = "jw-timer-stopped-at";
      refs.deltaEl.style.display = "none";
    }

    // Card colour state + running indicator for CSS
    const state = colorState(elapsedMs, part.durationSec, status);
    refs.cardEl.setAttribute("data-state", state);
    refs.cardEl.setAttribute("data-running", status === "running" ? "true" : "false");

    // Play/pause button label
    if (status === "running") {
      refs.playBtn.setText(labels.pause);
      refs.playBtn.setAttr("aria-label", "Pause timer");
    } else {
      refs.playBtn.setText(labels.play);
      refs.playBtn.setAttr("aria-label", status === "paused" ? "Resume timer" : "Start timer");
    }
  }

  // ─── Reset All ────────────────────────────────────────────────────────────────────────────────

  private handleResetAll(): void {
    if (!this.schedule) return;
    for (const [btn, tid] of this.pendingResets) {
      window.clearTimeout(tid);
      btn.removeClass("jw-timer-btn--confirm");
    }
    this.pendingResets.clear();
    this.plugin.clearPartOverrides(this.weekKey);
    for (const part of this.buildMergedParts()) {
      if (part.isSeparator) continue;
      const ep = this.getEffectivePart(part);
      this.plugin.timerEngine.reset(this.weekKey, part.order);
      if (ep.hasAdvice) this.plugin.timerEngine.reset(this.weekKey, this.adviceOrder(part.order));
    }
    this.renderSchedule(this.schedule);
    void this.plugin.persistTimers();
  }

  // ─── Advice card ─────────────────────────────────────────────────────────────────────────────

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
    resetBtn.addEventListener("click", () => this.armReset(resetBtn, () => this.handleAdviceReset(part)));

    const deltaEl = card.createDiv({ cls: "jw-timer-delta" });
    deltaEl.style.display = "none";

    this.adviceCards.set(part.order, { cardEl: card, elapsedEl, endTimeEl, stoppedAtEl, deltaEl, playBtn, resetBtn, barFillEl });
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
    this.updateMeetingBar();
  }

  private handleAdviceReset(part: MeetingPart): void {
    this.plugin.timerEngine.reset(this.weekKey, this.adviceOrder(part.order));
    this.updateAdviceCard(part);
    this.updateMeetingBar();
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
