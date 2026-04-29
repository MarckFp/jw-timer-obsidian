import { App, Modal } from "obsidian";
import type { MeetingPart, MeetingSection } from "../types";
import type { UiLabels } from "./locale";

// ─── Edit-part modal ───────────────────────────────────────────────────────────

export class EditPartModal extends Modal {
  private focusHandle: number | null = null;

  constructor(
    app: App,
    private readonly part: MeetingPart,
    private readonly labels: UiLabels,
    private readonly onSave: (
      label: string,
      durationSec: number,
      hasAdvice: boolean,
    ) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", {
      cls: "jw-timer-edit-title",
      text: this.labels.editModal,
    });
    const form = contentEl.createDiv({ cls: "jw-timer-edit-form" });

    const labelRow = form.createDiv({ cls: "jw-timer-edit-row" });
    labelRow.createEl("label", {
      cls: "jw-timer-edit-label",
      text: this.labels.fieldTitle,
    });
    const labelInput = labelRow.createEl("input", {
      cls: "jw-timer-edit-input",
    });
    labelInput.type = "text";
    labelInput.value = this.part.label;

    const durRow = form.createDiv({ cls: "jw-timer-edit-row" });
    durRow.createEl("label", {
      cls: "jw-timer-edit-label",
      text: this.labels.fieldDuration,
    });
    const durInput = durRow.createEl("input", { cls: "jw-timer-edit-input" });
    durInput.type = "number";
    durInput.min = "1";
    durInput.max = "60";
    durInput.value = String(Math.round(this.part.durationSec / 60));

    const durErrorEl = durRow.createEl("div", { cls: "jw-setting-error" });
    durErrorEl.textContent = "Must be between 1 and 60 minutes.";
    durErrorEl.style.display = "none";
    durInput.addEventListener("input", () => {
      const n = parseInt(durInput.value, 10);
      const valid = !isNaN(n) && n >= 1 && n <= 60;
      const nonEmpty = durInput.value.trim().length > 0;
      durErrorEl.style.display = !valid && nonEmpty ? "" : "none";
      if (!valid && nonEmpty) durInput.setAttribute("aria-invalid", "true");
      else durInput.removeAttribute("aria-invalid");
    });

    const adviceRow = form.createDiv({
      cls: "jw-timer-edit-row jw-timer-edit-row--checkbox",
    });
    const adviceInput = adviceRow.createEl("input", {
      cls: "jw-timer-edit-checkbox",
    });
    adviceInput.type = "checkbox";
    adviceInput.id = "jw-edit-part-advice";
    adviceInput.checked = this.part.hasAdvice ?? false;
    const adviceLabel = adviceRow.createEl("label", {
      cls: "jw-timer-edit-label",
      text: this.labels.fieldAdvice,
    });
    adviceLabel.setAttr("for", "jw-edit-part-advice");

    const footer = contentEl.createDiv({ cls: "jw-timer-edit-footer" });
    const saveBtn = footer.createEl("button", {
      cls: "mod-cta",
      text: this.labels.saveBtn,
    });
    saveBtn.addEventListener("click", () => {
      const newLabel = labelInput.value.trim() || this.part.label;
      const n = parseInt(durInput.value, 10);
      if (isNaN(n) || n < 1 || n > 60) {
        durErrorEl.style.display = "";
        durInput.setAttribute("aria-invalid", "true");
        durInput.focus();
        return;
      }
      this.onSave(newLabel, n * 60, adviceInput.checked);
      this.close();
    });
    [labelInput, durInput].forEach((el) =>
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveBtn.click();
      }),
    );
    this.focusHandle = window.setTimeout(() => labelInput.focus(), 50);
  }

  onClose(): void {
    if (this.focusHandle !== null) {
      window.clearTimeout(this.focusHandle);
      this.focusHandle = null;
    }
    this.contentEl.empty();
  }
}

// ─── Add-part modal ────────────────────────────────────────────────────────────

export class AddPartModal extends Modal {
  private focusHandle: number | null = null;

