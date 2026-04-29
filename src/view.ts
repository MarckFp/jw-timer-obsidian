import { ItemView, MarkdownRenderer, WorkspaceLeaf } from "obsidian";
import type JwTimerPlugin from "./main";
import type { WeeklySchedule, MeetingPart, MeetingSection } from "./types";
import { cacheKey, currentWeekNumber, fetchWeekSchedule } from "./scraper";
import {
  LOCALE_UI,
  LOCALE_OPENING_CLOSING,
  SECTION_FALLBACK,
  formatFetchedAt,
} from "./ui/locale";
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
import { AddPartModal } from "./ui/modals";
import { renderCard } from "./ui/card-renderer";
import type { CardController } from "./ui/card-renderer";
import { buildExportText, copyToClipboard } from "./ui/exporter";
import type { ExportData } from "./ui/exporter";

export const VIEW_TYPE_JW_TIMER = "jw-timer-sidebar";

// ─── View ─────────────────────────────────────────────────────────────────────────────

export class JwTimerView extends ItemView implements CardController {
  schedule: WeeklySchedule | null = null;
  weekKey = "";
  cards = new Map<number, CardRefs>();
  adviceCards = new Map<number, CardRefs>();
  private tickHandle: number | null = null;
  /** Incremented on each loadScheduleForWeek call; stale responses are discarded. */
  private loadRequestId = 0;
  private audioCtx: AudioContext | null = null;
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
  /** Section keys the user has collapsed — persists for the lifetime of the view */
  private collapsedSections = new Set<string>();
  /** Currently visible card overlay, if any */
  activeOverlay: HTMLElement | null = null;
  private exportFooterEl!: HTMLElement;
  private shareCopyHandle: number | null = null;
  private shareBtnEl!: HTMLButtonElement;

  // Pagination state — initialised to current week in onOpen
  private viewYear: number = new Date().getFullYear();
  private viewWeek: number = currentWeekNumber();

  constructor(
    leaf: WorkspaceLeaf,
    readonly plugin: JwTimerPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_JW_TIMER;
  }
  getDisplayText(): string {
    return "JW Meeting Timer";
  }
  getIcon(): string {
    return "timer";
  }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass("jw-timer-root");

    // ── Week navigation ──────────────────────────────────────────────────────────────────────
    const navEl = root.createDiv({ cls: "jw-timer-nav" });
    const prevBtn = navEl.createEl("button", {
      cls: "jw-timer-nav-btn",
      text: "◀",
    });
    prevBtn.setAttr("aria-label", "Previous week");
    this.navLabelEl = navEl.createDiv({ cls: "jw-timer-nav-label" });
    const nextBtn = navEl.createEl("button", {
      cls: "jw-timer-nav-btn",
      text: "▶",
    });
    nextBtn.setAttr("aria-label", "Next week");
    this.todayBtn = navEl.createEl("button", {
      cls: "jw-timer-nav-today",
      text: this.getLabels().today,
    });
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
    staleRefreshBtn.addEventListener(
      "click",
      () => void this.refetchSchedule(),
    );
    this.staleTextEl = this.staleEl.createSpan();
    this.staleEl.style.display = "none";

    // ── Reset-all toolbar ───────────────────────────────────────────────────────────────
    const toolbar = root.createDiv({ cls: "jw-timer-toolbar" });
    this.resetAllBtn = toolbar.createEl("button", {
      cls: "jw-timer-btn jw-timer-btn-reset-all",
      text: this.getLabels().resetAll,
    });
    this.resetAllBtn.addEventListener("click", () =>
      this.armReset(this.resetAllBtn, () => this.handleResetAll()),
    );
    const addPartBtn = toolbar.createEl("button", {
      cls: "jw-timer-btn jw-timer-btn-add",
      text: "+",
    });
    addPartBtn.setAttr("aria-label", "Add new stopwatch");
    addPartBtn.addEventListener("click", () => this.handleAddPart());

    // ── Status + list ────────────────────────────────────────────────────────────────────
    this.statusEl = root.createDiv({ cls: "jw-timer-status" });
    this.statusEl.setAttribute("role", "status");
    this.statusEl.setAttribute("aria-live", "polite");
    this.statusEl.setAttribute("aria-atomic", "true");

