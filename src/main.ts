import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS } from "./types";
import type {
  PluginSettings,
  PluginData,
  WeeklySchedule,
  TimerState,
  PartOverride,
  MeetingPart,
} from "./types";
import { TimerEngine } from "./timer-engine";
import { JwTimerSettingsTab, detectWolLocale } from "./settings-tab";
import { JwTimerView, VIEW_TYPE_JW_TIMER } from "./view";

// ─── Settings sanitization ───────────────────────────────────────────────────

/**
 * Ensures all settings fields have valid types and values after loading from
 * disk. Guards against schema mismatches that can arise when upgrading between
 * plugin versions.
 */
function sanitizeSettings(s: PluginSettings): PluginSettings {
  const isValidTime = (v: unknown): v is string =>
    typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v);
  const clampInt = (v: unknown, min: number, max: number, def: number): number => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : def;
  };
  const bool = (v: unknown, def: boolean): boolean =>
    typeof v === "boolean" ? v : def;

  return {
    wolLocale:
      typeof s.wolLocale === "string" && s.wolLocale.length > 0
        ? s.wolLocale
        : DEFAULT_SETTINGS.wolLocale,
    meetingStartTime: isValidTime(s.meetingStartTime)
      ? s.meetingStartTime
      : DEFAULT_SETTINGS.meetingStartTime,
    openingSongMinutes: clampInt(s.openingSongMinutes, 1, 15, DEFAULT_SETTINGS.openingSongMinutes),
    alertSound: bool(s.alertSound, DEFAULT_SETTINGS.alertSound),
    alertSoundSec: clampInt(s.alertSoundSec, 1, 10, DEFAULT_SETTINGS.alertSoundSec),
    alertVibrate: bool(s.alertVibrate, DEFAULT_SETTINGS.alertVibrate),
    alertVibrateSec: clampInt(s.alertVibrateSec, 1, 30, DEFAULT_SETTINGS.alertVibrateSec),
    showAdvice: bool(s.showAdvice, DEFAULT_SETTINGS.showAdvice),
    autoNextPart: bool(s.autoNextPart, DEFAULT_SETTINGS.autoNextPart),
    showNotes: bool(s.showNotes, DEFAULT_SETTINGS.showNotes),
  };
}

/**
 * Returns the ms timestamp for the end of the Sunday that closes ISO week `week`
 * of `year` (23:59:59.999 UTC).
 */
function isoWeekEndMs(year: number, week: number): number {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Mon=1 … Sun=7
  // Monday of week 1
  const week1Monday = Date.UTC(year, 0, 4 - (dayOfWeek - 1));
  // Sunday of target week = Monday of week 1 + (week-1)*7 + 6 days
  const sunday = new Date(week1Monday + ((week - 1) * 7 + 6) * 86_400_000);
  sunday.setUTCHours(23, 59, 59, 999);
  return sunday.getTime();
}

