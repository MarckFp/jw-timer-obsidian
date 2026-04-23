import type { TimerSnapshot } from "../timer-engine";

// ─── Card DOM references ───────────────────────────────────────────────────────

export interface CardRefs {
  cardEl: HTMLElement;
  elapsedEl: HTMLElement;
  endTimeEl: HTMLElement;
  stoppedAtEl: HTMLElement;
  deltaEl: HTMLElement;
  playBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  barFillEl: HTMLElement;
}

// ─── Timer color state ────────────────────────────────────────────────────────

export type TimerColorState = "idle" | "ok" | "warn" | "over";

export const WARN_THRESHOLD = 0.9;

export function colorState(
  elapsedMs: number,
  durationSec: number,
  status: TimerSnapshot["status"],
): TimerColorState {
  if (status === "idle") return "idle";
  const ratio = elapsedMs / (durationSec * 1000);
  if (ratio > 1) return "over";
  if (ratio >= WARN_THRESHOLD) return "warn";
  return "ok";
}

// ─── Time/date formatting ──────────────────────────────────────────────────────

export function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timestampToHHMM(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Number of ISO weeks in a year (52 or 53). Dec 28 is always in the last ISO week. */
export function isoWeeksInYear(year: number): number {
  const d = new Date(Date.UTC(year, 11, 28));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
