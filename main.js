"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => JwTimerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/types.ts
var DEFAULT_SETTINGS = {
  wolLocale: "r1/lp-e",
  meetingStartTime: "20:00",
  openingSongMinutes: 5
};

// src/timer-engine.ts
var TimerEngine = class {
  constructor() {
    this.states = /* @__PURE__ */ new Map();
  }
  key(weekKey, partOrder) {
    return `${weekKey}:${partOrder}`;
  }
  get(weekKey, partOrder) {
    const state = this.states.get(this.key(weekKey, partOrder));
    if (!state) return { elapsedMs: 0, status: "idle" };
    const elapsed = state.running && state.startedAt !== null ? state.elapsedMs + (Date.now() - state.startedAt) : state.elapsedMs;
    const status = state.running ? "running" : state.elapsedMs > 0 ? "paused" : "idle";
    return { elapsedMs: elapsed, status };
  }
  start(weekKey, partOrder) {
    const k = this.key(weekKey, partOrder);
    const existing = this.states.get(k);
    if (existing?.running) return;
    this.states.set(k, {
      partOrder,
      elapsedMs: existing?.elapsedMs ?? 0,
      running: true,
      startedAt: Date.now()
    });
  }
  pause(weekKey, partOrder) {
    const k = this.key(weekKey, partOrder);
    const state = this.states.get(k);
    if (!state?.running) return;
    this.states.set(k, {
      ...state,
      elapsedMs: state.elapsedMs + (Date.now() - (state.startedAt ?? Date.now())),
      running: false,
      startedAt: null
    });
  }
  reset(weekKey, partOrder) {
    this.states.delete(this.key(weekKey, partOrder));
  }
  /** Snapshot all states for persistence, freezing running timers. */
  snapshotAll() {
    const result = /* @__PURE__ */ new Map();
    for (const [k, state] of this.states) {
      if (state.running && state.startedAt !== null) {
        result.set(k, {
          ...state,
          elapsedMs: state.elapsedMs + (Date.now() - state.startedAt),
          running: false,
          startedAt: null
        });
      } else {
        result.set(k, { ...state });
      }
    }
    return result;
  }
  /** Restore states from persisted data (all paused). */
  restore(saved) {
    this.states.clear();
    for (const [k, state] of Object.entries(saved)) {
      this.states.set(k, { ...state, running: false, startedAt: null });
    }
  }
};

// src/settings-tab.ts
var import_obsidian = require("obsidian");
var WOL_LOCALES = {
  "English": "r1/lp-e",
  "Spanish": "r4/lp-s",
  "Portuguese": "r5/lp-t",
  "French": "r30/lp-f",
  "Italian": "r6/lp-i",
  "German": "r10/lp-g",
  "Dutch": "r13/lp-d",
  "Japanese": "r7/lp-j",
  "Korean": "r8/lp-ko",
  "Chinese (Simplified)": "r23/lp-chs"
};
var JwTimerSettingsTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "JW Meeting Timer \u2014 Settings" });
    new import_obsidian.Setting(containerEl).setName("Meeting language").setDesc("Language used to fetch the weekly programme from wol.jw.org.").addDropdown((drop) => {
      for (const [label, value] of Object.entries(WOL_LOCALES)) {
        drop.addOption(value, label);
      }
      drop.setValue(this.plugin.settings.wolLocale);
      drop.onChange(async (value) => {
        this.plugin.settings.wolLocale = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Custom locale (advanced)").setDesc(
      'Override with any WOL locale path, e.g. "r4/lp-s". Leave blank to use the dropdown selection.'
    ).addText((text) => {
      text.setPlaceholder("r1/lp-e").setValue("").onChange(async (value) => {
        const trimmed = value.trim();
        if (trimmed) {
          this.plugin.settings.wolLocale = trimmed;
          await this.plugin.saveSettings();
        }
      });
    });
    new import_obsidian.Setting(containerEl).setName("Meeting start time").setDesc('24-hour format, e.g. "20:00" or "18:30".').addText((text) => {
      text.setPlaceholder("20:00").setValue(this.plugin.settings.meetingStartTime).onChange(async (value) => {
        const trimmed = value.trim();
        if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
          this.plugin.settings.meetingStartTime = trimmed;
          await this.plugin.saveSettings();
        }
      });
    });
    new import_obsidian.Setting(containerEl).setName("Opening song + prayer (minutes)").setDesc("Fixed minutes before the first programme part (song + prayer). Default: 5.").addSlider((slider) => {
      slider.setLimits(1, 15, 1).setValue(this.plugin.settings.openingSongMinutes).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.openingSongMinutes = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Refresh schedule").setDesc("Clear the cached schedule and re-fetch from wol.jw.org.").addButton((btn) => {
      btn.setButtonText("Refresh now").onClick(async () => {
        await this.plugin.clearCacheAndRefresh();
        btn.setButtonText("Done \u2713");
        window.setTimeout(() => btn.setButtonText("Refresh now"), 2e3);
      });
    });
  }
};

// src/view.ts
var import_obsidian3 = require("obsidian");

// src/scraper.ts
var import_obsidian2 = require("obsidian");
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
}
function currentWeekNumber() {
  return isoWeek(/* @__PURE__ */ new Date());
}
function buildWolUrl(locale, year, week) {
  return `https://wol.jw.org/en/wol/meetings/${locale}/${year}/${week}`;
}
function cacheKey(year, week) {
  return `${year}-${String(week).padStart(2, "0")}`;
}
var SONG_SEC = 5 * 60;
var PRAYER_SEC = 1 * 60;
var FIXED_DURATIONS = {
  opening_comments: 1 * 60,
  mid_song: SONG_SEC,
  concluding_comments: 3 * 60
};
var DURATION_RE = /\((\d+)\s*min\.\)/i;
function parseDuration(text) {
  const m = DURATION_RE.exec(text);
  return m ? parseInt(m[1], 10) * 60 : null;
}
async function fetchWeekSchedule(locale, year, week) {
  const meetingsUrl = buildWolUrl(locale, year, week);
  let meetingsHtml;
  try {
    const resp = await (0, import_obsidian2.requestUrl)({
      url: meetingsUrl,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JWTimerObsidian/2.0)" }
    });
    if (resp.status < 200 || resp.status >= 300) return null;
    meetingsHtml = resp.text;
  } catch {
    return null;
  }
  const docLinkRe = /href="(\/[^"]+\/wol\/d\/[^"#?]+)"/g;
  const docLinks = [];
  let m;
  while ((m = docLinkRe.exec(meetingsHtml)) !== null) {
    const href = m[1];
    if (/\/\d{9,}$/.test(href)) {
      docLinks.push(href);
    }
  }
  if (docLinks.length === 0) return null;
  const mwbDocPath = docLinks[0];
  const docUrl = `https://wol.jw.org${mwbDocPath}`;
  let docHtml;
  try {
    const resp = await (0, import_obsidian2.requestUrl)({
      url: docUrl,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JWTimerObsidian/2.0)" }
    });
    if (resp.status < 200 || resp.status >= 300) return null;
    docHtml = resp.text;
  } catch {
    return null;
  }
  return parseDocPage(docHtml, year, week);
}
function stripHtmlTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function decodeHtmlEntities(text) {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
function cleanText(html) {
  return decodeHtmlEntities(stripHtmlTags(html)).trim();
}
function parseDocPage(html, year, week) {
  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const weekLabel = h1Match ? cleanText(h1Match[1]) : `Week ${week}`;
  const parts = [];
  let order = 0;
  parts.push({ label: "Song and Prayer", section: "opening", durationSec: SONG_SEC + PRAYER_SEC, order: order++ });
  parts.push({ label: "Opening Comments", section: "opening", durationSec: FIXED_DURATIONS.opening_comments, order: order++ });
  const h3Re = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|<h2|<\/article|$)/gi;
  const h2Re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const boundaries = [];
  let h2m;
  while ((h2m = h2Re.exec(html)) !== null) {
    const text = cleanText(h2m[1]).toUpperCase();
    let sec = null;
    if (text.includes("TREASURES")) sec = "treasures";
    else if (text.includes("APPLY YOURSELF") || text.includes("FIELD MINISTRY")) sec = "ministry";
    else if (text.includes("LIVING AS CHRISTIANS")) sec = "living";
    if (sec) boundaries.push({ pos: h2m.index, section: sec });
  }
  function sectionForPos(pos) {
    let sec = "opening";
    for (const b of boundaries) {
      if (pos >= b.pos) sec = b.section;
    }
    return sec;
  }
  let midSongInserted = false;
  let h3m;
  while ((h3m = h3Re.exec(html)) !== null) {
    const titleHtml = h3m[1];
    const bodyHtml = h3m[2] ?? "";
    const title = cleanText(titleHtml);
    const body = cleanText(bodyHtml);
    const pos = h3m.index;
    if (/^song\s+\d+$/i.test(title)) {
      const sec = sectionForPos(pos);
      if (sec === "living" && !midSongInserted) {
        parts.push({ label: title, section: "living", durationSec: SONG_SEC, order: order++ });
        midSongInserted = true;
      }
      continue;
    }
    if (/^song\s+\d+\s+and\s+prayer/i.test(title) && order <= 2) continue;
    const combined = `${title} ${body.slice(0, 80)}`;
    const durationSec = parseDuration(combined);
    if (durationSec === null) continue;
    const section = sectionForPos(pos);
    const cleanLabel = title.replace(DURATION_RE, "").replace(/\s+/g, " ").trim();
    parts.push({ label: cleanLabel, section, durationSec, order: order++ });
  }
  parts.push({ label: "Concluding Comments", section: "closing", durationSec: FIXED_DURATIONS.concluding_comments, order: order++ });
  parts.push({ label: "Closing Song and Prayer", section: "closing", durationSec: SONG_SEC + PRAYER_SEC, order: order++ });
  if (parts.length < 5) return null;
  return {
    weekLabel,
    year,
    weekNumber: week,
    parts,
    fetchedAt: Date.now()
  };
}

// src/view.ts
var VIEW_TYPE_JW_TIMER = "jw-timer-sidebar";
var WARN_THRESHOLD = 0.9;
function formatMmSs(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1e3));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function timeToMinutes(time) {
  const [hh, mm] = time.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}
function minutesToTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function colorState(elapsedMs, durationSec, status) {
  if (status === "idle") return "idle";
  const ratio = elapsedMs / (durationSec * 1e3);
  if (ratio > 1) return "over";
  if (ratio >= WARN_THRESHOLD) return "warn";
  return "ok";
}
var SECTION_LABELS = {
  opening: "Opening",
  treasures: "Treasures from God's Word",
  ministry: "Apply Yourself to the Ministry",
  living: "Living as Christians",
  closing: "Closing"
};
var JwTimerView = class extends import_obsidian3.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.schedule = null;
    this.weekKey = "";
    this.cards = /* @__PURE__ */ new Map();
    this.tickHandle = null;
  }
  getViewType() {
    return VIEW_TYPE_JW_TIMER;
  }
  getDisplayText() {
    return "JW Meeting Timer";
  }
  getIcon() {
    return "timer";
  }
  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("jw-timer-root");
    this.statusEl = root.createDiv({ cls: "jw-timer-status" });
    this.listEl = root.createDiv({ cls: "jw-timer-list" });
    this.tickHandle = window.setInterval(() => this.tick(), 250);
    await this.loadSchedule();
  }
  async onClose() {
    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    await this.plugin.persistTimers();
  }
  // ─── Public: called by plugin when settings change ──────────────────────────
  async reload() {
    this.schedule = null;
    this.cards.clear();
    this.listEl.empty();
    await this.loadSchedule();
  }
  // ─── Schedule loading ────────────────────────────────────────────────────────
  async loadSchedule() {
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const week = currentWeekNumber();
    this.weekKey = cacheKey(year, week);
    let schedule = this.plugin.getCachedSchedule(this.weekKey);
    if (!schedule) {
      this.setStatus("loading", "Fetching meeting schedule from wol.jw.org\u2026");
      schedule = await fetchWeekSchedule(this.plugin.settings.wolLocale, year, week);
      if (schedule) {
        this.plugin.cacheSchedule(this.weekKey, schedule);
        await this.plugin.saveSettings();
      }
    }
    if (!schedule) {
      this.setStatus("error", "Could not load schedule. Check your connection and language setting.");
      return;
    }
    this.schedule = schedule;
    this.setStatus("ok", `${schedule.weekLabel}`);
    this.renderSchedule(schedule);
  }
  setStatus(type, text) {
    this.statusEl.empty();
    this.statusEl.className = `jw-timer-status jw-timer-status--${type}`;
    this.statusEl.setText(text);
  }
  // ─── Render ───────────────────────────────────────────────────────────────────
  renderSchedule(schedule) {
    this.listEl.empty();
    this.cards.clear();
    const startMinutes = timeToMinutes(this.plugin.settings.meetingStartTime);
    let cursor = startMinutes + this.plugin.settings.openingSongMinutes;
    const scheduledStart = /* @__PURE__ */ new Map();
    for (const part of schedule.parts) {
      scheduledStart.set(part.order, cursor);
      cursor += Math.ceil(part.durationSec / 60);
    }
    const sections = /* @__PURE__ */ new Map();
    for (const part of schedule.parts) {
      const list = sections.get(part.section) ?? [];
      list.push(part);
      sections.set(part.section, list);
    }
    const sectionOrder = ["opening", "treasures", "ministry", "living", "closing"];
    for (const sectionKey of sectionOrder) {
      const parts = sections.get(sectionKey);
      if (!parts?.length) continue;
      const sectionEl = this.listEl.createDiv({ cls: "jw-timer-section" });
      sectionEl.createEl("h3", {
        cls: "jw-timer-section-title",
        text: SECTION_LABELS[sectionKey] ?? sectionKey
      });
      for (const part of parts) {
        this.renderCard(sectionEl, part, scheduledStart.get(part.order) ?? startMinutes);
      }
    }
  }
  renderCard(parentEl, part, scheduledStartMins) {
    const card = parentEl.createDiv({ cls: "jw-timer-card" });
    const titleRow = card.createDiv({ cls: "jw-timer-card-header" });
    titleRow.createDiv({ cls: "jw-timer-card-title", text: part.label });
    titleRow.createDiv({
      cls: "jw-timer-card-allotted",
      text: `${Math.round(part.durationSec / 60)} min`
    });
    card.createDiv({
      cls: "jw-timer-card-start-time",
      text: `Starts \u2248 ${minutesToTime(scheduledStartMins)}`
    });
    const barEl = card.createDiv({ cls: "jw-timer-bar" });
    const barFillEl = barEl.createDiv({ cls: "jw-timer-bar-fill" });
    const clockRow = card.createDiv({ cls: "jw-timer-clock-row" });
    const elapsedEl = clockRow.createDiv({ cls: "jw-timer-elapsed", text: "00:00" });
    const deltaEl = clockRow.createDiv({ cls: "jw-timer-delta" });
    const controls = card.createDiv({ cls: "jw-timer-controls" });
    const playBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-play", text: "\u25B6" });
    playBtn.setAttr("aria-label", "Start timer");
    const resetBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-reset", text: "\u21BA" });
    resetBtn.setAttr("aria-label", "Reset timer");
    playBtn.addEventListener("click", () => this.handlePlayPause(part));
    resetBtn.addEventListener("click", () => this.handleReset(part));
    this.cards.set(part.order, { cardEl: card, elapsedEl, deltaEl, playBtn, resetBtn, barFillEl });
    this.updateCard(part, scheduledStartMins);
  }
  // ─── Timer controls ────────────────────────────────────────────────────────
  handlePlayPause(part) {
    const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
    if (snap.status === "running") {
      this.plugin.timerEngine.pause(this.weekKey, part.order);
    } else {
      this.plugin.timerEngine.start(this.weekKey, part.order);
    }
    this.updateCardByOrder(part);
  }
  handleReset(part) {
    this.plugin.timerEngine.reset(this.weekKey, part.order);
    this.updateCardByOrder(part);
  }
  // ─── Tick & display update ─────────────────────────────────────────────────
  tick() {
    if (!this.schedule) return;
    for (const part of this.schedule.parts) {
      const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
      if (snap.status === "running") {
        this.updateCardByOrder(part);
      }
    }
  }
  updateCardByOrder(part) {
    const startMinutes = timeToMinutes(this.plugin.settings.meetingStartTime);
    let cursor = startMinutes + this.plugin.settings.openingSongMinutes;
    let scheduledStart = cursor;
    for (const p of this.schedule?.parts ?? []) {
      if (p.order === part.order) {
        scheduledStart = cursor;
        break;
      }
      cursor += Math.ceil(p.durationSec / 60);
    }
    this.updateCard(part, scheduledStart);
  }
  updateCard(part, scheduledStartMins) {
    const refs = this.cards.get(part.order);
    if (!refs) return;
    const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
    const { elapsedMs, status } = snap;
    const durationMs = part.durationSec * 1e3;
    refs.elapsedEl.setText(formatMmSs(elapsedMs));
    const pct = Math.min(1, elapsedMs / durationMs);
    refs.barFillEl.style.width = `${(pct * 100).toFixed(1)}%`;
    const remainingMs = durationMs - elapsedMs;
    if (status === "idle") {
      refs.deltaEl.setText(`${Math.round(part.durationSec / 60)} min allotted`);
      refs.deltaEl.className = "jw-timer-delta jw-timer-delta--neutral";
    } else if (remainingMs >= 0) {
      refs.deltaEl.setText(`\u2212${formatMmSs(remainingMs)} left`);
      refs.deltaEl.className = "jw-timer-delta jw-timer-delta--ok";
    } else {
      refs.deltaEl.setText(`+${formatMmSs(-remainingMs)} over`);
      refs.deltaEl.className = "jw-timer-delta jw-timer-delta--over";
    }
    const state = colorState(elapsedMs, part.durationSec, status);
    refs.cardEl.setAttribute("data-state", state);
    if (status === "running") {
      refs.playBtn.setText("\u23F8");
      refs.playBtn.setAttr("aria-label", "Pause timer");
    } else {
      refs.playBtn.setText("\u25B6");
      refs.playBtn.setAttr("aria-label", status === "paused" ? "Resume timer" : "Start timer");
    }
  }
};

