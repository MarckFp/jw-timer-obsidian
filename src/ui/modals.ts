import { App, Modal } from "obsidian";
import type { MeetingPart, MeetingSection } from "../types";
import type { UiLabels } from "./locale";

// ─── Edit-part modal ───────────────────────────────────────────────────────────

export class EditPartModal extends Modal {
  constructor(
    app: App,
    private readonly part: MeetingPart,
    private readonly labels: UiLabels,
    private readonly onSave: (label: string, durationSec: number, hasAdvice: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { cls: "jw-timer-edit-title", text: this.labels.editModal });
    const form = contentEl.createDiv({ cls: "jw-timer-edit-form" });

    const labelRow = form.createDiv({ cls: "jw-timer-edit-row" });
    labelRow.createEl("label", { cls: "jw-timer-edit-label", text: this.labels.fieldTitle });
    const labelInput = labelRow.createEl("input", { cls: "jw-timer-edit-input" });
    labelInput.type = "text";
    labelInput.value = this.part.label;

    const durRow = form.createDiv({ cls: "jw-timer-edit-row" });
    durRow.createEl("label", { cls: "jw-timer-edit-label", text: this.labels.fieldDuration });
    const durInput = durRow.createEl("input", { cls: "jw-timer-edit-input" });
    durInput.type = "number";
    durInput.min = "1";
    durInput.max = "60";
    durInput.value = String(Math.round(this.part.durationSec / 60));

    const adviceRow = form.createDiv({ cls: "jw-timer-edit-row jw-timer-edit-row--checkbox" });
    const adviceInput = adviceRow.createEl("input", { cls: "jw-timer-edit-checkbox" });
    adviceInput.type = "checkbox";
    adviceInput.id = "jw-edit-part-advice";
    adviceInput.checked = this.part.hasAdvice ?? false;
    const adviceLabel = adviceRow.createEl("label", { cls: "jw-timer-edit-label", text: this.labels.fieldAdvice });
    adviceLabel.setAttr("for", "jw-edit-part-advice");

    const footer = contentEl.createDiv({ cls: "jw-timer-edit-footer" });
    const saveBtn = footer.createEl("button", { cls: "mod-cta", text: this.labels.saveBtn });
    saveBtn.addEventListener("click", () => {
      const newLabel = labelInput.value.trim() || this.part.label;
      const newMins = Math.max(1, parseInt(durInput.value, 10) || Math.round(this.part.durationSec / 60));
      this.onSave(newLabel, newMins * 60, adviceInput.checked);
      this.close();
    });
    [labelInput, durInput].forEach((el) =>
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") saveBtn.click(); })
    );
    window.setTimeout(() => labelInput.focus(), 50);
  }

  onClose(): void { this.contentEl.empty(); }
}

// ─── Add-part modal ────────────────────────────────────────────────────────────

export class AddPartModal extends Modal {
  constructor(
    app: App,
    private readonly sectionLabels: Record<string, string>,
    private readonly labels: UiLabels,
    private readonly onSave: (label: string, durationSec: number, section: MeetingSection, hasAdvice: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { cls: "jw-timer-edit-title", text: this.labels.newStopwatch });
    const form = contentEl.createDiv({ cls: "jw-timer-edit-form" });

    const labelRow = form.createDiv({ cls: "jw-timer-edit-row" });
    labelRow.createEl("label", { cls: "jw-timer-edit-label", text: this.labels.fieldTitle });
    const labelInput = labelRow.createEl("input", { cls: "jw-timer-edit-input" });
    labelInput.type = "text";
    labelInput.placeholder = this.labels.placeholder;

    const durRow = form.createDiv({ cls: "jw-timer-edit-row" });
    durRow.createEl("label", { cls: "jw-timer-edit-label", text: this.labels.fieldDuration });
    const durInput = durRow.createEl("input", { cls: "jw-timer-edit-input" });
    durInput.type = "number";
    durInput.min = "1";
    durInput.max = "60";
    durInput.value = "5";

    const sectionRow = form.createDiv({ cls: "jw-timer-edit-row" });
    sectionRow.createEl("label", { cls: "jw-timer-edit-label", text: this.labels.fieldSection });
    const sectionSelect = sectionRow.createEl("select", { cls: "jw-timer-edit-input" });
    const sectionOrder: MeetingSection[] = ["opening", "treasures", "ministry", "living", "closing"];
    for (const key of sectionOrder) {
      const opt = sectionSelect.createEl("option");
      opt.value = key;
      opt.text = this.sectionLabels[key] ?? key;
    }
    sectionSelect.value = "ministry";

    const adviceRow = form.createDiv({ cls: "jw-timer-edit-row jw-timer-edit-row--checkbox" });
    const adviceInput = adviceRow.createEl("input", { cls: "jw-timer-edit-checkbox" });
    adviceInput.type = "checkbox";
    adviceInput.id = "jw-add-part-advice";
    const adviceLabel = adviceRow.createEl("label", { cls: "jw-timer-edit-label", text: this.labels.fieldAdvice });
    adviceLabel.setAttr("for", "jw-add-part-advice");

    const footer = contentEl.createDiv({ cls: "jw-timer-edit-footer" });
    const saveBtn = footer.createEl("button", { cls: "mod-cta", text: this.labels.addBtn });
    saveBtn.addEventListener("click", () => {
      const newLabel = labelInput.value.trim();
      if (!newLabel) { labelInput.focus(); return; }
      const newMins = Math.max(1, parseInt(durInput.value, 10) || 5);
      this.onSave(newLabel, newMins * 60, sectionSelect.value as MeetingSection, adviceInput.checked);
      this.close();
    });
    labelInput.addEventListener("keydown", (e) => { if (e.key === "Enter") saveBtn.click(); });
    window.setTimeout(() => labelInput.focus(), 50);
  }

  onClose(): void { this.contentEl.empty(); }
}
