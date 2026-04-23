import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS } from "./types";
import type { PluginSettings, PluginData, WeeklySchedule, TimerState, PartOverride, MeetingPart } from "./types";
import { TimerEngine } from "./timer-engine";
import { JwTimerSettingsTab } from "./settings-tab";
import { JwTimerView, VIEW_TYPE_JW_TIMER } from "./view";

export default class JwTimerPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_SETTINGS };
  timerEngine = new TimerEngine();
  partOverrides: Record<string, PartOverride> = {};
  customParts: Record<string, MeetingPart[]> = {};
  private scheduleCache: Record<string, WeeklySchedule> = {};
  private saveHandle: number | null = null;

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async onload(): Promise<void> {
    await this.loadData_();

    this.registerView(VIEW_TYPE_JW_TIMER, (leaf) => new JwTimerView(leaf, this));

    this.addRibbonIcon("timer", "Open JW Meeting Timer", () => void this.activateView());

    this.addCommand({
      id: "open-jw-timer",
      name: "Open JW Meeting Timer sidebar",
      callback: () => void this.activateView(),
    });

    this.addSettingTab(new JwTimerSettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => void this.activateView());
  }

  onunload(): void {
    if (this.saveHandle !== null) {
      window.clearTimeout(this.saveHandle);
      this.saveHandle = null;
    }
    void this.persistTimers();
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_JW_TIMER);
  }

  // ─── Settings persistence ───────────────────────────────────────────────────

  async saveSettings(): Promise<void> {
    await this.persistData();
  }

  private async loadData_(): Promise<void> {
    const raw = await this.loadData() as Partial<PluginData> | null;
    if (!raw) return;
    if (raw.settings) {
      this.settings = { ...DEFAULT_SETTINGS, ...raw.settings };
    }
    if (raw.scheduleCache) {
      this.scheduleCache = raw.scheduleCache;
    }
    if (raw.timerStates) {
      this.timerEngine.restore(raw.timerStates);
    }
    if (raw.partOverrides) {
      this.partOverrides = raw.partOverrides;
    }
    if (raw.customParts) {
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
      void this.persistData();
    }, 500);
  }

  // ─── Timer persistence helpers (called from view) ────────────────────────────

  async persistTimers(): Promise<void> {
    await this.persistData();
  }

  // ─── Schedule cache ──────────────────────────────────────────────────────────

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

  // ─── Part overrides ─────────────────────────────────────────────────────

  getPartOverride(key: string): PartOverride | undefined {
    return this.partOverrides[key];
  }

  setPartOverride(key: string, override: PartOverride): void {
    this.partOverrides[key] = { ...(this.partOverrides[key] ?? {}), ...override };
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
    return Math.max(...existing.map(p => p.order)) + 1;
  }

  addCustomPart(weekKey: string, part: MeetingPart): void {
    if (!this.customParts[weekKey]) this.customParts[weekKey] = [];
    this.customParts[weekKey].push(part);
    this.scheduleSave();
  }

  updateCustomPart(weekKey: string, order: number, fields: Partial<Pick<MeetingPart, "label" | "durationSec" | "hasAdvice">>): void {
    const parts = this.customParts[weekKey];
    if (!parts) return;
    const idx = parts.findIndex(p => p.order === order);
    if (idx === -1) return;
    this.customParts[weekKey][idx] = { ...parts[idx], ...fields };
    this.scheduleSave();
  }

  removeCustomPart(weekKey: string, order: number): void {
    const parts = this.customParts[weekKey];
    if (!parts) return;
    this.customParts[weekKey] = parts.filter(p => p.order !== order);
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
      await (leaf.view as JwTimerView).reload();
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
