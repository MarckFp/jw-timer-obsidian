import { App, setIcon } from "obsidian";
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
  /** Render `text` as Markdown into `el`, replacing its current content. */
  renderMarkdown(text: string, el: HTMLElement): void;
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

  // Title + allotted minutes + gear (context) button
  const header = card.createDiv({ cls: "jw-timer-card-header" });
  header.createDiv({ cls: "jw-timer-card-title", text: part.label });
  header.createDiv({
    cls: "jw-timer-card-allotted",
    text: `${Math.round(part.durationSec / 60)} min`,
  });
  const gearBtn = header.createEl("button", { cls: "jw-timer-gear-btn" });
  setIcon(gearBtn, "ellipsis-vertical");
  gearBtn.setAttr("aria-label", "Edit, move or delete this part");
  gearBtn.setAttr("tabindex", "0");

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
  if (ctx.plugin.settings.showNotes) {
    const noteKey = `${ctx.weekKey}:${part.order}`;
    const existingNote = ctx.plugin.getPartOverride(noteKey)?.note ?? "";

    const noteWrap = card.createDiv({ cls: "jw-timer-note-wrap" });
    const noteEl = noteWrap.createEl("textarea", { cls: "jw-timer-note" });
    const previewEl = noteWrap.createDiv({ cls: "jw-timer-note-preview" });

    noteEl.placeholder = labels.notePlaceholder;
    noteEl.rows = 1;
    noteEl.value = existingNote;

    // Render markdown preview and hide the textarea
    const activatePreview = (text: string) => {
      previewEl.empty();
      ctx.renderMarkdown(text, previewEl);
      previewEl.style.display = "";
      noteEl.style.display = "none";
    };

    // Show textarea and hide the preview
    const activateEdit = () => {
      previewEl.style.display = "none";
      noteEl.style.display = "";
      window.requestAnimationFrame(() => {
        noteEl.style.height = "auto";
        noteEl.style.height = `${noteEl.scrollHeight}px`;
        noteEl.focus();
      });
    };

    // Initial state: show preview if there is saved content, else textarea
    if (existingNote) {
      activatePreview(existingNote);
    } else {
      previewEl.style.display = "none";
    }

    // Clicking the preview switches to edit
    previewEl.setAttribute("role", "button");
    previewEl.setAttribute("tabindex", "0");
    previewEl.setAttribute("aria-label", "Edit note");
    previewEl.addEventListener("click", () => activateEdit());
    previewEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activateEdit();
      }
    });

    // Blurring textarea with content switches to preview
    noteEl.addEventListener("blur", () => {
      const val = noteEl.value.trim();
      if (val) activatePreview(val);
    });

    let noteDebounce: number | null = null;
    noteEl.addEventListener("input", () => {
      noteEl.style.height = "auto";
      noteEl.style.height = `${noteEl.scrollHeight}px`;
      if (noteDebounce !== null) window.clearTimeout(noteDebounce);
      noteDebounce = window.setTimeout(() => {
        noteDebounce = null;
        const val = noteEl.value.trim();
        const curr = ctx.plugin.getPartOverride(noteKey) ?? {};
        ctx.plugin.setPartOverride(noteKey, {
          ...curr,
          note: val || undefined,
        });
        ctx.plugin.persistTimers().catch(console.error);
      }, 400);
    });
  }

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

  // ─── Open overlay (gear button tap/click + right-click on desktop) ────────────────
  const openOverlay = () => {
    if (ctx.activeOverlay && ctx.activeOverlay !== overlay) {
      ctx.activeOverlay.removeClass("jw-timer-card-overlay--visible");
    }
    ctx.activeOverlay = overlay;
    overlay.addClass("jw-timer-card-overlay--visible");
  };

  gearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openOverlay();
  });

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
        ctx.plugin.persistTimers().catch(console.error);
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
    ctx.plugin.persistTimers().catch(console.error);
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