  constructor(
    app: App,
    private readonly sectionLabels: Record<string, string>,
    private readonly labels: UiLabels,
    private readonly onSave: (
      label: string,
      durationSec: number,
      section: MeetingSection,
      hasAdvice: boolean,
    ) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", {
      cls: "jw-timer-edit-title",
      text: this.labels.newStopwatch,
    });
    const form = contentEl.createDiv({ cls: "jw-timer-edit-form" });

    const labelRow = form.createDiv({ cls: "jw-timer-edit-row" });
    labelRow.createEl("label", {
      cls: "jw-timer-edit-label",
      text: this.labels.fieldTitle,
    });
    const labelInput = labelRow.createEl("input", {
      cls: "jw-timer-edit-input",
    });
    labelInput.type = "text";
    labelInput.placeholder = this.labels.placeholder;

    const labelErrorEl = labelRow.createEl("div", { cls: "jw-setting-error" });
    labelErrorEl.textContent = "Title is required.";
    labelErrorEl.style.display = "none";
    labelInput.addEventListener("input", () => {
      if (labelInput.value.trim()) {
        labelErrorEl.style.display = "none";
        labelInput.removeAttribute("aria-invalid");
      }
    });

    const durRow = form.createDiv({ cls: "jw-timer-edit-row" });
    durRow.createEl("label", {
      cls: "jw-timer-edit-label",
      text: this.labels.fieldDuration,
    });
    const durInput = durRow.createEl("input", { cls: "jw-timer-edit-input" });
    durInput.type = "number";
    durInput.min = "1";
    durInput.max = "60";
    durInput.value = "5";

    const durErrorEl = durRow.createEl("div", { cls: "jw-setting-error" });
    durErrorEl.textContent = "Must be between 1 and 60 minutes.";
    durErrorEl.style.display = "none";
    durInput.addEventListener("input", () => {
      const n = parseInt(durInput.value, 10);
      const valid = !isNaN(n) && n >= 1 && n <= 60;
      const nonEmpty = durInput.value.trim().length > 0;
      durErrorEl.style.display = !valid && nonEmpty ? "" : "none";
      if (!valid && nonEmpty) durInput.setAttribute("aria-invalid", "true");
      else durInput.removeAttribute("aria-invalid");
    });

    const sectionRow = form.createDiv({ cls: "jw-timer-edit-row" });
    sectionRow.createEl("label", {
      cls: "jw-timer-edit-label",
      text: this.labels.fieldSection,
    });
    const sectionSelect = sectionRow.createEl("select", {
      cls: "jw-timer-edit-input",
    });
    const sectionOrder: MeetingSection[] = [
      "opening",
      "treasures",
      "ministry",
      "living",
      "closing",
    ];
    for (const key of sectionOrder) {
      const opt = sectionSelect.createEl("option");
      opt.value = key;
      opt.text = this.sectionLabels[key] ?? key;
    }
    sectionSelect.value = "ministry";

    const adviceRow = form.createDiv({
      cls: "jw-timer-edit-row jw-timer-edit-row--checkbox",
    });
    const adviceInput = adviceRow.createEl("input", {
      cls: "jw-timer-edit-checkbox",
    });
    adviceInput.type = "checkbox";
    adviceInput.id = "jw-add-part-advice";
    const adviceLabel = adviceRow.createEl("label", {
      cls: "jw-timer-edit-label",
      text: this.labels.fieldAdvice,
    });
    adviceLabel.setAttr("for", "jw-add-part-advice");

    const footer = contentEl.createDiv({ cls: "jw-timer-edit-footer" });
    const saveBtn = footer.createEl("button", {
      cls: "mod-cta",
      text: this.labels.addBtn,
    });
    saveBtn.addEventListener("click", () => {
      const newLabel = labelInput.value.trim();
      if (!newLabel) {
        labelErrorEl.style.display = "";
        labelInput.setAttribute("aria-invalid", "true");
        labelInput.focus();
        return;
      }
      const n = parseInt(durInput.value, 10);
      if (isNaN(n) || n < 1 || n > 60) {
        durErrorEl.style.display = "";
        durInput.setAttribute("aria-invalid", "true");
        durInput.focus();
        return;
      }
      this.onSave(
        newLabel,
        n * 60,
        sectionSelect.value as MeetingSection,
        adviceInput.checked,
      );
      this.close();
    });
    labelInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveBtn.click();
    });
    this.focusHandle = window.setTimeout(() => labelInput.focus(), 50);
  }

  onClose(): void {
    if (this.focusHandle !== null) {
      window.clearTimeout(this.focusHandle);
      this.focusHandle = null;
    }
    this.contentEl.empty();
  }
}

// ─── Share modal (mobile fallback) ────────────────────────────────────────────

/**
 * Shown on mobile when navigator.share is unavailable.
 * Displays the export text in a full-height textarea with a copy button.
 * The user can also tap "Select All" → "Share" to send via any app.
 */
export class ShareModal extends Modal {
  constructor(
    app: App,
    private readonly text: string,
    private readonly labels: UiLabels,
    private readonly onCopied: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("jw-share-modal");

    contentEl.createEl("h3", {
      cls: "jw-share-modal-title",
      text: this.labels.shareBtn,
    });

    contentEl.createEl("p", {
      cls: "jw-share-modal-hint",
      text: 'Tap and hold → "Select All" → "Share" to send via any app.',
    });

    const ta = contentEl.createEl("textarea", { cls: "jw-share-modal-text" });
    ta.value = this.text;
    ta.readOnly = true;
    ta.rows = 12;

    const footer = contentEl.createDiv({ cls: "jw-share-modal-footer" });
    const copyBtn = footer.createEl("button", {
      cls: "mod-cta",
      text: this.labels.copyOk,
    });
    copyBtn.addEventListener("click", () => {
      void navigator.clipboard.writeText(this.text).catch(() => {
        ta.select();
        document.execCommand("copy");
      });
      this.onCopied();
      this.close();
    });

    // Auto-select all text so the OS share handle appears immediately
    window.requestAnimationFrame(() => ta.select());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
