import { App } from "obsidian";
import type JwTimerPlugin from "../main";
import type { MeetingPart, WeeklySchedule } from "../types";
import type { UiLabels } from "./locale";
import type { CardRefs } from "./helpers";
import { minutesToTime } from "./helpers";
import { EditPartModal } from "./modals";

/**
 * Minimal interface that JwTimerView satisfies, consumed by the card renderer.
 * Keeping this thin avoids tight coupling while still enabling the DOM logic to
 * live outside view.ts.
 */
export interface CardController {
  readonly app: App;
  readonly plugin: JwTimerPlugin;
  readonly weekKey: string;
  readonly cards: Map<number, CardRefs>;
  readonly adviceCards: Map<number, CardRefs>;
  readonly schedule: WeeklySchedule | null;
  /** Currently visible long-press overlay element, if any. */
  activeOverlay: HTMLElement | null;
  getLabels(): UiLabels;
  armReset(btn: HTMLButtonElement, onConfirm: () => void): void;
  handlePlayPause(part: MeetingPart): void;
  handleReset(part: MeetingPart): void;
  handleAdvicePlayPause(part: MeetingPart): void;
  handleAdviceReset(part: MeetingPart): void;
  updateCard(part: MeetingPart, scheduledStartMins: number): void;
  updateAdviceCard(part: MeetingPart): void;
  movePartInSection(part: MeetingPart, delta: -1 | 1): void;
  renderSchedule(schedule: WeeklySchedule): void;
  updateMeetingBar(): void;
}

/** Build the DOM for one programme-part timer card and register it in ctx.cards. */
export function renderCard(
  ctx: CardController,
  parentEl: HTMLElement,
  part: MeetingPart,
  scheduledStartMins: number,
): void {
  const labels = ctx.getLabels();
  const card = parentEl.createDiv({ cls: "jw-timer-card" });
  card.setAttribute("data-state", "idle");
  card.setAttribute("data-running", "false");

  // Title + allotted minutes
  const header = card.createDiv({ cls: "jw-timer-card-header" });
  header.createDiv({ cls: "jw-timer-card-title", text: part.label });
  header.createDiv({
    cls: "jw-timer-card-allotted",
    text: `${Math.round(part.durationSec / 60)} min`,
  });

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
  const elapsedEl = clockRow.createDiv({
    cls: "jw-timer-elapsed",
    text: "00:00",
  });

  // Controls
  const controls = card.createDiv({ cls: "jw-timer-controls" });
  const playBtn = controls.createEl("button", {
    cls: "jw-timer-btn jw-timer-btn-play",
    text: labels.play,
  });
  playBtn.setAttr("aria-label", "Start timer");
  const resetBtn = controls.createEl("button", {
    cls: "jw-timer-btn jw-timer-btn-reset",
    text: labels.reset,
  });
  resetBtn.setAttr("aria-label", "Reset timer");

  playBtn.addEventListener("click", () => ctx.handlePlayPause(part));
  resetBtn.addEventListener("click", () =>
    ctx.armReset(resetBtn, () => ctx.handleReset(part)),
  );

  // Suppress unused-var warning
  void endTimeEl;

  ctx.cards.set(part.order, {
    cardEl: card,
    elapsedEl,
    endTimeEl,
    stoppedAtEl,
    deltaEl,
    playBtn,
    resetBtn,
    barFillEl,
  });
  ctx.updateCard(part, scheduledStartMins);

  // ─── Per-part note ───────────────────────────────────────────────────────────
  const noteKey = `${ctx.weekKey}:${part.order}`;
  const existingNote = ctx.plugin.getPartOverride(noteKey)?.note ?? "";
  const noteEl = card.createEl("textarea", { cls: "jw-timer-note" });
  noteEl.placeholder = labels.notePlaceholder;
  noteEl.rows = 1;
  noteEl.value = existingNote;
  if (existingNote) {
    // Resize to fit saved content on initial render
    window.requestAnimationFrame(() => {
      noteEl.style.height = "auto";
      noteEl.style.height = `${noteEl.scrollHeight}px`;
    });
  }
  let noteDebounce: number | null = null;
  noteEl.addEventListener("input", () => {
    noteEl.style.height = "auto";
    noteEl.style.height = `${noteEl.scrollHeight}px`;
    if (noteDebounce !== null) window.clearTimeout(noteDebounce);
    noteDebounce = window.setTimeout(() => {
      noteDebounce = null;
      const val = noteEl.value.trim();
      const curr = ctx.plugin.getPartOverride(noteKey) ?? {};
      ctx.plugin.setPartOverride(noteKey, { ...curr, note: val || undefined });
      void ctx.plugin.persistTimers();
    }, 400);
  });

  // Advice sub-card for parts with instructor feedback (Bible reading + ministry parts)
  if (part.hasAdvice && ctx.plugin.settings.showAdvice)
    renderAdviceCard(ctx, parentEl, part);

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
    if ((e.target as HTMLElement).closest("button, .jw-timer-card-overlay"))
      return;
    pressStartX = e.clientX;
    pressStartY = e.clientY;
    card.style.touchAction = "none";
    card.addClass("jw-timer-card--pressing");
    longPressTimer = window.setTimeout(() => {
      longPressTimer = null;
      card.style.touchAction = "";
      card.removeClass("jw-timer-card--pressing");
      if (ctx.activeOverlay && ctx.activeOverlay !== overlay) {
        ctx.activeOverlay.removeClass("jw-timer-card-overlay--visible");
      }
      ctx.activeOverlay = overlay;
      overlay.addClass("jw-timer-card-overlay--visible");
    }, 1000);
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
      if (ctx.activeOverlay === overlay) ctx.activeOverlay = null;
    }
  });
  editBtn.addEventListener("click", () => {
    overlay.removeClass("jw-timer-card-overlay--visible");
    if (ctx.activeOverlay === overlay) ctx.activeOverlay = null;
    new EditPartModal(
      ctx.app,
      part,
      labels,
      (newLabel, newDurationSec, newHasAdvice) => {
        if (part.isCustom) {
          ctx.plugin.updateCustomPart(ctx.weekKey, part.order, {
            label: newLabel,
            durationSec: newDurationSec,
            hasAdvice: newHasAdvice || undefined,
          });
        } else {
          ctx.plugin.setPartOverride(`${ctx.weekKey}:${part.order}`, {
            label: newLabel,
            durationSec: newDurationSec,
            hasAdvice: newHasAdvice,
          });
        }
        void ctx.plugin.persistTimers();
        ctx.renderSchedule(ctx.schedule!);
        ctx.updateMeetingBar();
      },
    ).open();
  });
  moveUpBtn.addEventListener("click", () => {
    overlay.removeClass("jw-timer-card-overlay--visible");
    if (ctx.activeOverlay === overlay) ctx.activeOverlay = null;
    ctx.movePartInSection(part, -1);
  });
  moveDownBtn.addEventListener("click", () => {
    overlay.removeClass("jw-timer-card-overlay--visible");
    if (ctx.activeOverlay === overlay) ctx.activeOverlay = null;
    ctx.movePartInSection(part, 1);
  });
  deleteBtn.addEventListener("click", () => {
    overlay.removeClass("jw-timer-card-overlay--visible");
    if (ctx.activeOverlay === overlay) ctx.activeOverlay = null;
    if (part.isCustom) {
      ctx.plugin.removeCustomPart(ctx.weekKey, part.order);
    } else {
      ctx.plugin.setPartOverride(`${ctx.weekKey}:${part.order}`, {
        deleted: true,
      });
    }
    void ctx.plugin.persistTimers();
    ctx.renderSchedule(ctx.schedule!);
    ctx.updateMeetingBar();
  });
}