export default class JwTimerPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_SETTINGS };
  timerEngine = new TimerEngine();
  partOverrides: Record<string, PartOverride> = {};
  customParts: Record<string, MeetingPart[]> = {};
  private scheduleCache: Record<string, WeeklySchedule> = {};
  private saveHandle: number | null = null;

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async onload(): Promise<void> {
    try {
      await this.loadData_();
    } catch (err) {
      console.error("JW Timer: failed to load saved data, starting with defaults", err);
      this.settings = { ...DEFAULT_SETTINGS, wolLocale: detectWolLocale() };
    }

    this.registerView(
      VIEW_TYPE_JW_TIMER,
      (leaf) => new JwTimerView(leaf, this),
    );

    this.addRibbonIcon(
      "timer",
      "Open JW Meeting Timer",
      () => void this.activateView(),
    );

    this.addCommand({
      id: "open-jw-timer",
      name: "Open JW Meeting Timer sidebar",
      callback: () => void this.activateView(),
    });

    this.addSettingTab(new JwTimerSettingsTab(this.app, this));
  }

  onunload(): void {
    if (this.saveHandle !== null) {
      window.clearTimeout(this.saveHandle);
      this.saveHandle = null;
    }
    this.persistTimers().catch(console.error);
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_JW_TIMER);
  }

  // ─── Settings persistence ───────────────────────────────────────────────────

  async saveSettings(): Promise<void> {
    await this.persistData();
  }

  private async loadData_(): Promise<void> {
    const raw = (await this.loadData()) as Partial<PluginData> | null;
    if (!raw) {
      // First install — auto-detect device language and set matching WOL locale
      this.settings.wolLocale = detectWolLocale();
      return;
    }
    if (raw.settings) {
      this.settings = sanitizeSettings({ ...DEFAULT_SETTINGS, ...raw.settings });
    }
    if (raw.scheduleCache && typeof raw.scheduleCache === "object") {
      this.scheduleCache = this.evictStaleCache(raw.scheduleCache);
    }
    if (raw.timerStates) {
      this.timerEngine.restore(raw.timerStates);
    }
    if (raw.partOverrides && typeof raw.partOverrides === "object") {
      this.partOverrides = raw.partOverrides;
    }
    if (raw.customParts && typeof raw.customParts === "object") {
      this.customParts = raw.customParts;
    }
  }

  private async persistData(): Promise<void> {
    const timerStates: Record<string, TimerState> = {};
    for (const [k, v] of this.timerEngine.snapshotAll()) {
      timerStates[k] = v;
    }
    const data: PluginData = {
      settings: this.settings,
      scheduleCache: this.scheduleCache,
      timerStates,
      partOverrides: this.partOverrides,
      customParts: this.customParts,
    };
    await this.saveData(data);
  }

  private scheduleSave(): void {
    if (this.saveHandle !== null) window.clearTimeout(this.saveHandle);
    this.saveHandle = window.setTimeout(() => {
      this.saveHandle = null;
      this.persistData().catch(console.error);
    }, 500);
  }

  // ─── Timer persistence helpers (called from view) ────────────────────────────

  async persistTimers(): Promise<void> {
    await this.persistData();
  }

  // ─── Schedule cache ──────────────────────────────────────────────────────────

  /** Returns the cached schedule regardless of staleness. Used to supply If-Modified-Since. */
  getStaleCachedSchedule(key: string): WeeklySchedule | null {
    return this.scheduleCache[key] ?? null;
  }

  getCachedSchedule(key: string): WeeklySchedule | null {
    const cached = this.scheduleCache[key];
    if (!cached) return null;
    // Cache is valid for 12 hours
    const stale = Date.now() - cached.fetchedAt > 12 * 60 * 60 * 1000;
    return stale ? null : cached;
  }

  cacheSchedule(key: string, schedule: WeeklySchedule): void {
    this.scheduleCache[key] = schedule;
    this.scheduleSave();
  }

  evictCachedSchedule(key: string): void {
    delete this.scheduleCache[key];
    this.scheduleSave();
  }

  /**
   * Removes schedule cache entries that are no longer needed.
   *
   * - Past weeks (their Sunday has passed): kept for 7 days after week end,
   *   then evicted. There is no reason to keep old schedules long-term.
   * - Current or future weeks: kept for 30 days from when they were fetched.
   *
   * Called once on startup to prevent unbounded disk growth.
   */
  private evictStaleCache(
    cache: Record<string, WeeklySchedule>,
  ): Record<string, WeeklySchedule> {
    const now = Date.now();
    const WEEK_GRACE_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days after week end
    const FUTURE_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days from fetch

    const result: Record<string, WeeklySchedule> = {};
    for (const [k, v] of Object.entries(cache)) {
      const match = /^(\d{4})-(\d{2})$/.exec(k);
      if (!match) continue; // malformed key — drop it
      const year = parseInt(match[1], 10);
      const week = parseInt(match[2], 10);
      const weekEndMs = isoWeekEndMs(year, week);
      if (weekEndMs < now) {
        // Past week — keep for 7 days after it ended
        if (now - weekEndMs <= WEEK_GRACE_MS) result[k] = v;
      } else {
        // Current or future week — keep for 30 days from fetch
        if (now - v.fetchedAt <= FUTURE_TTL_MS) result[k] = v;
      }
    }
    return result;
  }

  // ─── Part overrides ─────────────────────────────────────────────────────

  getPartOverride(key: string): PartOverride | undefined {
    return this.partOverrides[key];
  }

  setPartOverride(key: string, override: PartOverride): void {
    this.partOverrides[key] = {
      ...(this.partOverrides[key] ?? {}),
      ...override,
    };
    this.scheduleSave();
  }

  clearPartOverrides(weekKey: string): void {
    for (const key of Object.keys(this.partOverrides)) {
      if (key.startsWith(weekKey + ":")) delete this.partOverrides[key];
    }
    this.scheduleSave();
  }

  // ─── Custom parts ──────────────────────────────────────────────────────────────────

  getCustomParts(weekKey: string): MeetingPart[] {
    return this.customParts[weekKey] ?? [];
  }

  getNextCustomOrder(weekKey: string): number {
    const existing = this.getCustomParts(weekKey);
    if (existing.length === 0) return 500;
    return Math.max(...existing.map((p) => p.order)) + 1;
  }

  addCustomPart(weekKey: string, part: MeetingPart): void {
    if (!this.customParts[weekKey]) this.customParts[weekKey] = [];
    this.customParts[weekKey].push(part);
    this.scheduleSave();
  }

  updateCustomPart(
    weekKey: string,
    order: number,
    fields: Partial<Pick<MeetingPart, "label" | "durationSec" | "hasAdvice">>,
  ): void {
    const parts = this.customParts[weekKey];
    if (!parts) return;
    const idx = parts.findIndex((p) => p.order === order);
    if (idx === -1) return;
    this.customParts[weekKey][idx] = { ...parts[idx], ...fields };
    this.scheduleSave();
  }

  removeCustomPart(weekKey: string, order: number): void {
    const parts = this.customParts[weekKey];
    if (!parts) return;
    this.customParts[weekKey] = parts.filter((p) => p.order !== order);
    this.scheduleSave();
  }

  // ─── Settings change helpers ─────────────────────────────────────────────────

  async clearCacheAndRefresh(): Promise<void> {
    this.scheduleCache = {};
    await this.persistData();
    await this.reloadView();
  }

  async reloadView(): Promise<void> {
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_JW_TIMER)[0];
    if (leaf?.view instanceof JwTimerView) {
      await leaf.view.reload();
    }
  }

  // ─── View activation ─────────────────────────────────────────────────────────

  private async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_JW_TIMER);
    if (existing.length) {
      await this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_JW_TIMER, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
}