// src/main.ts
var JwTimerPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    this.timerEngine = new TimerEngine();
    this.scheduleCache = {};
    this.saveHandle = null;
  }
  // ─── Lifecycle ──────────────────────────────────────────────────────────────
  async onload() {
    await this.loadData_();
    this.registerView(VIEW_TYPE_JW_TIMER, (leaf) => new JwTimerView(leaf, this));
    this.addRibbonIcon("timer", "Open JW Meeting Timer", () => void this.activateView());
    this.addCommand({
      id: "open-jw-timer",
      name: "Open JW Meeting Timer sidebar",
      callback: () => void this.activateView()
    });
    this.addSettingTab(new JwTimerSettingsTab(this.app, this));
    this.app.workspace.onLayoutReady(() => void this.activateView());
  }
  onunload() {
    if (this.saveHandle !== null) {
      window.clearTimeout(this.saveHandle);
      this.saveHandle = null;
    }
    void this.persistTimers();
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_JW_TIMER);
  }
  // ─── Settings persistence ───────────────────────────────────────────────────
  async saveSettings() {
    await this.persistData();
  }
  async loadData_() {
    const raw = await this.loadData();
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
  }
  async persistData() {
    const timerStates = {};
    for (const [k, v] of this.timerEngine.snapshotAll()) {
      timerStates[k] = v;
    }
    const data = {
      settings: this.settings,
      scheduleCache: this.scheduleCache,
      timerStates
    };
    await this.saveData(data);
  }
  scheduleSave() {
    if (this.saveHandle !== null) window.clearTimeout(this.saveHandle);
    this.saveHandle = window.setTimeout(() => {
      this.saveHandle = null;
      void this.persistData();
    }, 500);
  }
  // ─── Timer persistence helpers (called from view) ────────────────────────────
  async persistTimers() {
    await this.persistData();
  }
  // ─── Schedule cache ──────────────────────────────────────────────────────────
  getCachedSchedule(key) {
    const cached = this.scheduleCache[key];
    if (!cached) return null;
    const stale = Date.now() - cached.fetchedAt > 12 * 60 * 60 * 1e3;
    return stale ? null : cached;
  }
  cacheSchedule(key, schedule) {
    this.scheduleCache[key] = schedule;
    this.scheduleSave();
  }
  // ─── Settings change helpers ─────────────────────────────────────────────────
  async clearCacheAndRefresh() {
    this.scheduleCache = {};
    await this.persistData();
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_JW_TIMER)[0];
    if (leaf?.view instanceof JwTimerView) {
      await leaf.view.reload();
    }
  }
  // ─── View activation ─────────────────────────────────────────────────────────
  async activateView() {
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
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3R5cGVzLnRzIiwgInNyYy90aW1lci1lbmdpbmUudHMiLCAic3JjL3NldHRpbmdzLXRhYi50cyIsICJzcmMvdmlldy50cyIsICJzcmMvc2NyYXBlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBERUZBVUxUX1NFVFRJTkdTIH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB0eXBlIHsgUGx1Z2luU2V0dGluZ3MsIFBsdWdpbkRhdGEsIFdlZWtseVNjaGVkdWxlLCBUaW1lclN0YXRlIH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB7IFRpbWVyRW5naW5lIH0gZnJvbSBcIi4vdGltZXItZW5naW5lXCI7XG5pbXBvcnQgeyBKd1RpbWVyU2V0dGluZ3NUYWIgfSBmcm9tIFwiLi9zZXR0aW5ncy10YWJcIjtcbmltcG9ydCB7IEp3VGltZXJWaWV3LCBWSUVXX1RZUEVfSldfVElNRVIgfSBmcm9tIFwiLi92aWV3XCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEp3VGltZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5nczogUGx1Z2luU2V0dGluZ3MgPSB7IC4uLkRFRkFVTFRfU0VUVElOR1MgfTtcbiAgdGltZXJFbmdpbmUgPSBuZXcgVGltZXJFbmdpbmUoKTtcbiAgcHJpdmF0ZSBzY2hlZHVsZUNhY2hlOiBSZWNvcmQ8c3RyaW5nLCBXZWVrbHlTY2hlZHVsZT4gPSB7fTtcbiAgcHJpdmF0ZSBzYXZlSGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgTGlmZWN5Y2xlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLmxvYWREYXRhXygpO1xuXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoVklFV19UWVBFX0pXX1RJTUVSLCAobGVhZikgPT4gbmV3IEp3VGltZXJWaWV3KGxlYWYsIHRoaXMpKTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcInRpbWVyXCIsIFwiT3BlbiBKVyBNZWV0aW5nIFRpbWVyXCIsICgpID0+IHZvaWQgdGhpcy5hY3RpdmF0ZVZpZXcoKSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwib3Blbi1qdy10aW1lclwiLFxuICAgICAgbmFtZTogXCJPcGVuIEpXIE1lZXRpbmcgVGltZXIgc2lkZWJhclwiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHZvaWQgdGhpcy5hY3RpdmF0ZVZpZXcoKSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgSndUaW1lclNldHRpbmdzVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB2b2lkIHRoaXMuYWN0aXZhdGVWaWV3KCkpO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuc2F2ZUhhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnNhdmVIYW5kbGUpO1xuICAgICAgdGhpcy5zYXZlSGFuZGxlID0gbnVsbDtcbiAgICB9XG4gICAgdm9pZCB0aGlzLnBlcnNpc3RUaW1lcnMoKTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9KV19USU1FUik7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2V0dGluZ3MgcGVyc2lzdGVuY2UgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMucGVyc2lzdERhdGEoKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZERhdGFfKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJhdyA9IGF3YWl0IHRoaXMubG9hZERhdGEoKSBhcyBQYXJ0aWFsPFBsdWdpbkRhdGE+IHwgbnVsbDtcbiAgICBpZiAoIXJhdykgcmV0dXJuO1xuICAgIGlmIChyYXcuc2V0dGluZ3MpIHtcbiAgICAgIHRoaXMuc2V0dGluZ3MgPSB7IC4uLkRFRkFVTFRfU0VUVElOR1MsIC4uLnJhdy5zZXR0aW5ncyB9O1xuICAgIH1cbiAgICBpZiAocmF3LnNjaGVkdWxlQ2FjaGUpIHtcbiAgICAgIHRoaXMuc2NoZWR1bGVDYWNoZSA9IHJhdy5zY2hlZHVsZUNhY2hlO1xuICAgIH1cbiAgICBpZiAocmF3LnRpbWVyU3RhdGVzKSB7XG4gICAgICB0aGlzLnRpbWVyRW5naW5lLnJlc3RvcmUocmF3LnRpbWVyU3RhdGVzKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHBlcnNpc3REYXRhKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHRpbWVyU3RhdGVzOiBSZWNvcmQ8c3RyaW5nLCBUaW1lclN0YXRlPiA9IHt9O1xuICAgIGZvciAoY29uc3QgW2ssIHZdIG9mIHRoaXMudGltZXJFbmdpbmUuc25hcHNob3RBbGwoKSkge1xuICAgICAgdGltZXJTdGF0ZXNba10gPSB2O1xuICAgIH1cbiAgICBjb25zdCBkYXRhOiBQbHVnaW5EYXRhID0ge1xuICAgICAgc2V0dGluZ3M6IHRoaXMuc2V0dGluZ3MsXG4gICAgICBzY2hlZHVsZUNhY2hlOiB0aGlzLnNjaGVkdWxlQ2FjaGUsXG4gICAgICB0aW1lclN0YXRlcyxcbiAgICB9O1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEoZGF0YSk7XG4gIH1cblxuICBwcml2YXRlIHNjaGVkdWxlU2F2ZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zYXZlSGFuZGxlICE9PSBudWxsKSB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuc2F2ZUhhbmRsZSk7XG4gICAgdGhpcy5zYXZlSGFuZGxlID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5zYXZlSGFuZGxlID0gbnVsbDtcbiAgICAgIHZvaWQgdGhpcy5wZXJzaXN0RGF0YSgpO1xuICAgIH0sIDUwMCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGltZXIgcGVyc2lzdGVuY2UgaGVscGVycyAoY2FsbGVkIGZyb20gdmlldykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgYXN5bmMgcGVyc2lzdFRpbWVycygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnBlcnNpc3REYXRhKCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2NoZWR1bGUgY2FjaGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgZ2V0Q2FjaGVkU2NoZWR1bGUoa2V5OiBzdHJpbmcpOiBXZWVrbHlTY2hlZHVsZSB8IG51bGwge1xuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuc2NoZWR1bGVDYWNoZVtrZXldO1xuICAgIGlmICghY2FjaGVkKSByZXR1cm4gbnVsbDtcbiAgICAvLyBDYWNoZSBpcyB2YWxpZCBmb3IgMTIgaG91cnNcbiAgICBjb25zdCBzdGFsZSA9IERhdGUubm93KCkgLSBjYWNoZWQuZmV0Y2hlZEF0ID4gMTIgKiA2MCAqIDYwICogMTAwMDtcbiAgICByZXR1cm4gc3RhbGUgPyBudWxsIDogY2FjaGVkO1xuICB9XG5cbiAgY2FjaGVTY2hlZHVsZShrZXk6IHN0cmluZywgc2NoZWR1bGU6IFdlZWtseVNjaGVkdWxlKTogdm9pZCB7XG4gICAgdGhpcy5zY2hlZHVsZUNhY2hlW2tleV0gPSBzY2hlZHVsZTtcbiAgICB0aGlzLnNjaGVkdWxlU2F2ZSgpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNldHRpbmdzIGNoYW5nZSBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGFzeW5jIGNsZWFyQ2FjaGVBbmRSZWZyZXNoKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2NoZWR1bGVDYWNoZSA9IHt9O1xuICAgIGF3YWl0IHRoaXMucGVyc2lzdERhdGEoKTtcbiAgICAvLyBSZWxvYWQgdGhlIG9wZW4gdmlldyBpZiBwcmVzZW50XG4gICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX0pXX1RJTUVSKVswXTtcbiAgICBpZiAobGVhZj8udmlldyBpbnN0YW5jZW9mIEp3VGltZXJWaWV3KSB7XG4gICAgICBhd2FpdCAobGVhZi52aWV3IGFzIEp3VGltZXJWaWV3KS5yZWxvYWQoKTtcbiAgICB9XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgVmlldyBhY3RpdmF0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgYXN5bmMgYWN0aXZhdGVWaWV3KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfSldfVElNRVIpO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGgpIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGV4aXN0aW5nWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRSaWdodExlYWYoZmFsc2UpO1xuICAgIGlmICghbGVhZikgcmV0dXJuO1xuICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHsgdHlwZTogVklFV19UWVBFX0pXX1RJTUVSLCBhY3RpdmU6IHRydWUgfSk7XG4gICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XG4gIH1cbn1cbiIsICIvLyBcdTI1MDBcdTI1MDBcdTI1MDAgRG9tYWluIHR5cGVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgaW50ZXJmYWNlIE1lZXRpbmdQYXJ0IHtcbiAgLyoqIERpc3BsYXkgbGFiZWwgKGUuZy4gXCIxLiBIb3cgTXVjaCBBcmUgWW91IFdpbGxpbmcgdG8gUGF5P1wiKSAqL1xuICBsYWJlbDogc3RyaW5nO1xuICAvKiogU2VjdGlvbiB0aGlzIHBhcnQgYmVsb25ncyB0byAqL1xuICBzZWN0aW9uOiBNZWV0aW5nU2VjdGlvbjtcbiAgLyoqIEFsbG93ZWQgZHVyYXRpb24gaW4gc2Vjb25kcyAqL1xuICBkdXJhdGlvblNlYzogbnVtYmVyO1xuICAvKiogT3JkZXIgd2l0aGluIHRoZSBmdWxsIG1lZXRpbmcgcHJvZ3JhbW1lICovXG4gIG9yZGVyOiBudW1iZXI7XG59XG5cbmV4cG9ydCB0eXBlIE1lZXRpbmdTZWN0aW9uID1cbiAgfCBcIm9wZW5pbmdcIlxuICB8IFwidHJlYXN1cmVzXCJcbiAgfCBcIm1pbmlzdHJ5XCJcbiAgfCBcImxpdmluZ1wiXG4gIHwgXCJjbG9zaW5nXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgV2Vla2x5U2NoZWR1bGUge1xuICAvKiogSVNPIHdlZWsgbGFiZWwsIGUuZy4gXCJBcHJpbCAyMC0yNlwiICovXG4gIHdlZWtMYWJlbDogc3RyaW5nO1xuICAvKiogWWVhciAqL1xuICB5ZWFyOiBudW1iZXI7XG4gIC8qKiBJU08gd2VlayBudW1iZXIgKDEtNTMpICovXG4gIHdlZWtOdW1iZXI6IG51bWJlcjtcbiAgcGFydHM6IE1lZXRpbmdQYXJ0W107XG4gIC8qKiBXaGVuIHRoaXMgZGF0YSB3YXMgZmV0Y2hlZCAobXMgc2luY2UgZXBvY2gpICovXG4gIGZldGNoZWRBdDogbnVtYmVyO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGltZXIgc3RhdGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBpbnRlcmZhY2UgVGltZXJTdGF0ZSB7XG4gIHBhcnRPcmRlcjogbnVtYmVyO1xuICAvKiogQWNjdW11bGF0ZWQgZWxhcHNlZCBtcyAod2hlbiBwYXVzZWQpICovXG4gIGVsYXBzZWRNczogbnVtYmVyO1xuICBydW5uaW5nOiBib29sZWFuO1xuICAvKiogRGF0ZS5ub3coKSB3aGVuIHRoZSBsYXN0IHN0YXJ0IGhhcHBlbmVkICovXG4gIHN0YXJ0ZWRBdDogbnVtYmVyIHwgbnVsbDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFBlcnNpc3RlZCBwbHVnaW4gZGF0YSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGludGVyZmFjZSBQbHVnaW5EYXRhIHtcbiAgc2V0dGluZ3M6IFBsdWdpblNldHRpbmdzO1xuICAvKiogQ2FjaGVkIHNjaGVkdWxlLCBrZXllZCBieSBcIllZWVktV1dcIiAqL1xuICBzY2hlZHVsZUNhY2hlOiBSZWNvcmQ8c3RyaW5nLCBXZWVrbHlTY2hlZHVsZT47XG4gIC8qKiBUaW1lciBzdGF0ZXMsIGtleWVkIGJ5IFwiWVlZWS1XVzpwYXJ0T3JkZXJcIiAqL1xuICB0aW1lclN0YXRlczogUmVjb3JkPHN0cmluZywgVGltZXJTdGF0ZT47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGx1Z2luU2V0dGluZ3Mge1xuICAvKiogV09MIGxhbmd1YWdlIGxvY2FsZSwgZS5nLiBcInIxL2xwLWVcIiAoRW5nbGlzaCkgb3IgXCJyNC9scC1zXCIgKFNwYW5pc2gpICovXG4gIHdvbExvY2FsZTogc3RyaW5nO1xuICAvKiogTWVldGluZyBzdGFydCB0aW1lLCBISDpNTSAyNGggZm9ybWF0LCBlLmcuIFwiMjA6MDBcIiAqL1xuICBtZWV0aW5nU3RhcnRUaW1lOiBzdHJpbmc7XG4gIC8qKiBNaW51dGVzIGZvciBvcGVuaW5nIHNvbmcgKyBwcmF5ZXIgYmVmb3JlIGZpcnN0IHByb2dyYW1tZSBwYXJ0ICovXG4gIG9wZW5pbmdTb25nTWludXRlczogbnVtYmVyO1xufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogUGx1Z2luU2V0dGluZ3MgPSB7XG4gIHdvbExvY2FsZTogXCJyMS9scC1lXCIsXG4gIG1lZXRpbmdTdGFydFRpbWU6IFwiMjA6MDBcIixcbiAgb3BlbmluZ1NvbmdNaW51dGVzOiA1LFxufTtcbiIsICJpbXBvcnQgdHlwZSB7IFRpbWVyU3RhdGUgfSBmcm9tIFwiLi90eXBlc1wiO1xuXG5leHBvcnQgdHlwZSBUaW1lclN0YXR1cyA9IFwiaWRsZVwiIHwgXCJydW5uaW5nXCIgfCBcInBhdXNlZFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRpbWVyU25hcHNob3Qge1xuICBlbGFwc2VkTXM6IG51bWJlcjtcbiAgc3RhdHVzOiBUaW1lclN0YXR1cztcbn1cblxuZXhwb3J0IGNsYXNzIFRpbWVyRW5naW5lIHtcbiAgcHJpdmF0ZSBzdGF0ZXMgPSBuZXcgTWFwPHN0cmluZywgVGltZXJTdGF0ZT4oKTtcblxuICBwcml2YXRlIGtleSh3ZWVrS2V5OiBzdHJpbmcsIHBhcnRPcmRlcjogbnVtYmVyKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYCR7d2Vla0tleX06JHtwYXJ0T3JkZXJ9YDtcbiAgfVxuXG4gIGdldCh3ZWVrS2V5OiBzdHJpbmcsIHBhcnRPcmRlcjogbnVtYmVyKTogVGltZXJTbmFwc2hvdCB7XG4gICAgY29uc3Qgc3RhdGUgPSB0aGlzLnN0YXRlcy5nZXQodGhpcy5rZXkod2Vla0tleSwgcGFydE9yZGVyKSk7XG4gICAgaWYgKCFzdGF0ZSkgcmV0dXJuIHsgZWxhcHNlZE1zOiAwLCBzdGF0dXM6IFwiaWRsZVwiIH07XG4gICAgY29uc3QgZWxhcHNlZCA9IHN0YXRlLnJ1bm5pbmcgJiYgc3RhdGUuc3RhcnRlZEF0ICE9PSBudWxsXG4gICAgICA/IHN0YXRlLmVsYXBzZWRNcyArIChEYXRlLm5vdygpIC0gc3RhdGUuc3RhcnRlZEF0KVxuICAgICAgOiBzdGF0ZS5lbGFwc2VkTXM7XG4gICAgY29uc3Qgc3RhdHVzOiBUaW1lclN0YXR1cyA9IHN0YXRlLnJ1bm5pbmcgPyBcInJ1bm5pbmdcIiA6IHN0YXRlLmVsYXBzZWRNcyA+IDAgPyBcInBhdXNlZFwiIDogXCJpZGxlXCI7XG4gICAgcmV0dXJuIHsgZWxhcHNlZE1zOiBlbGFwc2VkLCBzdGF0dXMgfTtcbiAgfVxuXG4gIHN0YXJ0KHdlZWtLZXk6IHN0cmluZywgcGFydE9yZGVyOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBrID0gdGhpcy5rZXkod2Vla0tleSwgcGFydE9yZGVyKTtcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuc3RhdGVzLmdldChrKTtcbiAgICBpZiAoZXhpc3Rpbmc/LnJ1bm5pbmcpIHJldHVybjtcbiAgICB0aGlzLnN0YXRlcy5zZXQoaywge1xuICAgICAgcGFydE9yZGVyLFxuICAgICAgZWxhcHNlZE1zOiBleGlzdGluZz8uZWxhcHNlZE1zID8/IDAsXG4gICAgICBydW5uaW5nOiB0cnVlLFxuICAgICAgc3RhcnRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH0pO1xuICB9XG5cbiAgcGF1c2Uod2Vla0tleTogc3RyaW5nLCBwYXJ0T3JkZXI6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IGsgPSB0aGlzLmtleSh3ZWVrS2V5LCBwYXJ0T3JkZXIpO1xuICAgIGNvbnN0IHN0YXRlID0gdGhpcy5zdGF0ZXMuZ2V0KGspO1xuICAgIGlmICghc3RhdGU/LnJ1bm5pbmcpIHJldHVybjtcbiAgICB0aGlzLnN0YXRlcy5zZXQoaywge1xuICAgICAgLi4uc3RhdGUsXG4gICAgICBlbGFwc2VkTXM6IHN0YXRlLmVsYXBzZWRNcyArIChEYXRlLm5vdygpIC0gKHN0YXRlLnN0YXJ0ZWRBdCA/PyBEYXRlLm5vdygpKSksXG4gICAgICBydW5uaW5nOiBmYWxzZSxcbiAgICAgIHN0YXJ0ZWRBdDogbnVsbCxcbiAgICB9KTtcbiAgfVxuXG4gIHJlc2V0KHdlZWtLZXk6IHN0cmluZywgcGFydE9yZGVyOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLnN0YXRlcy5kZWxldGUodGhpcy5rZXkod2Vla0tleSwgcGFydE9yZGVyKSk7XG4gIH1cblxuICAvKiogU25hcHNob3QgYWxsIHN0YXRlcyBmb3IgcGVyc2lzdGVuY2UsIGZyZWV6aW5nIHJ1bm5pbmcgdGltZXJzLiAqL1xuICBzbmFwc2hvdEFsbCgpOiBNYXA8c3RyaW5nLCBUaW1lclN0YXRlPiB7XG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IE1hcDxzdHJpbmcsIFRpbWVyU3RhdGU+KCk7XG4gICAgZm9yIChjb25zdCBbaywgc3RhdGVdIG9mIHRoaXMuc3RhdGVzKSB7XG4gICAgICBpZiAoc3RhdGUucnVubmluZyAmJiBzdGF0ZS5zdGFydGVkQXQgIT09IG51bGwpIHtcbiAgICAgICAgcmVzdWx0LnNldChrLCB7XG4gICAgICAgICAgLi4uc3RhdGUsXG4gICAgICAgICAgZWxhcHNlZE1zOiBzdGF0ZS5lbGFwc2VkTXMgKyAoRGF0ZS5ub3coKSAtIHN0YXRlLnN0YXJ0ZWRBdCksXG4gICAgICAgICAgcnVubmluZzogZmFsc2UsXG4gICAgICAgICAgc3RhcnRlZEF0OiBudWxsLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdC5zZXQoaywgeyAuLi5zdGF0ZSB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKiBSZXN0b3JlIHN0YXRlcyBmcm9tIHBlcnNpc3RlZCBkYXRhIChhbGwgcGF1c2VkKS4gKi9cbiAgcmVzdG9yZShzYXZlZDogUmVjb3JkPHN0cmluZywgVGltZXJTdGF0ZT4pOiB2b2lkIHtcbiAgICB0aGlzLnN0YXRlcy5jbGVhcigpO1xuICAgIGZvciAoY29uc3QgW2ssIHN0YXRlXSBvZiBPYmplY3QuZW50cmllcyhzYXZlZCkpIHtcbiAgICAgIHRoaXMuc3RhdGVzLnNldChrLCB7IC4uLnN0YXRlLCBydW5uaW5nOiBmYWxzZSwgc3RhcnRlZEF0OiBudWxsIH0pO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgSndUaW1lclBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XG5pbXBvcnQgdHlwZSB7IFBsdWdpblNldHRpbmdzIH0gZnJvbSBcIi4vdHlwZXNcIjtcblxuLy8gQXZhaWxhYmxlIFdPTCBsb2NhbGVzOiBsYWJlbCBcdTIxOTIgbG9jYWxlIHBhdGggc2VnbWVudFxuY29uc3QgV09MX0xPQ0FMRVM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIFwiRW5nbGlzaFwiOiAgICBcInIxL2xwLWVcIixcbiAgXCJTcGFuaXNoXCI6ICAgIFwicjQvbHAtc1wiLFxuICBcIlBvcnR1Z3Vlc2VcIjogXCJyNS9scC10XCIsXG4gIFwiRnJlbmNoXCI6ICAgICBcInIzMC9scC1mXCIsXG4gIFwiSXRhbGlhblwiOiAgICBcInI2L2xwLWlcIixcbiAgXCJHZXJtYW5cIjogICAgIFwicjEwL2xwLWdcIixcbiAgXCJEdXRjaFwiOiAgICAgIFwicjEzL2xwLWRcIixcbiAgXCJKYXBhbmVzZVwiOiAgIFwicjcvbHAtalwiLFxuICBcIktvcmVhblwiOiAgICAgXCJyOC9scC1rb1wiLFxuICBcIkNoaW5lc2UgKFNpbXBsaWZpZWQpXCI6IFwicjIzL2xwLWNoc1wiLFxufTtcblxuZXhwb3J0IGNsYXNzIEp3VGltZXJTZXR0aW5nc1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSByZWFkb25seSBwbHVnaW46IEp3VGltZXJQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcblxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIkpXIE1lZXRpbmcgVGltZXIgXHUyMDE0IFNldHRpbmdzXCIgfSk7XG5cbiAgICAvLyBMYW5ndWFnZSAvIGxvY2FsZVxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJNZWV0aW5nIGxhbmd1YWdlXCIpXG4gICAgICAuc2V0RGVzYyhcIkxhbmd1YWdlIHVzZWQgdG8gZmV0Y2ggdGhlIHdlZWtseSBwcm9ncmFtbWUgZnJvbSB3b2wuancub3JnLlwiKVxuICAgICAgLmFkZERyb3Bkb3duKChkcm9wKSA9PiB7XG4gICAgICAgIGZvciAoY29uc3QgW2xhYmVsLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoV09MX0xPQ0FMRVMpKSB7XG4gICAgICAgICAgZHJvcC5hZGRPcHRpb24odmFsdWUsIGxhYmVsKTtcbiAgICAgICAgfVxuICAgICAgICBkcm9wLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLndvbExvY2FsZSk7XG4gICAgICAgIGRyb3Aub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mud29sTG9jYWxlID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAvLyBDdXN0b20gbG9jYWxlIG92ZXJyaWRlXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkN1c3RvbSBsb2NhbGUgKGFkdmFuY2VkKVwiKVxuICAgICAgLnNldERlc2MoXG4gICAgICAgICdPdmVycmlkZSB3aXRoIGFueSBXT0wgbG9jYWxlIHBhdGgsIGUuZy4gXCJyNC9scC1zXCIuIExlYXZlIGJsYW5rIHRvIHVzZSB0aGUgZHJvcGRvd24gc2VsZWN0aW9uLidcbiAgICAgIClcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PiB7XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJyMS9scC1lXCIpXG4gICAgICAgICAgLnNldFZhbHVlKFwiXCIpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcbiAgICAgICAgICAgIGlmICh0cmltbWVkKSB7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLndvbExvY2FsZSA9IHRyaW1tZWQ7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAvLyBNZWV0aW5nIHN0YXJ0IHRpbWVcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiTWVldGluZyBzdGFydCB0aW1lXCIpXG4gICAgICAuc2V0RGVzYygnMjQtaG91ciBmb3JtYXQsIGUuZy4gXCIyMDowMFwiIG9yIFwiMTg6MzBcIi4nKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+IHtcbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcIjIwOjAwXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm1lZXRpbmdTdGFydFRpbWUpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcbiAgICAgICAgICAgIGlmICgvXlxcZHsxLDJ9OlxcZHsyfSQvLnRlc3QodHJpbW1lZCkpIHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MubWVldGluZ1N0YXJ0VGltZSA9IHRyaW1tZWQ7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAvLyBPcGVuaW5nIHNvbmcgZHVyYXRpb25cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiT3BlbmluZyBzb25nICsgcHJheWVyIChtaW51dGVzKVwiKVxuICAgICAgLnNldERlc2MoXCJGaXhlZCBtaW51dGVzIGJlZm9yZSB0aGUgZmlyc3QgcHJvZ3JhbW1lIHBhcnQgKHNvbmcgKyBwcmF5ZXIpLiBEZWZhdWx0OiA1LlwiKVxuICAgICAgLmFkZFNsaWRlcigoc2xpZGVyKSA9PiB7XG4gICAgICAgIHNsaWRlclxuICAgICAgICAgIC5zZXRMaW1pdHMoMSwgMTUsIDEpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5pbmdTb25nTWludXRlcylcbiAgICAgICAgICAuc2V0RHluYW1pY1Rvb2x0aXAoKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5pbmdTb25nTWludXRlcyA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIC8vIE1hbnVhbCByZWZyZXNoIGJ1dHRvblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJSZWZyZXNoIHNjaGVkdWxlXCIpXG4gICAgICAuc2V0RGVzYyhcIkNsZWFyIHRoZSBjYWNoZWQgc2NoZWR1bGUgYW5kIHJlLWZldGNoIGZyb20gd29sLmp3Lm9yZy5cIilcbiAgICAgIC5hZGRCdXR0b24oKGJ0bikgPT4ge1xuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dChcIlJlZnJlc2ggbm93XCIpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLmNsZWFyQ2FjaGVBbmRSZWZyZXNoKCk7XG4gICAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoXCJEb25lIFx1MjcxM1wiKTtcbiAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiBidG4uc2V0QnV0dG9uVGV4dChcIlJlZnJlc2ggbm93XCIpLCAyMDAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEl0ZW1WaWV3LCBXb3Jrc3BhY2VMZWFmIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSBKd1RpbWVyUGx1Z2luIGZyb20gXCIuL21haW5cIjtcbmltcG9ydCB0eXBlIHsgV2Vla2x5U2NoZWR1bGUsIE1lZXRpbmdQYXJ0IH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB0eXBlIHsgVGltZXJTbmFwc2hvdCB9IGZyb20gXCIuL3RpbWVyLWVuZ2luZVwiO1xuaW1wb3J0IHsgY2FjaGVLZXksIGN1cnJlbnRXZWVrTnVtYmVyLCBmZXRjaFdlZWtTY2hlZHVsZSB9IGZyb20gXCIuL3NjcmFwZXJcIjtcblxuZXhwb3J0IGNvbnN0IFZJRVdfVFlQRV9KV19USU1FUiA9IFwianctdGltZXItc2lkZWJhclwiO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgQ29sb3VyIHRocmVzaG9sZHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBncmVlbiAgPSBlbGFwc2VkIDwgOTAlIG9mIGFsbG93ZWRcbi8vIG9yYW5nZSA9IGVsYXBzZWQgPj0gOTAlIGFuZCA8PSAxMDAlXG4vLyByZWQgICAgPSBlbGFwc2VkID4gMTAwJVxuY29uc3QgV0FSTl9USFJFU0hPTEQgPSAwLjk7XG5cbmZ1bmN0aW9uIGZvcm1hdE1tU3MobXM6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IHRvdGFsU2VjID0gTWF0aC5tYXgoMCwgTWF0aC5mbG9vcihtcyAvIDEwMDApKTtcbiAgY29uc3QgbSA9IE1hdGguZmxvb3IodG90YWxTZWMgLyA2MCk7XG4gIGNvbnN0IHMgPSB0b3RhbFNlYyAlIDYwO1xuICByZXR1cm4gYCR7U3RyaW5nKG0pLnBhZFN0YXJ0KDIsIFwiMFwiKX06JHtTdHJpbmcocykucGFkU3RhcnQoMiwgXCIwXCIpfWA7XG59XG5cbi8qKiBQYXJzZSBcIkhIOk1NXCIgaW50byBtaW51dGVzIGZyb20gbWlkbmlnaHQgKi9cbmZ1bmN0aW9uIHRpbWVUb01pbnV0ZXModGltZTogc3RyaW5nKTogbnVtYmVyIHtcbiAgY29uc3QgW2hoLCBtbV0gPSB0aW1lLnNwbGl0KFwiOlwiKS5tYXAoTnVtYmVyKTtcbiAgcmV0dXJuIChoaCA/PyAwKSAqIDYwICsgKG1tID8/IDApO1xufVxuXG4vKiogRm9ybWF0IG1pbnV0ZXMtZnJvbS1taWRuaWdodCBhcyBcIkhIOk1NXCIgKi9cbmZ1bmN0aW9uIG1pbnV0ZXNUb1RpbWUobWluczogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgaCA9IE1hdGguZmxvb3IobWlucyAvIDYwKSAlIDI0O1xuICBjb25zdCBtID0gbWlucyAlIDYwO1xuICByZXR1cm4gYCR7U3RyaW5nKGgpLnBhZFN0YXJ0KDIsIFwiMFwiKX06JHtTdHJpbmcobSkucGFkU3RhcnQoMiwgXCIwXCIpfWA7XG59XG5cbnR5cGUgVGltZXJDb2xvclN0YXRlID0gXCJpZGxlXCIgfCBcIm9rXCIgfCBcIndhcm5cIiB8IFwib3ZlclwiO1xuXG5mdW5jdGlvbiBjb2xvclN0YXRlKGVsYXBzZWRNczogbnVtYmVyLCBkdXJhdGlvblNlYzogbnVtYmVyLCBzdGF0dXM6IFRpbWVyU25hcHNob3RbXCJzdGF0dXNcIl0pOiBUaW1lckNvbG9yU3RhdGUge1xuICBpZiAoc3RhdHVzID09PSBcImlkbGVcIikgcmV0dXJuIFwiaWRsZVwiO1xuICBjb25zdCByYXRpbyA9IGVsYXBzZWRNcyAvIChkdXJhdGlvblNlYyAqIDEwMDApO1xuICBpZiAocmF0aW8gPiAxKSByZXR1cm4gXCJvdmVyXCI7XG4gIGlmIChyYXRpbyA+PSBXQVJOX1RIUkVTSE9MRCkgcmV0dXJuIFwid2FyblwiO1xuICByZXR1cm4gXCJva1wiO1xufVxuXG5pbnRlcmZhY2UgQ2FyZFJlZnMge1xuICBjYXJkRWw6IEhUTUxFbGVtZW50O1xuICBlbGFwc2VkRWw6IEhUTUxFbGVtZW50O1xuICBkZWx0YUVsOiBIVE1MRWxlbWVudDtcbiAgcGxheUJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHJlc2V0QnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgYmFyRmlsbEVsOiBIVE1MRWxlbWVudDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNlY3Rpb24gbGFiZWxzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgU0VDVElPTl9MQUJFTFM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIG9wZW5pbmc6ICAgXCJPcGVuaW5nXCIsXG4gIHRyZWFzdXJlczogXCJUcmVhc3VyZXMgZnJvbSBHb2QncyBXb3JkXCIsXG4gIG1pbmlzdHJ5OiAgXCJBcHBseSBZb3Vyc2VsZiB0byB0aGUgTWluaXN0cnlcIixcbiAgbGl2aW5nOiAgICBcIkxpdmluZyBhcyBDaHJpc3RpYW5zXCIsXG4gIGNsb3Npbmc6ICAgXCJDbG9zaW5nXCIsXG59O1xuXG5leHBvcnQgY2xhc3MgSndUaW1lclZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gIHByaXZhdGUgc2NoZWR1bGU6IFdlZWtseVNjaGVkdWxlIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgd2Vla0tleSA9IFwiXCI7XG4gIHByaXZhdGUgY2FyZHMgPSBuZXcgTWFwPG51bWJlciwgQ2FyZFJlZnM+KCk7XG4gIHByaXZhdGUgdGlja0hhbmRsZTogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgc3RhdHVzRWwhOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBsaXN0RWwhOiBIVE1MRWxlbWVudDtcblxuICBjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmLCBwcml2YXRlIHJlYWRvbmx5IHBsdWdpbjogSndUaW1lclBsdWdpbikge1xuICAgIHN1cGVyKGxlYWYpO1xuICB9XG5cbiAgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHsgcmV0dXJuIFZJRVdfVFlQRV9KV19USU1FUjsgfVxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcgeyByZXR1cm4gXCJKVyBNZWV0aW5nIFRpbWVyXCI7IH1cbiAgZ2V0SWNvbigpOiBzdHJpbmcgeyByZXR1cm4gXCJ0aW1lclwiOyB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJvb3QgPSB0aGlzLmNvbnRlbnRFbDtcbiAgICByb290LmVtcHR5KCk7XG4gICAgcm9vdC5hZGRDbGFzcyhcImp3LXRpbWVyLXJvb3RcIik7XG5cbiAgICB0aGlzLnN0YXR1c0VsID0gcm9vdC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItc3RhdHVzXCIgfSk7XG4gICAgdGhpcy5saXN0RWwgPSByb290LmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1saXN0XCIgfSk7XG5cbiAgICB0aGlzLnRpY2tIYW5kbGUgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy50aWNrKCksIDI1MCk7XG5cbiAgICBhd2FpdCB0aGlzLmxvYWRTY2hlZHVsZSgpO1xuICB9XG5cbiAgYXN5bmMgb25DbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy50aWNrSGFuZGxlICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLnRpY2tIYW5kbGUpO1xuICAgICAgdGhpcy50aWNrSGFuZGxlID0gbnVsbDtcbiAgICB9XG4gICAgYXdhaXQgdGhpcy5wbHVnaW4ucGVyc2lzdFRpbWVycygpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFB1YmxpYzogY2FsbGVkIGJ5IHBsdWdpbiB3aGVuIHNldHRpbmdzIGNoYW5nZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBhc3luYyByZWxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5zY2hlZHVsZSA9IG51bGw7XG4gICAgdGhpcy5jYXJkcy5jbGVhcigpO1xuICAgIHRoaXMubGlzdEVsLmVtcHR5KCk7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2NoZWR1bGUoKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBTY2hlZHVsZSBsb2FkaW5nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZFNjaGVkdWxlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHllYXIgPSBuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCk7XG4gICAgY29uc3Qgd2VlayA9IGN1cnJlbnRXZWVrTnVtYmVyKCk7XG4gICAgdGhpcy53ZWVrS2V5ID0gY2FjaGVLZXkoeWVhciwgd2Vlayk7XG5cbiAgICAvLyBUcnkgY2FjaGUgZmlyc3RcbiAgICBsZXQgc2NoZWR1bGUgPSB0aGlzLnBsdWdpbi5nZXRDYWNoZWRTY2hlZHVsZSh0aGlzLndlZWtLZXkpO1xuXG4gICAgaWYgKCFzY2hlZHVsZSkge1xuICAgICAgdGhpcy5zZXRTdGF0dXMoXCJsb2FkaW5nXCIsIFwiRmV0Y2hpbmcgbWVldGluZyBzY2hlZHVsZSBmcm9tIHdvbC5qdy5vcmdcdTIwMjZcIik7XG4gICAgICBzY2hlZHVsZSA9IGF3YWl0IGZldGNoV2Vla1NjaGVkdWxlKHRoaXMucGx1Z2luLnNldHRpbmdzLndvbExvY2FsZSwgeWVhciwgd2Vlayk7XG4gICAgICBpZiAoc2NoZWR1bGUpIHtcbiAgICAgICAgdGhpcy5wbHVnaW4uY2FjaGVTY2hlZHVsZSh0aGlzLndlZWtLZXksIHNjaGVkdWxlKTtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFzY2hlZHVsZSkge1xuICAgICAgdGhpcy5zZXRTdGF0dXMoXCJlcnJvclwiLCBcIkNvdWxkIG5vdCBsb2FkIHNjaGVkdWxlLiBDaGVjayB5b3VyIGNvbm5lY3Rpb24gYW5kIGxhbmd1YWdlIHNldHRpbmcuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc2NoZWR1bGUgPSBzY2hlZHVsZTtcbiAgICB0aGlzLnNldFN0YXR1cyhcIm9rXCIsIGAke3NjaGVkdWxlLndlZWtMYWJlbH1gKTtcbiAgICB0aGlzLnJlbmRlclNjaGVkdWxlKHNjaGVkdWxlKTtcbiAgfVxuXG4gIHByaXZhdGUgc2V0U3RhdHVzKHR5cGU6IFwib2tcIiB8IFwibG9hZGluZ1wiIHwgXCJlcnJvclwiLCB0ZXh0OiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLnN0YXR1c0VsLmVtcHR5KCk7XG4gICAgdGhpcy5zdGF0dXNFbC5jbGFzc05hbWUgPSBganctdGltZXItc3RhdHVzIGp3LXRpbWVyLXN0YXR1cy0tJHt0eXBlfWA7XG4gICAgdGhpcy5zdGF0dXNFbC5zZXRUZXh0KHRleHQpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFJlbmRlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIHJlbmRlclNjaGVkdWxlKHNjaGVkdWxlOiBXZWVrbHlTY2hlZHVsZSk6IHZvaWQge1xuICAgIHRoaXMubGlzdEVsLmVtcHR5KCk7XG4gICAgdGhpcy5jYXJkcy5jbGVhcigpO1xuXG4gICAgLy8gQ29tcHV0ZSBzY2hlZHVsZWQgc3RhcnQtb2YtcGFydCB0aW1lc1xuICAgIGNvbnN0IHN0YXJ0TWludXRlcyA9IHRpbWVUb01pbnV0ZXModGhpcy5wbHVnaW4uc2V0dGluZ3MubWVldGluZ1N0YXJ0VGltZSk7XG4gICAgLy8gQWRkIG9wZW5pbmcgc29uZyBvZmZzZXQgKHNvbmcrcHJheWVyIGJlZm9yZSBmaXJzdCBwcm9ncmFtbWUgaXRlbSlcbiAgICBsZXQgY3Vyc29yID0gc3RhcnRNaW51dGVzICsgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmluZ1NvbmdNaW51dGVzO1xuXG4gICAgLy8gQnVpbGQgb2Zmc2V0IG1hcDogcGFydE9yZGVyIFx1MjE5MiBzY2hlZHVsZWQgc3RhcnQgKG1pbnV0ZXMgZnJvbSBtaWRuaWdodClcbiAgICBjb25zdCBzY2hlZHVsZWRTdGFydCA9IG5ldyBNYXA8bnVtYmVyLCBudW1iZXI+KCk7XG4gICAgZm9yIChjb25zdCBwYXJ0IG9mIHNjaGVkdWxlLnBhcnRzKSB7XG4gICAgICBzY2hlZHVsZWRTdGFydC5zZXQocGFydC5vcmRlciwgY3Vyc29yKTtcbiAgICAgIGN1cnNvciArPSBNYXRoLmNlaWwocGFydC5kdXJhdGlvblNlYyAvIDYwKTtcbiAgICB9XG5cbiAgICAvLyBHcm91cCBwYXJ0cyBieSBzZWN0aW9uXG4gICAgY29uc3Qgc2VjdGlvbnMgPSBuZXcgTWFwPHN0cmluZywgTWVldGluZ1BhcnRbXT4oKTtcbiAgICBmb3IgKGNvbnN0IHBhcnQgb2Ygc2NoZWR1bGUucGFydHMpIHtcbiAgICAgIGNvbnN0IGxpc3QgPSBzZWN0aW9ucy5nZXQocGFydC5zZWN0aW9uKSA/PyBbXTtcbiAgICAgIGxpc3QucHVzaChwYXJ0KTtcbiAgICAgIHNlY3Rpb25zLnNldChwYXJ0LnNlY3Rpb24sIGxpc3QpO1xuICAgIH1cblxuICAgIGNvbnN0IHNlY3Rpb25PcmRlcjogc3RyaW5nW10gPSBbXCJvcGVuaW5nXCIsIFwidHJlYXN1cmVzXCIsIFwibWluaXN0cnlcIiwgXCJsaXZpbmdcIiwgXCJjbG9zaW5nXCJdO1xuICAgIGZvciAoY29uc3Qgc2VjdGlvbktleSBvZiBzZWN0aW9uT3JkZXIpIHtcbiAgICAgIGNvbnN0IHBhcnRzID0gc2VjdGlvbnMuZ2V0KHNlY3Rpb25LZXkpO1xuICAgICAgaWYgKCFwYXJ0cz8ubGVuZ3RoKSBjb250aW51ZTtcblxuICAgICAgY29uc3Qgc2VjdGlvbkVsID0gdGhpcy5saXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLXNlY3Rpb25cIiB9KTtcbiAgICAgIHNlY3Rpb25FbC5jcmVhdGVFbChcImgzXCIsIHtcbiAgICAgICAgY2xzOiBcImp3LXRpbWVyLXNlY3Rpb24tdGl0bGVcIixcbiAgICAgICAgdGV4dDogU0VDVElPTl9MQUJFTFNbc2VjdGlvbktleV0gPz8gc2VjdGlvbktleSxcbiAgICAgIH0pO1xuXG4gICAgICBmb3IgKGNvbnN0IHBhcnQgb2YgcGFydHMpIHtcbiAgICAgICAgdGhpcy5yZW5kZXJDYXJkKHNlY3Rpb25FbCwgcGFydCwgc2NoZWR1bGVkU3RhcnQuZ2V0KHBhcnQub3JkZXIpID8/IHN0YXJ0TWludXRlcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJDYXJkKFxuICAgIHBhcmVudEVsOiBIVE1MRWxlbWVudCxcbiAgICBwYXJ0OiBNZWV0aW5nUGFydCxcbiAgICBzY2hlZHVsZWRTdGFydE1pbnM6IG51bWJlclxuICApOiB2b2lkIHtcbiAgICBjb25zdCBjYXJkID0gcGFyZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNhcmRcIiB9KTtcblxuICAgIC8vIFRpdGxlIHJvd1xuICAgIGNvbnN0IHRpdGxlUm93ID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2FyZC1oZWFkZXJcIiB9KTtcbiAgICB0aXRsZVJvdy5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2FyZC10aXRsZVwiLCB0ZXh0OiBwYXJ0LmxhYmVsIH0pO1xuICAgIHRpdGxlUm93LmNyZWF0ZURpdih7XG4gICAgICBjbHM6IFwianctdGltZXItY2FyZC1hbGxvdHRlZFwiLFxuICAgICAgdGV4dDogYCR7TWF0aC5yb3VuZChwYXJ0LmR1cmF0aW9uU2VjIC8gNjApfSBtaW5gLFxuICAgIH0pO1xuXG4gICAgLy8gU2NoZWR1bGVkIHN0YXJ0IHRpbWVcbiAgICBjYXJkLmNyZWF0ZURpdih7XG4gICAgICBjbHM6IFwianctdGltZXItY2FyZC1zdGFydC10aW1lXCIsXG4gICAgICB0ZXh0OiBgU3RhcnRzIFx1MjI0OCAke21pbnV0ZXNUb1RpbWUoc2NoZWR1bGVkU3RhcnRNaW5zKX1gLFxuICAgIH0pO1xuXG4gICAgLy8gUHJvZ3Jlc3MgYmFyXG4gICAgY29uc3QgYmFyRWwgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1iYXJcIiB9KTtcbiAgICBjb25zdCBiYXJGaWxsRWwgPSBiYXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItYmFyLWZpbGxcIiB9KTtcblxuICAgIC8vIENsb2NrIHJvd1xuICAgIGNvbnN0IGNsb2NrUm93ID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2xvY2stcm93XCIgfSk7XG4gICAgY29uc3QgZWxhcHNlZEVsID0gY2xvY2tSb3cuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWVsYXBzZWRcIiwgdGV4dDogXCIwMDowMFwiIH0pO1xuICAgIGNvbnN0IGRlbHRhRWwgPSBjbG9ja1Jvdy5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItZGVsdGFcIiB9KTtcblxuICAgIC8vIENvbnRyb2xzXG4gICAgY29uc3QgY29udHJvbHMgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jb250cm9sc1wiIH0pO1xuXG4gICAgY29uc3QgcGxheUJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImp3LXRpbWVyLWJ0biBqdy10aW1lci1idG4tcGxheVwiLCB0ZXh0OiBcIlx1MjVCNlwiIH0pO1xuICAgIHBsYXlCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJTdGFydCB0aW1lclwiKTtcblxuICAgIGNvbnN0IHJlc2V0QnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwianctdGltZXItYnRuIGp3LXRpbWVyLWJ0bi1yZXNldFwiLCB0ZXh0OiBcIlx1MjFCQVwiIH0pO1xuICAgIHJlc2V0QnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiUmVzZXQgdGltZXJcIik7XG5cbiAgICAvLyBXaXJlIGV2ZW50c1xuICAgIHBsYXlCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHRoaXMuaGFuZGxlUGxheVBhdXNlKHBhcnQpKTtcbiAgICByZXNldEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5oYW5kbGVSZXNldChwYXJ0KSk7XG5cbiAgICB0aGlzLmNhcmRzLnNldChwYXJ0Lm9yZGVyLCB7IGNhcmRFbDogY2FyZCwgZWxhcHNlZEVsLCBkZWx0YUVsLCBwbGF5QnRuLCByZXNldEJ0biwgYmFyRmlsbEVsIH0pO1xuICAgIHRoaXMudXBkYXRlQ2FyZChwYXJ0LCBzY2hlZHVsZWRTdGFydE1pbnMpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRpbWVyIGNvbnRyb2xzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgaGFuZGxlUGxheVBhdXNlKHBhcnQ6IE1lZXRpbmdQYXJ0KTogdm9pZCB7XG4gICAgY29uc3Qgc25hcCA9IHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLmdldCh0aGlzLndlZWtLZXksIHBhcnQub3JkZXIpO1xuICAgIGlmIChzbmFwLnN0YXR1cyA9PT0gXCJydW5uaW5nXCIpIHtcbiAgICAgIHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLnBhdXNlKHRoaXMud2Vla0tleSwgcGFydC5vcmRlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLnN0YXJ0KHRoaXMud2Vla0tleSwgcGFydC5vcmRlcik7XG4gICAgfVxuICAgIHRoaXMudXBkYXRlQ2FyZEJ5T3JkZXIocGFydCk7XG4gIH1cblxuICBwcml2YXRlIGhhbmRsZVJlc2V0KHBhcnQ6IE1lZXRpbmdQYXJ0KTogdm9pZCB7XG4gICAgdGhpcy5wbHVnaW4udGltZXJFbmdpbmUucmVzZXQodGhpcy53ZWVrS2V5LCBwYXJ0Lm9yZGVyKTtcbiAgICB0aGlzLnVwZGF0ZUNhcmRCeU9yZGVyKHBhcnQpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRpY2sgJiBkaXNwbGF5IHVwZGF0ZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIHRpY2soKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnNjaGVkdWxlKSByZXR1cm47XG4gICAgZm9yIChjb25zdCBwYXJ0IG9mIHRoaXMuc2NoZWR1bGUucGFydHMpIHtcbiAgICAgIGNvbnN0IHNuYXAgPSB0aGlzLnBsdWdpbi50aW1lckVuZ2luZS5nZXQodGhpcy53ZWVrS2V5LCBwYXJ0Lm9yZGVyKTtcbiAgICAgIGlmIChzbmFwLnN0YXR1cyA9PT0gXCJydW5uaW5nXCIpIHtcbiAgICAgICAgdGhpcy51cGRhdGVDYXJkQnlPcmRlcihwYXJ0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUNhcmRCeU9yZGVyKHBhcnQ6IE1lZXRpbmdQYXJ0KTogdm9pZCB7XG4gICAgY29uc3Qgc3RhcnRNaW51dGVzID0gdGltZVRvTWludXRlcyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5tZWV0aW5nU3RhcnRUaW1lKTtcbiAgICBsZXQgY3Vyc29yID0gc3RhcnRNaW51dGVzICsgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmluZ1NvbmdNaW51dGVzO1xuICAgIGxldCBzY2hlZHVsZWRTdGFydCA9IGN1cnNvcjtcbiAgICBmb3IgKGNvbnN0IHAgb2YgKHRoaXMuc2NoZWR1bGU/LnBhcnRzID8/IFtdKSkge1xuICAgICAgaWYgKHAub3JkZXIgPT09IHBhcnQub3JkZXIpIHsgc2NoZWR1bGVkU3RhcnQgPSBjdXJzb3I7IGJyZWFrOyB9XG4gICAgICBjdXJzb3IgKz0gTWF0aC5jZWlsKHAuZHVyYXRpb25TZWMgLyA2MCk7XG4gICAgfVxuICAgIHRoaXMudXBkYXRlQ2FyZChwYXJ0LCBzY2hlZHVsZWRTdGFydCk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUNhcmQocGFydDogTWVldGluZ1BhcnQsIHNjaGVkdWxlZFN0YXJ0TWluczogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgcmVmcyA9IHRoaXMuY2FyZHMuZ2V0KHBhcnQub3JkZXIpO1xuICAgIGlmICghcmVmcykgcmV0dXJuO1xuXG4gICAgY29uc3Qgc25hcCA9IHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLmdldCh0aGlzLndlZWtLZXksIHBhcnQub3JkZXIpO1xuICAgIGNvbnN0IHsgZWxhcHNlZE1zLCBzdGF0dXMgfSA9IHNuYXA7XG4gICAgY29uc3QgZHVyYXRpb25NcyA9IHBhcnQuZHVyYXRpb25TZWMgKiAxMDAwO1xuXG4gICAgLy8gRWxhcHNlZCBkaXNwbGF5XG4gICAgcmVmcy5lbGFwc2VkRWwuc2V0VGV4dChmb3JtYXRNbVNzKGVsYXBzZWRNcykpO1xuXG4gICAgLy8gUHJvZ3Jlc3MgYmFyXG4gICAgY29uc3QgcGN0ID0gTWF0aC5taW4oMSwgZWxhcHNlZE1zIC8gZHVyYXRpb25Ncyk7XG4gICAgcmVmcy5iYXJGaWxsRWwuc3R5bGUud2lkdGggPSBgJHsocGN0ICogMTAwKS50b0ZpeGVkKDEpfSVgO1xuXG4gICAgLy8gRGVsdGEgdnMgYWxsb3dlZFxuICAgIGNvbnN0IHJlbWFpbmluZ01zID0gZHVyYXRpb25NcyAtIGVsYXBzZWRNcztcbiAgICBpZiAoc3RhdHVzID09PSBcImlkbGVcIikge1xuICAgICAgcmVmcy5kZWx0YUVsLnNldFRleHQoYCR7TWF0aC5yb3VuZChwYXJ0LmR1cmF0aW9uU2VjIC8gNjApfSBtaW4gYWxsb3R0ZWRgKTtcbiAgICAgIHJlZnMuZGVsdGFFbC5jbGFzc05hbWUgPSBcImp3LXRpbWVyLWRlbHRhIGp3LXRpbWVyLWRlbHRhLS1uZXV0cmFsXCI7XG4gICAgfSBlbHNlIGlmIChyZW1haW5pbmdNcyA+PSAwKSB7XG4gICAgICByZWZzLmRlbHRhRWwuc2V0VGV4dChgXHUyMjEyJHtmb3JtYXRNbVNzKHJlbWFpbmluZ01zKX0gbGVmdGApO1xuICAgICAgcmVmcy5kZWx0YUVsLmNsYXNzTmFtZSA9IFwianctdGltZXItZGVsdGEganctdGltZXItZGVsdGEtLW9rXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZnMuZGVsdGFFbC5zZXRUZXh0KGArJHtmb3JtYXRNbVNzKC1yZW1haW5pbmdNcyl9IG92ZXJgKTtcbiAgICAgIHJlZnMuZGVsdGFFbC5jbGFzc05hbWUgPSBcImp3LXRpbWVyLWRlbHRhIGp3LXRpbWVyLWRlbHRhLS1vdmVyXCI7XG4gICAgfVxuXG4gICAgLy8gQ2FyZCBjb2xvdXIgc3RhdGVcbiAgICBjb25zdCBzdGF0ZSA9IGNvbG9yU3RhdGUoZWxhcHNlZE1zLCBwYXJ0LmR1cmF0aW9uU2VjLCBzdGF0dXMpO1xuICAgIHJlZnMuY2FyZEVsLnNldEF0dHJpYnV0ZShcImRhdGEtc3RhdGVcIiwgc3RhdGUpO1xuXG4gICAgLy8gUGxheSBidXR0b24gbGFiZWxcbiAgICBpZiAoc3RhdHVzID09PSBcInJ1bm5pbmdcIikge1xuICAgICAgcmVmcy5wbGF5QnRuLnNldFRleHQoXCJcdTIzRjhcIik7XG4gICAgICByZWZzLnBsYXlCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJQYXVzZSB0aW1lclwiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVmcy5wbGF5QnRuLnNldFRleHQoXCJcdTI1QjZcIik7XG4gICAgICByZWZzLnBsYXlCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgc3RhdHVzID09PSBcInBhdXNlZFwiID8gXCJSZXN1bWUgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgcmVxdWVzdFVybCB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgeyBXZWVrbHlTY2hlZHVsZSwgTWVldGluZ1BhcnQsIE1lZXRpbmdTZWN0aW9uIH0gZnJvbSBcIi4vdHlwZXNcIjtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFVSTCBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4vKiogUmV0dXJucyB0aGUgSVNPIHdlZWsgbnVtYmVyICgxLTUzKSBmb3IgYSBnaXZlbiBkYXRlLiAqL1xuZnVuY3Rpb24gaXNvV2VlayhkYXRlOiBEYXRlKTogbnVtYmVyIHtcbiAgY29uc3QgZCA9IG5ldyBEYXRlKERhdGUuVVRDKGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpLCBkYXRlLmdldERhdGUoKSkpO1xuICBkLnNldFVUQ0RhdGUoZC5nZXRVVENEYXRlKCkgKyA0IC0gKGQuZ2V0VVRDRGF5KCkgfHwgNykpO1xuICBjb25zdCB5ZWFyU3RhcnQgPSBuZXcgRGF0ZShEYXRlLlVUQyhkLmdldFVUQ0Z1bGxZZWFyKCksIDAsIDEpKTtcbiAgcmV0dXJuIE1hdGguY2VpbCgoKGQuZ2V0VGltZSgpIC0geWVhclN0YXJ0LmdldFRpbWUoKSkgLyA4Nl80MDBfMDAwICsgMSkgLyA3KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJlbnRXZWVrTnVtYmVyKCk6IG51bWJlciB7XG4gIHJldHVybiBpc29XZWVrKG5ldyBEYXRlKCkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRXb2xVcmwobG9jYWxlOiBzdHJpbmcsIHllYXI6IG51bWJlciwgd2VlazogbnVtYmVyKTogc3RyaW5nIHtcbiAgcmV0dXJuIGBodHRwczovL3dvbC5qdy5vcmcvZW4vd29sL21lZXRpbmdzLyR7bG9jYWxlfS8ke3llYXJ9LyR7d2Vla31gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2FjaGVLZXkoeWVhcjogbnVtYmVyLCB3ZWVrOiBudW1iZXIpOiBzdHJpbmcge1xuICByZXR1cm4gYCR7eWVhcn0tJHtTdHJpbmcod2VlaykucGFkU3RhcnQoMiwgXCIwXCIpfWA7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBGaXhlZCBkdXJhdGlvbiBjb25zdGFudHMgKHNlY29uZHMpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jb25zdCBTT05HX1NFQyA9IDUgKiA2MDsgICAgICAgLy8gb3BlbmluZyAvIG1pZCBzb25nXG5jb25zdCBQUkFZRVJfU0VDID0gMSAqIDYwO1xuXG4vLyBQYXJ0cyB3aG9zZSBkdXJhdGlvbnMgY2Fubm90IGJlIHJlYWQgZnJvbSB0aGUgcGFnZSB0ZXh0XG5jb25zdCBGSVhFRF9EVVJBVElPTlM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gIG9wZW5pbmdfY29tbWVudHM6IDEgKiA2MCxcbiAgbWlkX3Nvbmc6IFNPTkdfU0VDLFxuICBjb25jbHVkaW5nX2NvbW1lbnRzOiAzICogNjAsXG59O1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2NyYXBlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqIFJlZ2V4IHRvIGV4dHJhY3QgZHVyYXRpb24gaW4gbWludXRlcyBmcm9tIHN0cmluZ3MgbGlrZSBcIigxMCBtaW4uKVwiIG9yIFwiKDIgbWluLilcIiAqL1xuY29uc3QgRFVSQVRJT05fUkUgPSAvXFwoKFxcZCspXFxzKm1pblxcLlxcKS9pO1xuXG5mdW5jdGlvbiBwYXJzZUR1cmF0aW9uKHRleHQ6IHN0cmluZyk6IG51bWJlciB8IG51bGwge1xuICBjb25zdCBtID0gRFVSQVRJT05fUkUuZXhlYyh0ZXh0KTtcbiAgcmV0dXJuIG0gPyBwYXJzZUludChtWzFdLCAxMCkgKiA2MCA6IG51bGw7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaFdlZWtTY2hlZHVsZShcbiAgbG9jYWxlOiBzdHJpbmcsXG4gIHllYXI6IG51bWJlcixcbiAgd2VlazogbnVtYmVyXG4pOiBQcm9taXNlPFdlZWtseVNjaGVkdWxlIHwgbnVsbD4ge1xuICAvLyBTdGVwIDE6IGZldGNoIHRoZSBtZWV0aW5ncyBpbmRleCBwYWdlIHRvIGZpbmQgdGhlIGRvYyBsaW5rIGZvciB0aGlzIHdlZWtcbiAgY29uc3QgbWVldGluZ3NVcmwgPSBidWlsZFdvbFVybChsb2NhbGUsIHllYXIsIHdlZWspO1xuXG4gIGxldCBtZWV0aW5nc0h0bWw6IHN0cmluZztcbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwID0gYXdhaXQgcmVxdWVzdFVybCh7XG4gICAgICB1cmw6IG1lZXRpbmdzVXJsLFxuICAgICAgaGVhZGVyczogeyBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgSldUaW1lck9ic2lkaWFuLzIuMClcIiB9LFxuICAgIH0pO1xuICAgIGlmIChyZXNwLnN0YXR1cyA8IDIwMCB8fCByZXNwLnN0YXR1cyA+PSAzMDApIHJldHVybiBudWxsO1xuICAgIG1lZXRpbmdzSHRtbCA9IHJlc3AudGV4dDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBFeHRyYWN0IHRoZSB3b3JrYm9vayBkb2MgcGF0aCBcdTIwMTQgV09MIHVzZXMgcmVsYXRpdmUgaHJlZnMgbGlrZSAvZW4vd29sL2QvPGxvY2FsZT4vPGRvY0lkPlxuICBjb25zdCBkb2NMaW5rUmUgPSAvaHJlZj1cIihcXC9bXlwiXStcXC93b2xcXC9kXFwvW15cIiM/XSspXCIvZztcbiAgY29uc3QgZG9jTGlua3M6IHN0cmluZ1tdID0gW107XG4gIGxldCBtOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuICB3aGlsZSAoKG0gPSBkb2NMaW5rUmUuZXhlYyhtZWV0aW5nc0h0bWwpKSAhPT0gbnVsbCkge1xuICAgIGNvbnN0IGhyZWYgPSBtWzFdO1xuICAgIC8vIE1XQiBkb2NJZHMgYXJlIDkrIGRpZ2l0czsgV2F0Y2h0b3dlciBzdHVkeSBkb2NJZHMgYXJlIHNob3J0ZXJcbiAgICBpZiAoL1xcL1xcZHs5LH0kLy50ZXN0KGhyZWYpKSB7XG4gICAgICBkb2NMaW5rcy5wdXNoKGhyZWYpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChkb2NMaW5rcy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuXG4gIC8vIEZpcnN0IDktZGlnaXQgbGluayBpcyB0aGUgTVdCIHdlZWtcbiAgY29uc3QgbXdiRG9jUGF0aCA9IGRvY0xpbmtzWzBdO1xuXG4gIC8vIFN0ZXAgMjogZmV0Y2ggdGhlIGFjdHVhbCB3b3JrYm9vayBhcnRpY2xlIHBhZ2VcbiAgY29uc3QgZG9jVXJsID0gYGh0dHBzOi8vd29sLmp3Lm9yZyR7bXdiRG9jUGF0aH1gO1xuICBsZXQgZG9jSHRtbDogc3RyaW5nO1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3AgPSBhd2FpdCByZXF1ZXN0VXJsKHtcbiAgICAgIHVybDogZG9jVXJsLFxuICAgICAgaGVhZGVyczogeyBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgSldUaW1lck9ic2lkaWFuLzIuMClcIiB9LFxuICAgIH0pO1xuICAgIGlmIChyZXNwLnN0YXR1cyA8IDIwMCB8fCByZXNwLnN0YXR1cyA+PSAzMDApIHJldHVybiBudWxsO1xuICAgIGRvY0h0bWwgPSByZXNwLnRleHQ7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIHBhcnNlRG9jUGFnZShkb2NIdG1sLCB5ZWFyLCB3ZWVrKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEhUTUwgcGFyc2UgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHN0cmlwSHRtbFRhZ3MoaHRtbDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGh0bWwucmVwbGFjZSgvPFtePl0rPi9nLCBcIiBcIikucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xufVxuXG5mdW5jdGlvbiBkZWNvZGVIdG1sRW50aXRpZXModGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHRleHRcbiAgICAucmVwbGFjZSgvJmFtcDsvZywgXCImXCIpXG4gICAgLnJlcGxhY2UoLyZsdDsvZywgXCI8XCIpXG4gICAgLnJlcGxhY2UoLyZndDsvZywgXCI+XCIpXG4gICAgLnJlcGxhY2UoLyZxdW90Oy9nLCAnXCInKVxuICAgIC5yZXBsYWNlKC8mIzM5Oy9nLCBcIidcIilcbiAgICAucmVwbGFjZSgvJm5ic3A7L2csIFwiIFwiKTtcbn1cblxuZnVuY3Rpb24gY2xlYW5UZXh0KGh0bWw6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBkZWNvZGVIdG1sRW50aXRpZXMoc3RyaXBIdG1sVGFncyhodG1sKSkudHJpbSgpO1xufVxuXG5mdW5jdGlvbiBwYXJzZURvY1BhZ2UoaHRtbDogc3RyaW5nLCB5ZWFyOiBudW1iZXIsIHdlZWs6IG51bWJlcik6IFdlZWtseVNjaGVkdWxlIHwgbnVsbCB7XG4gIC8vIFx1MjUwMFx1MjUwMCBFeHRyYWN0IHdlZWsgbGFiZWwgZnJvbSBoMSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3QgaDFNYXRjaCA9IC88aDFbXj5dKj4oW1xcc1xcU10qPyk8XFwvaDE+L2kuZXhlYyhodG1sKTtcbiAgY29uc3Qgd2Vla0xhYmVsID0gaDFNYXRjaCA/IGNsZWFuVGV4dChoMU1hdGNoWzFdKSA6IGBXZWVrICR7d2Vla31gO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBTcGxpdCBpbnRvIHNlY3Rpb25zIGJ5IGgyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAvLyBTZWN0aW9uczogVFJFQVNVUkVTIEZST00gR09EJ1MgV09SRCAvIEFQUExZIFlPVVJTRUxGIFRPIFRIRSBGSUVMRCBNSU5JU1RSWSAvIExJVklORyBBUyBDSFJJU1RJQU5TXG4gIGNvbnN0IHBhcnRzOiBNZWV0aW5nUGFydFtdID0gW107XG4gIGxldCBvcmRlciA9IDA7XG5cbiAgLy8gT3BlbmluZzogU29uZyArIFByYXllciArIENvbW1lbnRzXG4gIHBhcnRzLnB1c2goeyBsYWJlbDogXCJTb25nIGFuZCBQcmF5ZXJcIiwgc2VjdGlvbjogXCJvcGVuaW5nXCIsIGR1cmF0aW9uU2VjOiBTT05HX1NFQyArIFBSQVlFUl9TRUMsIG9yZGVyOiBvcmRlcisrIH0pO1xuICBwYXJ0cy5wdXNoKHsgbGFiZWw6IFwiT3BlbmluZyBDb21tZW50c1wiLCBzZWN0aW9uOiBcIm9wZW5pbmdcIiwgZHVyYXRpb25TZWM6IEZJWEVEX0RVUkFUSU9OUy5vcGVuaW5nX2NvbW1lbnRzLCBvcmRlcjogb3JkZXIrKyB9KTtcblxuICAvLyBQYXJzZSBoMyBoZWFkaW5ncyB3aXRoIHRoZWlyIGlubGluZSBjb250ZW50XG4gIC8vIFBhdHRlcm46IDxoMy4uLj5USVRMRTwvaDM+IGZvbGxvd2VkIHNob3J0bHkgYnkgZHVyYXRpb24gdGV4dFxuICBjb25zdCBoM1JlID0gLzxoM1tePl0qPihbXFxzXFxTXSo/KTxcXC9oMz4oW1xcc1xcU10qPykoPz08aDN8PGgyfDxcXC9hcnRpY2xlfCQpL2dpO1xuICBjb25zdCBoMlJlID0gLzxoMltePl0qPihbXFxzXFxTXSo/KTxcXC9oMj4vZ2k7XG5cbiAgLy8gQnVpbGQgc2VjdGlvbiBib3VuZGFyaWVzIGZyb20gaDIgcG9zaXRpb25zXG4gIHR5cGUgU2VjdGlvbkJvdW5kYXJ5ID0geyBwb3M6IG51bWJlcjsgc2VjdGlvbjogTWVldGluZ1NlY3Rpb24gfTtcbiAgY29uc3QgYm91bmRhcmllczogU2VjdGlvbkJvdW5kYXJ5W10gPSBbXTtcblxuICAvLyBPcGVuaW5nIGlzIGV2ZXJ5dGhpbmcgYmVmb3JlIGZpcnN0IGgyIHdlIGNhcmUgYWJvdXRcbiAgbGV0IGgybTogUmVnRXhwRXhlY0FycmF5IHwgbnVsbDtcbiAgd2hpbGUgKChoMm0gPSBoMlJlLmV4ZWMoaHRtbCkpICE9PSBudWxsKSB7XG4gICAgY29uc3QgdGV4dCA9IGNsZWFuVGV4dChoMm1bMV0pLnRvVXBwZXJDYXNlKCk7XG4gICAgbGV0IHNlYzogTWVldGluZ1NlY3Rpb24gfCBudWxsID0gbnVsbDtcbiAgICBpZiAodGV4dC5pbmNsdWRlcyhcIlRSRUFTVVJFU1wiKSkgc2VjID0gXCJ0cmVhc3VyZXNcIjtcbiAgICBlbHNlIGlmICh0ZXh0LmluY2x1ZGVzKFwiQVBQTFkgWU9VUlNFTEZcIikgfHwgdGV4dC5pbmNsdWRlcyhcIkZJRUxEIE1JTklTVFJZXCIpKSBzZWMgPSBcIm1pbmlzdHJ5XCI7XG4gICAgZWxzZSBpZiAodGV4dC5pbmNsdWRlcyhcIkxJVklORyBBUyBDSFJJU1RJQU5TXCIpKSBzZWMgPSBcImxpdmluZ1wiO1xuICAgIGlmIChzZWMpIGJvdW5kYXJpZXMucHVzaCh7IHBvczogaDJtLmluZGV4LCBzZWN0aW9uOiBzZWMgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBzZWN0aW9uRm9yUG9zKHBvczogbnVtYmVyKTogTWVldGluZ1NlY3Rpb24ge1xuICAgIGxldCBzZWM6IE1lZXRpbmdTZWN0aW9uID0gXCJvcGVuaW5nXCI7XG4gICAgZm9yIChjb25zdCBiIG9mIGJvdW5kYXJpZXMpIHtcbiAgICAgIGlmIChwb3MgPj0gYi5wb3MpIHNlYyA9IGIuc2VjdGlvbjtcbiAgICB9XG4gICAgcmV0dXJuIHNlYztcbiAgfVxuXG4gIC8vIE1pZC1zZWN0aW9uIHNvbmcgKGJldHdlZW4gbWluaXN0cnkgYW5kIGxpdmluZylcbiAgbGV0IG1pZFNvbmdJbnNlcnRlZCA9IGZhbHNlO1xuXG4gIGxldCBoM206IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG4gIHdoaWxlICgoaDNtID0gaDNSZS5leGVjKGh0bWwpKSAhPT0gbnVsbCkge1xuICAgIGNvbnN0IHRpdGxlSHRtbCA9IGgzbVsxXTtcbiAgICBjb25zdCBib2R5SHRtbCA9IGgzbVsyXSA/PyBcIlwiO1xuICAgIGNvbnN0IHRpdGxlID0gY2xlYW5UZXh0KHRpdGxlSHRtbCk7XG4gICAgY29uc3QgYm9keSA9IGNsZWFuVGV4dChib2R5SHRtbCk7XG4gICAgY29uc3QgcG9zID0gaDNtLmluZGV4O1xuXG4gICAgLy8gU2tpcCBzb25nIGhlYWRpbmdzIHRoYXQgYXJlIGp1c3QgXCJTb25nIE5cIiBcdTIwMTQgdGhleSdyZSBzZXBhcmF0b3JzLCBub3QgcHJvZ3JhbW1lIHBhcnRzXG4gICAgLy8gQnV0IHdlIERPIHdhbnQgXCJTb25nIGFuZCBQcmF5ZXJcIiBzdHlsZSBoZWFkaW5ncyBhcy1pc1xuICAgIGlmICgvXnNvbmdcXHMrXFxkKyQvaS50ZXN0KHRpdGxlKSkge1xuICAgICAgY29uc3Qgc2VjID0gc2VjdGlvbkZvclBvcyhwb3MpO1xuICAgICAgLy8gSW5zZXJ0IG1pZC1zb25nIG1hcmtlciBiZWZvcmUgTElWSU5HIHNlY3Rpb25cbiAgICAgIGlmIChzZWMgPT09IFwibGl2aW5nXCIgJiYgIW1pZFNvbmdJbnNlcnRlZCkge1xuICAgICAgICBwYXJ0cy5wdXNoKHsgbGFiZWw6IHRpdGxlLCBzZWN0aW9uOiBcImxpdmluZ1wiLCBkdXJhdGlvblNlYzogU09OR19TRUMsIG9yZGVyOiBvcmRlcisrIH0pO1xuICAgICAgICBtaWRTb25nSW5zZXJ0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gU2tpcCBwdXJlIFwiU29uZyBOIGFuZCBQcmF5ZXJcIiBvcGVuaW5nIGxpbmVzIGFscmVhZHkgaGFuZGxlZFxuICAgIGlmICgvXnNvbmdcXHMrXFxkK1xccythbmRcXHMrcHJheWVyL2kudGVzdCh0aXRsZSkgJiYgb3JkZXIgPD0gMikgY29udGludWU7XG5cbiAgICAvLyBFeHRyYWN0IGR1cmF0aW9uIGZyb20gdGhlIGgzIGNvbnRlbnQgaXRzZWxmIG9yIHRoZSBmaXJzdCBsaW5lIG9mIGJvZHlcbiAgICBjb25zdCBjb21iaW5lZCA9IGAke3RpdGxlfSAke2JvZHkuc2xpY2UoMCwgODApfWA7XG4gICAgY29uc3QgZHVyYXRpb25TZWMgPSBwYXJzZUR1cmF0aW9uKGNvbWJpbmVkKTtcbiAgICBpZiAoZHVyYXRpb25TZWMgPT09IG51bGwpIGNvbnRpbnVlOyAvLyBubyBkdXJhdGlvbiA9IHNlcGFyYXRvci9zb25nL2NvbW1lbnRcblxuICAgIGNvbnN0IHNlY3Rpb24gPSBzZWN0aW9uRm9yUG9zKHBvcyk7XG5cbiAgICAvLyBTdHJpcCBkdXJhdGlvbiBhbm5vdGF0aW9uIGZyb20gbGFiZWxcbiAgICBjb25zdCBjbGVhbkxhYmVsID0gdGl0bGUucmVwbGFjZShEVVJBVElPTl9SRSwgXCJcIikucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xuXG4gICAgcGFydHMucHVzaCh7IGxhYmVsOiBjbGVhbkxhYmVsLCBzZWN0aW9uLCBkdXJhdGlvblNlYywgb3JkZXI6IG9yZGVyKysgfSk7XG4gIH1cblxuICAvLyBDbG9zaW5nXG4gIHBhcnRzLnB1c2goeyBsYWJlbDogXCJDb25jbHVkaW5nIENvbW1lbnRzXCIsIHNlY3Rpb246IFwiY2xvc2luZ1wiLCBkdXJhdGlvblNlYzogRklYRURfRFVSQVRJT05TLmNvbmNsdWRpbmdfY29tbWVudHMsIG9yZGVyOiBvcmRlcisrIH0pO1xuICBwYXJ0cy5wdXNoKHsgbGFiZWw6IFwiQ2xvc2luZyBTb25nIGFuZCBQcmF5ZXJcIiwgc2VjdGlvbjogXCJjbG9zaW5nXCIsIGR1cmF0aW9uU2VjOiBTT05HX1NFQyArIFBSQVlFUl9TRUMsIG9yZGVyOiBvcmRlcisrIH0pO1xuXG4gIGlmIChwYXJ0cy5sZW5ndGggPCA1KSByZXR1cm4gbnVsbDsgLy8gcGFyc2UgY2xlYXJseSBmYWlsZWRcblxuICByZXR1cm4ge1xuICAgIHdlZWtMYWJlbCxcbiAgICB5ZWFyLFxuICAgIHdlZWtOdW1iZXI6IHdlZWssXG4gICAgcGFydHMsXG4gICAgZmV0Y2hlZEF0OiBEYXRlLm5vdygpLFxuICB9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFBQUEsbUJBQXVCOzs7QUM4RGhCLElBQU0sbUJBQW1DO0FBQUEsRUFDOUMsV0FBVztBQUFBLEVBQ1gsa0JBQWtCO0FBQUEsRUFDbEIsb0JBQW9CO0FBQ3RCOzs7QUN6RE8sSUFBTSxjQUFOLE1BQWtCO0FBQUEsRUFBbEI7QUFDTCxTQUFRLFNBQVMsb0JBQUksSUFBd0I7QUFBQTtBQUFBLEVBRXJDLElBQUksU0FBaUIsV0FBMkI7QUFDdEQsV0FBTyxHQUFHLE9BQU8sSUFBSSxTQUFTO0FBQUEsRUFDaEM7QUFBQSxFQUVBLElBQUksU0FBaUIsV0FBa0M7QUFDckQsVUFBTSxRQUFRLEtBQUssT0FBTyxJQUFJLEtBQUssSUFBSSxTQUFTLFNBQVMsQ0FBQztBQUMxRCxRQUFJLENBQUMsTUFBTyxRQUFPLEVBQUUsV0FBVyxHQUFHLFFBQVEsT0FBTztBQUNsRCxVQUFNLFVBQVUsTUFBTSxXQUFXLE1BQU0sY0FBYyxPQUNqRCxNQUFNLGFBQWEsS0FBSyxJQUFJLElBQUksTUFBTSxhQUN0QyxNQUFNO0FBQ1YsVUFBTSxTQUFzQixNQUFNLFVBQVUsWUFBWSxNQUFNLFlBQVksSUFBSSxXQUFXO0FBQ3pGLFdBQU8sRUFBRSxXQUFXLFNBQVMsT0FBTztBQUFB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QkFBZ0Isa0JBQWtCLEVBQUUsQ0FBQztBQUNyRSxRQUFJLE1BQU0sZ0JBQWdCLGFBQWE7QUFDckMsWUFBTyxLQUFLLEtBQXFCLE9BQU87QUFBQSxJQUMxQztBQUFBLEVBQ0Y7QUFBQTtBQUFBLEVBSUEsTUFBYyxlQUE4QjtBQUMxQyxVQUFNLFdBQVcsS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLGtCQUFrQjtBQUN0RSxRQUFJLFNBQVMsUUFBUTtBQUNuQixZQUFNLEtBQUssSUFBSSxVQUFVLFdBQVcsU0FBUyxDQUFDLENBQUM7QUFDL0M7QUFBQSxJQUNGO0FBQ0EsVUFBTSxPQUFPLEtBQUssSUFBSSxVQUFVLGFBQWEsS0FBSztBQUNsRCxRQUFJLENBQUMsS0FBTTtBQUNYLFVBQU0sS0FBSyxhQUFhLEVBQUUsTUFBTSxvQkFBb0IsUUFBUSxLQUFLLENBQUM7QUFDbEUsVUFBTSxLQUFLLElBQUksVUFBVSxXQUFXLElBQUk7QUFBQSxFQUMxQztBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiJdCn0K