    // ── Meeting progress bar ───────────────────────────────────────────────────────────────
    this.meetingBarContainerEl = root.createDiv({
      cls: "jw-timer-meeting-bar-container",
    });
    this.meetingBarContainerEl.style.display = "none";
    const mBarTrack = this.meetingBarContainerEl.createDiv({
      cls: "jw-timer-meeting-bar",
    });
    this.meetingBarFillEl = mBarTrack.createDiv({
      cls: "jw-timer-meeting-bar-fill",
    });
    this.meetingBarLabelEl = this.meetingBarContainerEl.createDiv({
      cls: "jw-timer-meeting-bar-label",
    });

    this.listEl = root.createDiv({ cls: "jw-timer-list" });
    // Dismiss any open card overlay when tapping outside it
    this.listEl.addEventListener("pointerdown", (e) => {
      if (
        this.activeOverlay &&
        !(e.target as HTMLElement).closest(".jw-timer-card-overlay")
      ) {
        this.activeOverlay.removeClass("jw-timer-card-overlay--visible");
        this.activeOverlay = null;
      }
    });

    // ── Export footer ────────────────────────────────────────────────────────────────────────────
    this.exportFooterEl = root.createDiv({ cls: "jw-timer-export-footer" });
    this.exportFooterEl.style.display = "none";

    this.shareBtnEl = this.exportFooterEl.createEl("button", {
      cls: "jw-timer-btn jw-timer-export-btn jw-timer-export-btn--full",
      text: this.getLabels().shareBtn,
    });
    this.shareBtnEl.setAttr("aria-label", "Share meeting timings");
    this.shareBtnEl.addEventListener("click", () => {
      // Build the text synchronously so navigator.share() can be called
      // immediately within the click handler — Web Share API requires the
      // call to happen in the same user-activation tick.
      const text = buildExportText(this.buildExportData());
      const onCopied = () => {
        const labels = this.getLabels();
        if (this.shareCopyHandle !== null)
          window.clearTimeout(this.shareCopyHandle);
        this.shareBtnEl.setText(labels.copyOk);
        this.shareCopyHandle = window.setTimeout(() => {
          this.shareCopyHandle = null;
          this.shareBtnEl.setText(this.getLabels().shareBtn);
        }, 2500);
      };
      if (typeof navigator.share === "function") {
        // Call share() directly here — do NOT await before this line.
        navigator
          .share({ text })
          .catch(() => void copyToClipboard(text, onCopied));
      } else {
        void copyToClipboard(text, onCopied);
      }
    });

