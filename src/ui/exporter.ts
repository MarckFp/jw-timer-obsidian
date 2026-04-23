import { formatMmSs } from "./helpers";

// ─── Data model ───────────────────────────────────────────────────────────────

export interface ExportRow {
  label: string;
  /** Allotted duration in seconds */
  durationSec: number;
  /** Elapsed ms (0 when idle) */
  elapsedMs: number;
  status: "idle" | "running" | "paused";
  /** Optional free-text note */
  note?: string;
}

export interface ExportSection {
  key: string;
  label: string;
  rows: ExportRow[];
}

export interface ExportData {
  weekLabel: string;
  meetingStartTime: string;
  sections: ExportSection[];
}

// ─── Plain-text builder ───────────────────────────────────────────────────────

const SECTION_EMOJI: Record<string, string> = {
  opening: "🎵",
  treasures: "📖",
  ministry: "📣",
  living: "🏠",
  closing: "🙏",
};

function statusSymbol(row: ExportRow): string {
  if (row.status === "idle") return "—";
  const over = row.elapsedMs > row.durationSec * 1000;
  return over ? "⚠" : "✓";
}

export function buildExportText(data: ExportData): string {
  const lines: string[] = [];

  lines.push(`⏱ JW Meeting Timer`);
  lines.push(data.weekLabel);
  lines.push(`🕐 ${data.meetingStartTime}`);

  for (const section of data.sections) {
    if (!section.rows.length) continue;
    const emoji = SECTION_EMOJI[section.key] ?? "📋";
    lines.push("");
    lines.push(`${emoji} ${section.label.toUpperCase()}`);

    for (const row of section.rows) {
      const allotted = `${Math.round(row.durationSec / 60)} min`;
      if (row.status === "idle") {
        lines.push(`  • ${row.label} (${allotted})`);
      } else {
        const elapsed = formatMmSs(row.elapsedMs);
        const sym = statusSymbol(row);
        lines.push(`  • ${row.label} (${allotted}) → ${elapsed} ${sym}`);
      }
      if (row.note) lines.push(`    📝 ${row.note}`);
    }
  }

  return lines.join("\n");
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Share text via the Web Share API (mobile).
 * Falls back to clipboard on desktop. Shows a brief toast on success.
 */
export async function shareText(
  text: string,
  copyOk: string,
  toastEl: HTMLElement,
): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      // User cancelled or API failed — fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast(toastEl, copyOk);
  } catch {
    // Last resort: select a textarea
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast(toastEl, copyOk);
  }
}

function showToast(el: HTMLElement, message: string): void {
  el.setText(message);
  el.addClass("jw-timer-toast--visible");
  window.setTimeout(() => el.removeClass("jw-timer-toast--visible"), 2500);
}