/** Build the DOM for a 1-minute advice sub-card and register it in ctx.adviceCards. */
export function renderAdviceCard(
  ctx: CardController,
  parentEl: HTMLElement,
  part: MeetingPart,
): void {
  const labels = ctx.getLabels();
  const card = parentEl.createDiv({
    cls: "jw-timer-card jw-timer-card--advice",
  });
  card.setAttribute("data-state", "idle");
  card.setAttribute("data-running", "false");

  // Badge: arrow icon + label
  const badge = card.createDiv({ cls: "jw-timer-advice-badge" });
  badge.createSpan({ cls: "jw-timer-advice-icon", text: "↳" });
  badge.createSpan({
    cls: "jw-timer-advice-label",
    text: `${labels.advice} · 1 min`,
  });

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
  const elapsedEl = clockRow.createDiv({
    cls: "jw-timer-elapsed jw-timer-elapsed--advice",
    text: "00:00",
  });

  // Controls
  const controls = card.createDiv({ cls: "jw-timer-controls" });
  const playBtn = controls.createEl("button", {
    cls: "jw-timer-btn jw-timer-btn-play",
    text: labels.play,
  });
  playBtn.setAttr("aria-label", "Start advice timer");
  const resetBtn = controls.createEl("button", {
    cls: "jw-timer-btn jw-timer-btn-reset",
    text: labels.reset,
  });
  resetBtn.setAttr("aria-label", "Reset advice timer");

  playBtn.addEventListener("click", () => ctx.handleAdvicePlayPause(part));
  resetBtn.addEventListener("click", () =>
    ctx.armReset(resetBtn, () => ctx.handleAdviceReset(part)),
  );

  const deltaEl = card.createDiv({ cls: "jw-timer-delta" });
  deltaEl.style.display = "none";

  ctx.adviceCards.set(part.order, {
    cardEl: card,
    elapsedEl,
    endTimeEl,
    stoppedAtEl,
    deltaEl,
    playBtn,
    resetBtn,
    barFillEl,
  });
  ctx.updateAdviceCard(part);
}