    this.tickHandle = window.setInterval(() => this.tick(), 250);
    this.viewYear = new Date().getFullYear();
    this.viewWeek = currentWeekNumber();
    await this.loadScheduleForWeek(this.viewYear, this.viewWeek);
  }

  async onClose(): Promise<void> {
    try {
      if (this.tickHandle !== null) {
        window.clearInterval(this.tickHandle);
        this.tickHandle = null;
      }
      for (const [btn, tid] of this.pendingResets) {
        window.clearTimeout(tid);
        btn.removeClass("jw-timer-btn--confirm");
      }
      this.pendingResets.clear();
      this.activeOverlay = null;
      if (this.audioCtx) {
        void this.audioCtx.close();
        this.audioCtx = null;
      }
    } finally {
      await this.plugin.persistTimers().catch(console.error);
    }
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
    this.shareBtnEl.setText(labels.shareBtn);
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
    return (
      this.viewYear === new Date().getFullYear() &&
      this.viewWeek === currentWeekNumber()
    );
  }

  private updateTodayVisibility(): void {
    this.todayBtn.style.display = this.isCurrentWeek() ? "none" : "";
  }

  private async navigateToToday(): Promise<void> {
    if (this.isCurrentWeek()) return;
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

  getLabels(): UiLabels {
    return LOCALE_UI[this.getLang()] ?? LOCALE_UI["lp-e"];
  }

  renderMarkdown(text: string, el: HTMLElement): void {
    MarkdownRenderer.render(this.app, text, el, "", this).catch(console.error);
  }

  // ─── Part helpers ───────────────────────────────────────────────────────────────────────────────

  private getEffectivePart(part: MeetingPart): MeetingPart {
    const override = this.plugin.getPartOverride(
      `${this.weekKey}:${part.order}`,
    );
    if (!override) return part;
    return {
      ...part,
      ...(override.label !== undefined ? { label: override.label } : {}),
      ...(override.durationSec !== undefined
        ? { durationSec: override.durationSec }
        : {}),
      ...(override.hasAdvice !== undefined
        ? { hasAdvice: override.hasAdvice }
        : {}),
    };
  }

  private isPartDeleted(part: MeetingPart): boolean {
    return (
      this.plugin.getPartOverride(`${this.weekKey}:${part.order}`)?.deleted ===
      true
    );
  }

  /** Display rank for sorting within a section (lower = earlier). Falls back to original order. */
  private getEffectiveRank(part: MeetingPart): number {
    return (
      this.plugin.getPartOverride(`${this.weekKey}:${part.order}`)?.rank ??
      part.order
    );
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
    const sectionOrder = [
      "opening",
      "treasures",
      "ministry",
      "living",
      "closing",
    ];
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
  movePartInSection(part: MeetingPart, delta: -1 | 1): void {
    const sectionParts = this.buildMergedParts().filter(
      (p) =>
        p.section === part.section && !p.isSeparator && !this.isPartDeleted(p),
    );
    const idx = sectionParts.findIndex((p) => p.order === part.order);
    if (idx === -1) return;
    const swapIdx = idx + delta;
    if (swapIdx < 0 || swapIdx >= sectionParts.length) return;
    // Assign normalised ranks (0, 10, 20, …) then swap the two
    sectionParts.forEach((p, i) => {
      this.plugin.setPartOverride(`${this.weekKey}:${p.order}`, {
        rank: i * 10,
      });
    });
    this.plugin.setPartOverride(`${this.weekKey}:${sectionParts[idx].order}`, {
      rank: swapIdx * 10,
    });
    this.plugin.setPartOverride(
      `${this.weekKey}:${sectionParts[swapIdx].order}`,
      { rank: idx * 10 },
    );
    this.plugin.persistTimers().catch(console.error);
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
    const [openingLabel, closingLabel] = LOCALE_OPENING_CLOSING[langKey] ?? [
      "Opening",
      "Closing",
    ];
    const sectionLabels: Record<string, string> = {
      ...SECTION_FALLBACK,
      ...(this.schedule.sectionLabels ?? {}),
      opening: openingLabel,
      closing: closingLabel,
    };
    new AddPartModal(
      this.app,
      sectionLabels,
      labels,
      (label, durationSec, section, hasAdvice) => {
        const order = this.plugin.getNextCustomOrder(this.weekKey);
        this.plugin.addCustomPart(this.weekKey, {
          label,
          durationSec,
          section,
          order,
          hasAdvice: hasAdvice || undefined,
          isCustom: true,
        });
        this.plugin.persistTimers().catch(console.error);
        this.renderSchedule(this.schedule!);
        this.updateMeetingBar();
      },
    ).open();
  }

  // ─── Schedule loading ──────────────────────────────────────────────────────────────────────────

  private async loadScheduleForWeek(year: number, week: number): Promise<void> {
    const requestId = ++this.loadRequestId;
    this.weekKey = cacheKey(year, week);
    this.navLabelEl.setText(`${year} · W${String(week).padStart(2, "0")}`);
    this.staleEl.style.display = "none";
    this.meetingBarContainerEl.style.display = "none";
    let schedule = this.plugin.getCachedSchedule(this.weekKey);

    if (!schedule) {
      this.setStatus("loading", "Fetching schedule from wol.jw.org…");
      const staleVersion = this.plugin.getStaleCachedSchedule(this.weekKey);
      const fetchResult = await fetchWeekSchedule(
        this.plugin.settings.wolLocale,
        year,
        week,
        staleVersion?.fetchedAt,
      );
      // Discard if a newer navigation happened while this request was in-flight
      if (requestId !== this.loadRequestId) return;
      if (fetchResult === "not-modified" && staleVersion) {
        // Server confirmed no change — refresh the cache TTL and reuse stale data
        schedule = { ...staleVersion, fetchedAt: Date.now() };
        this.plugin.cacheSchedule(this.weekKey, schedule);
      } else if (fetchResult !== null && fetchResult !== "not-modified") {
        schedule = fetchResult;
        this.plugin.cacheSchedule(this.weekKey, schedule);
        await this.plugin.saveSettings();
      }
    }

    if (!schedule) {
      this.setStatus(
        "error",
        "Could not load schedule. Check your connection and language setting.",
      );
      return;
    }

    this.schedule = schedule;
    this.navLabelEl.setText(schedule.weekLabel);
    this.setStatus("ok", "");
    const { text: staleText, level: staleLevel } = formatFetchedAt(
      schedule.fetchedAt,
      this.getLang(),
    );
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
    if (type === "loading") {
      this.statusEl.createSpan({
        cls: "jw-timer-spinner",
        attr: { "aria-hidden": "true" },
      });
    }
    if (text) {
      this.statusEl.createSpan({ text });
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────────────────────

  renderSchedule(schedule: WeeklySchedule): void {
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
      if (ep.hasAdvice && this.plugin.settings.showAdvice)
        this.totalTimedMs += 60_000;
    }
    this.meetingBarContainerEl.style.display = "";
    this.exportFooterEl.style.display = "";

    const startMinutes = timeToMinutes(this.plugin.settings.meetingStartTime);
    let cursor = startMinutes + this.plugin.settings.openingSongMinutes;

    const scheduledStart = new Map<number, number>();
    for (const part of allParts) {
      if (part.isSeparator) {
        cursor += Math.ceil(part.durationSec / 60);
        continue;
      }
      if (this.isPartDeleted(part)) continue;
      const ep = this.getEffectivePart(part);
      scheduledStart.set(part.order, cursor);
      cursor +=
        Math.ceil(ep.durationSec / 60) +
        (ep.hasAdvice && this.plugin.settings.showAdvice ? 1 : 0);
    }

    // Opening/Closing labels from locale map; middle sections from scraper (page language)
    const langKey = this.getLang();
    const [openingLabel, closingLabel] = LOCALE_OPENING_CLOSING[langKey] ?? [
      "Opening",
      "Closing",
    ];
    const sectionLabels: Record<string, string> = {
      ...SECTION_FALLBACK,
      ...(schedule.sectionLabels ?? {}),
      opening: openingLabel,
      closing: closingLabel,
    };

    // Group by section (already sorted within each section by buildMergedParts)
    const sectionOrder: MeetingSection[] = [
      "opening",
      "treasures",
      "ministry",
      "living",
      "closing",
    ];
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

      const isCollapsed = this.collapsedSections.has(sectionKey);
      const sectionEl = this.listEl.createDiv({ cls: "jw-timer-section" });
      sectionEl.setAttribute("data-section", sectionKey);
      if (isCollapsed) sectionEl.setAttribute("data-collapsed", "true");

      const titleEl = sectionEl.createEl("h3", {
        cls: "jw-timer-section-title",
      });
      titleEl.setAttr("role", "button");
      titleEl.setAttr("tabindex", "0");
      titleEl.setAttr("aria-expanded", isCollapsed ? "false" : "true");
      titleEl.createSpan({ cls: "jw-timer-section-chevron", text: "\u25bc" });
      titleEl.appendText(sectionLabels[sectionKey] ?? sectionKey);

      const toggleCollapse = () => {
        const nowCollapsed =
          sectionEl.getAttribute("data-collapsed") === "true";
        if (nowCollapsed) {
          sectionEl.removeAttribute("data-collapsed");
          titleEl.setAttr("aria-expanded", "true");
          this.collapsedSections.delete(sectionKey);
        } else {
          sectionEl.setAttribute("data-collapsed", "true");
          titleEl.setAttr("aria-expanded", "false");
          this.collapsedSections.add(sectionKey);
        }
      };
      titleEl.addEventListener("click", toggleCollapse);
      titleEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleCollapse();
        }
      });

      for (const part of parts) {
        renderCard(
          this,
          sectionEl,
          this.getEffectivePart(part),
          scheduledStart.get(part.order) ?? startMinutes,
        );
      }
    }
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

  armReset(btn: HTMLButtonElement, onConfirm: () => void): void {
    if (this.pendingResets.has(btn)) {
      const tid = this.pendingResets.get(btn)!;
      window.clearTimeout(tid);
      this.pendingResets.delete(btn);
      btn.removeClass("jw-timer-btn--confirm");
      btn.setText(
        btn === this.resetAllBtn
          ? this.getLabels().resetAll
          : this.getLabels().reset,
      );
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

  handlePlayPause(part: MeetingPart): void {
    const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
    if (snap.status === "running") {
      this.plugin.timerEngine.pause(this.weekKey, part.order);
      this.plugin.persistTimers().catch(console.error);
      if (this.plugin.settings.autoNextPart) {
        // If the part has an advice timer that hasn't started yet, start it first.
        if (
          part.hasAdvice &&
          this.plugin.settings.showAdvice &&
          this.plugin.timerEngine.get(
            this.weekKey,
            this.adviceOrder(part.order),
          ).status === "idle"
        ) {
          this.plugin.timerEngine.start(
            this.weekKey,
            this.adviceOrder(part.order),
          );
          this.updateAdviceCard(part);
        } else {
          this.autoStartNextInSection(part);
        }
      }
    } else {
      this.plugin.timerEngine.start(this.weekKey, part.order);
    }
    this.updateCardByOrder(part);
    this.updateMeetingBar();
  }

  /** Auto-start the next idle part in the same section (used when autoNextPart is enabled). */
  private autoStartNextInSection(stoppedPart: MeetingPart): void {
    const sectionParts = this.buildMergedParts().filter(
      (p) =>
        !p.isSeparator &&
        p.section === stoppedPart.section &&
        !this.isPartDeleted(p),
    );
    const idx = sectionParts.findIndex((p) => p.order === stoppedPart.order);
    if (idx < 0 || idx >= sectionParts.length - 1) return;
    const next = sectionParts[idx + 1];
    if (this.plugin.timerEngine.get(this.weekKey, next.order).status !== "idle")
      return;
    this.plugin.timerEngine.start(this.weekKey, next.order);
    this.updateCardByOrder(next);
    this.updateMeetingBar();
  }

  handleReset(part: MeetingPart): void {
    this.plugin.timerEngine.reset(this.weekKey, part.order);
    this.firedAlerts.delete(part.order);
    if (part.hasAdvice) {
      this.plugin.timerEngine.reset(this.weekKey, this.adviceOrder(part.order));
      this.firedAlerts.delete(this.adviceOrder(part.order));
      this.updateAdviceCard(part);
    }
    // Clear the part's note from storage and DOM
    const noteKey = `${this.weekKey}:${part.order}`;
    const curr = this.plugin.getPartOverride(noteKey);
    if (curr?.note !== undefined) {
      this.plugin.setPartOverride(noteKey, { ...curr, note: undefined });
      const card = this.cards.get(part.order);
      if (card) {
        const textarea =
          card.cardEl.querySelector<HTMLTextAreaElement>(".jw-timer-note");
        const preview = card.cardEl.querySelector<HTMLElement>(
          ".jw-timer-note-preview",
        );
        if (textarea) {
          textarea.value = "";
          textarea.style.height = "";
          textarea.style.display = "";
        }
        if (preview) {
          preview.empty();
          preview.style.display = "none";
        }
      }
    }
    this.updateCardByOrder(part);
    this.updateMeetingBar();
    this.plugin.persistTimers().catch(console.error);
  }

  // ─── Tick & display update ───────────────────────────────────────────────────────────────────

  private tick(): void {
    if (document.hidden) return;
    if (!this.schedule) return;
    // Fast path: skip all DOM work when no timer is running.
    if (!this.plugin.timerEngine.hasAnyRunning()) return;
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
        const aSnap = this.plugin.timerEngine.get(
          this.weekKey,
          this.adviceOrder(part.order),
        );
        if (aSnap.status === "running") {
          this.updateAdviceCard(part);
          anyRunning = true;
          if (aSnap.elapsedMs >= 60_000)
            this.fireAlert(this.adviceOrder(part.order));
        }
      }
    }
    if (anyRunning) this.updateMeetingBar();
  }

  /** Fire a one-shot overtime alert (sound and/or vibration) for the given slot. */
  private fireAlert(slotOrder: number): void {
    if (this.firedAlerts.has(slotOrder)) return;
    this.firedAlerts.add(slotOrder);
    const { alertSound, alertSoundSec, alertVibrate, alertVibrateSec } =
      this.plugin.settings;
    if (alertSound) this.playBeep(alertSoundSec);
    if (alertVibrate && "vibrate" in navigator) {
      try {
        // Phone-ring pattern: two short bursts per second, repeated for
        // alertVibrateSec seconds.  Each 1 000 ms cycle = 250 ms buzz +
        // 100 ms pause + 250 ms buzz + 400 ms silence.
        // Single-number vibrate() calls are used instead of a pattern array
        // because Android WebView only reliably honours the first element of
        // a pattern array passed to navigator.vibrate().
        const BUZZ = 250;
        const PAUSE = 100;
        const CYCLE = 1000; // total cycle length in ms
        const rings = Math.max(1, alertVibrateSec); // 1 ring per second
        let ring = 0;
        const doRing = () => {
          navigator.vibrate(BUZZ);
          window.setTimeout(() => navigator.vibrate(BUZZ), BUZZ + PAUSE);
          ring++;
          if (ring < rings) window.setTimeout(doRing, CYCLE);
        };
        doRing();
      } catch {
        /* unsupported */
      }
    }
  }

  /** Synthesise a repeating beep using the Web Audio API for the given duration. */
  private playBeep(durationSec: number): void {
    try {
      if (!this.audioCtx || this.audioCtx.state === "closed") {
        this.audioCtx = new AudioContext();
      }
      const ctx = this.audioCtx;
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
    } catch {
      // AudioContext unavailable — silently ignore
    }
  }

  updateMeetingBar(): void {
    if (!this.schedule || this.totalTimedMs === 0) return;
    let elapsedMs = 0;
    for (const part of this.buildMergedParts()) {
      if (part.isSeparator || this.isPartDeleted(part)) continue;
      const ep = this.getEffectivePart(part);
      elapsedMs += this.plugin.timerEngine.get(
        this.weekKey,
        part.order,
      ).elapsedMs;
      if (ep.hasAdvice && this.plugin.settings.showAdvice) {
        elapsedMs += this.plugin.timerEngine.get(
          this.weekKey,
          this.adviceOrder(part.order),
        ).elapsedMs;
      }
    }
    const ratio = Math.min(1, elapsedMs / this.totalTimedMs);
    this.meetingBarFillEl.style.width = `${(ratio * 100).toFixed(1)}%`;
    this.meetingBarLabelEl.setText(
      `${formatMmSs(elapsedMs)} / ${formatMmSs(this.totalTimedMs)}`,
    );
  }

  private updateCardByOrder(part: MeetingPart): void {
    const startMinutes = timeToMinutes(this.plugin.settings.meetingStartTime);
    let cursor = startMinutes + this.plugin.settings.openingSongMinutes;
    let scheduledStart = cursor;
    for (const p of this.buildMergedParts()) {
      if (p.isSeparator) {
        cursor += Math.ceil(p.durationSec / 60);
        continue;
      }
      if (p.order === part.order) {
        scheduledStart = cursor;
        break;
      }
      if (!this.isPartDeleted(p)) {
        const ep = this.getEffectivePart(p);
        cursor +=
          Math.ceil(ep.durationSec / 60) +
          (ep.hasAdvice && this.plugin.settings.showAdvice ? 1 : 0);
      }
    }
    this.updateCard(this.getEffectivePart(part), scheduledStart);
  }

  updateCard(part: MeetingPart, scheduledStartMins: number): void {
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
      refs.stoppedAtEl.setText(
        `· ${labels.stopped} ${timestampToHHMM(stoppedAt)}`,
      );
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
    refs.cardEl.setAttribute(
      "data-running",
      status === "running" ? "true" : "false",
    );

    // Play/pause button label
    if (status === "running") {
      refs.playBtn.setText(labels.pause);
      refs.playBtn.setAttr("aria-label", "Pause timer");
    } else {
      refs.playBtn.setText(labels.play);
      refs.playBtn.setAttr(
        "aria-label",
        status === "paused" ? "Resume timer" : "Start timer",
      );
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
      if (ep.hasAdvice)
        this.plugin.timerEngine.reset(
          this.weekKey,
          this.adviceOrder(part.order),
        );
    }
    this.renderSchedule(this.schedule);
    this.updateMeetingBar();
    this.plugin.persistTimers().catch(console.error);
  }

  // ─── Export ───────────────────────────────────────────────────────────────────────────────────

  private buildExportData(): ExportData {
    const sectionOrder: MeetingSection[] = [
      "opening",
      "treasures",
      "ministry",
      "living",
      "closing",
    ];
    const langKey = this.getLang();
    const [openingLabel, closingLabel] = (LOCALE_OPENING_CLOSING[langKey] ?? [
      "Opening",
      "Closing",
    ]) as [string, string];
    const sectionLabels: Record<string, string> = {
      ...SECTION_FALLBACK,
      ...(this.schedule?.sectionLabels ?? {}),
      opening: openingLabel,
      closing: closingLabel,
    };

    const allParts = this.buildMergedParts();
    const sections = sectionOrder
      .map((key) => {
        const rows = allParts
          .filter(
            (p) =>
              p.section === key && !p.isSeparator && !this.isPartDeleted(p),
          )
          .map((p) => {
            const ep = this.getEffectivePart(p);
            const snap = this.plugin.timerEngine.get(this.weekKey, p.order);
            const note = this.plugin.getPartOverride(
              `${this.weekKey}:${p.order}`,
            )?.note;
            return {
              label: ep.label,
              durationSec: ep.durationSec,
              elapsedMs: snap.elapsedMs,
              status: snap.status,
              note,
            };
          });
        return { key, label: sectionLabels[key] ?? key, rows };
      })
      .filter((s) => s.rows.length > 0);

    return {
      weekLabel: this.schedule?.weekLabel ?? this.weekKey,
      meetingStartTime: this.plugin.settings.meetingStartTime,
      sections,
    };
  }

  // ─── Advice card ─────────────────────────────────────────────────────────────────────────────
  // renderAdviceCard is implemented in ./ui/card-renderer.ts and called from renderCard.

  handleAdvicePlayPause(part: MeetingPart): void {
    const aOrder = this.adviceOrder(part.order);
    const snap = this.plugin.timerEngine.get(this.weekKey, aOrder);
    if (snap.status === "running") {
      this.plugin.timerEngine.pause(this.weekKey, aOrder);
      this.plugin.persistTimers().catch(console.error);
      if (this.plugin.settings.autoNextPart) this.autoStartNextInSection(part);
    } else {
      this.plugin.timerEngine.start(this.weekKey, aOrder);
    }
    this.updateAdviceCard(part);
    this.updateMeetingBar();
  }

  handleAdviceReset(part: MeetingPart): void {
    this.plugin.timerEngine.reset(this.weekKey, this.adviceOrder(part.order));
    this.updateAdviceCard(part);
    this.updateMeetingBar();
    this.plugin.persistTimers().catch(console.error);
  }

  updateAdviceCard(part: MeetingPart): void {
    const refs = this.adviceCards.get(part.order);
    if (!refs) return;
    const labels = this.getLabels();
    const ADVICE_SEC = 60;
    const snap = this.plugin.timerEngine.get(
      this.weekKey,
      this.adviceOrder(part.order),
    );
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
    refs.cardEl.setAttribute(
      "data-running",
      status === "running" ? "true" : "false",
    );

    refs.playBtn.setText(status === "running" ? labels.pause : labels.play);
  }
}
