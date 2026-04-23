// ─── Domain types ─────────────────────────────────────────────────────────────

export interface MeetingPart {
  /** Display label (e.g. "1. How Much Are You Willing to Pay?") */
  label: string;
  /** Section this part belongs to */
  section: MeetingSection;
  /** Allowed duration in seconds */
  durationSec: number;
  /** Order within the full meeting programme */
  order: number;
  /** If true, this part has no stopwatch — its duration is only used for schedule timing (e.g. song) */
  isSeparator?: boolean;
  /** If true, a secondary 1-minute instructor-advice stopwatch is shown below this part's card */
  hasAdvice?: boolean;
}

export type MeetingSection =
  | "opening"
  | "treasures"
  | "ministry"
  | "living"
  | "closing";

export interface WeeklySchedule {
  /** ISO week label, e.g. "April 20-26" */
  weekLabel: string;
  /** Year */
  year: number;
  /** ISO week number (1-53) */
  weekNumber: number;
  parts: MeetingPart[];
  /** When this data was fetched (ms since epoch) */
  fetchedAt: number;
  /** Scraped h2 section headings in the page language (optional — absent in old cache entries) */
  sectionLabels?: Partial<Record<MeetingSection, string>>;
}

// ─── Timer state ──────────────────────────────────────────────────────────────

export interface TimerState {
  partOrder: number;
  /** Accumulated elapsed ms (when paused) */
  elapsedMs: number;
  running: boolean;
  /** Date.now() when the last start happened */
  startedAt: number | null;
  /** Date.now() when the timer was last paused (null if never paused or currently running) */
  stoppedAt?: number | null;
}

// ─── Persisted plugin data ────────────────────────────────────────────────────

export interface PartOverride {
  /** Replacement label, if the user edited it */
  label?: string;
  /** Replacement duration in seconds, if the user edited it */
  durationSec?: number;
  /** If true the card is hidden until Reset All or re-scrape */
  deleted?: boolean;
}

export interface PluginData {
  settings: PluginSettings;
  /** Cached schedule, keyed by "YYYY-WW" */
  scheduleCache: Record<string, WeeklySchedule>;
  /** Timer states, keyed by "YYYY-WW:partOrder" */
  timerStates: Record<string, TimerState>;
  /** Per-part user overrides, keyed by "weekKey:partOrder" */
  partOverrides: Record<string, PartOverride>;
}

export interface PluginSettings {
  /** WOL language locale, e.g. "r1/lp-e" (English) or "r4/lp-s" (Spanish) */
  wolLocale: string;
  /** Meeting start time, HH:MM 24h format, e.g. "20:00" */
  meetingStartTime: string;
  /** Minutes for opening song + prayer before first programme part */
  openingSongMinutes: number;
  /** Play a beep sound when a timer reaches its allotted duration */
  alertSound: boolean;
  /** Duration of the sound alert in seconds */
  alertSoundSec: number;
  /** Trigger device vibration when a timer reaches its allotted duration (mobile only) */
  alertVibrate: boolean;
  /** Duration of the vibration alert in seconds */
  alertVibrateSec: number;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  wolLocale: "r1/lp-e",
  meetingStartTime: "20:00",
  openingSongMinutes: 5,
  alertSound: false,
  alertSoundSec: 1,
  alertVibrate: false,
  alertVibrateSec: 5,
};
