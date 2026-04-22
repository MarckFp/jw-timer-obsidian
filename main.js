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
var DURATION_RE = /\((\d+)\s*mins?\.\)/i;
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
    if (/\/\d{9,}$/.test(m[1])) docLinks.push(m[1]);
  }
  if (docLinks.length === 0) return null;
  const docUrl = `https://wol.jw.org${docLinks[0]}`;
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
function cleanText(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function parseDocPage(html, year, week) {
  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const weekLabel = h1Match ? cleanText(h1Match[1]) : `Week ${week}`;
  const boundaries = [];
  const h2Re = /<h2([^>]*)>([\s\S]*?)<\/h2>/gi;
  let h2m;
  while ((h2m = h2Re.exec(html)) !== null) {
    const cls = h2m[1];
    const text = cleanText(h2m[2]).toUpperCase();
    let sec = null;
    if (cls.includes("teal-700")) sec = "treasures";
    else if (cls.includes("gold-700")) sec = "ministry";
    else if (cls.includes("maroon-600")) sec = "living";
    else if (text.includes("TREASURES")) sec = "treasures";
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
  const parts = [];
  let order = 0;
  const h3Re = /<h3([^>]*)>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|<h2|<\/article|$)/gi;
  let h3m;
  while ((h3m = h3Re.exec(html)) !== null) {
    const h3Attrs = h3m[1];
    const titleHtml = h3m[2];
    const bodyHtml = h3m[3] ?? "";
    const title = cleanText(titleHtml);
    const bodyText = cleanText(bodyHtml);
    const pos = h3m.index;
    const isSong = h3Attrs.includes("dc-icon--music");
    if (isSong) {
      const durInTitle2 = parseDuration(title);
      if (durInTitle2 === null) {
        parts.push({
          label: title,
          section: sectionForPos(pos),
          durationSec: 5 * 60,
          order: order++,
          isSeparator: true
        });
        continue;
      }
      const label = labelFromPipeSegment(title);
      if (!label) continue;
      parts.push({ label, section: sectionForPos(pos), durationSec: durInTitle2, order: order++ });
      continue;
    }
    const durInTitle = parseDuration(title);
    const durInBody = parseDuration(bodyText.slice(0, 200));
    const durationSec = durInTitle ?? durInBody;
    if (durationSec === null) continue;
    if (title.includes("|")) {
      const label = labelFromPipeSegment(title);
      if (!label) continue;
      parts.push({ label, section: "closing", durationSec, order: order++ });
      continue;
    }
    const cleanLabel = title.replace(DURATION_RE, "").replace(/\s+/g, " ").trim();
    parts.push({ label: cleanLabel, section: sectionForPos(pos), durationSec, order: order++ });
  }
  if (parts.length < 5) return null;
  return { weekLabel, year, weekNumber: week, parts, fetchedAt: Date.now() };
}
function labelFromPipeSegment(title) {
  const segments = title.split("|").map((s) => s.trim());
  const withDur = segments.find((s) => DURATION_RE.test(s));
  if (!withDur) return null;
  return withDur.replace(DURATION_RE, "").replace(/\s+/g, " ").trim() || null;
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
        if (part.isSeparator) continue;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3R5cGVzLnRzIiwgInNyYy90aW1lci1lbmdpbmUudHMiLCAic3JjL3NldHRpbmdzLXRhYi50cyIsICJzcmMvdmlldy50cyIsICJzcmMvc2NyYXBlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBERUZBVUxUX1NFVFRJTkdTIH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB0eXBlIHsgUGx1Z2luU2V0dGluZ3MsIFBsdWdpbkRhdGEsIFdlZWtseVNjaGVkdWxlLCBUaW1lclN0YXRlIH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB7IFRpbWVyRW5naW5lIH0gZnJvbSBcIi4vdGltZXItZW5naW5lXCI7XG5pbXBvcnQgeyBKd1RpbWVyU2V0dGluZ3NUYWIgfSBmcm9tIFwiLi9zZXR0aW5ncy10YWJcIjtcbmltcG9ydCB7IEp3VGltZXJWaWV3LCBWSUVXX1RZUEVfSldfVElNRVIgfSBmcm9tIFwiLi92aWV3XCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEp3VGltZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5nczogUGx1Z2luU2V0dGluZ3MgPSB7IC4uLkRFRkFVTFRfU0VUVElOR1MgfTtcbiAgdGltZXJFbmdpbmUgPSBuZXcgVGltZXJFbmdpbmUoKTtcbiAgcHJpdmF0ZSBzY2hlZHVsZUNhY2hlOiBSZWNvcmQ8c3RyaW5nLCBXZWVrbHlTY2hlZHVsZT4gPSB7fTtcbiAgcHJpdmF0ZSBzYXZlSGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgTGlmZWN5Y2xlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLmxvYWREYXRhXygpO1xuXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoVklFV19UWVBFX0pXX1RJTUVSLCAobGVhZikgPT4gbmV3IEp3VGltZXJWaWV3KGxlYWYsIHRoaXMpKTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcInRpbWVyXCIsIFwiT3BlbiBKVyBNZWV0aW5nIFRpbWVyXCIsICgpID0+IHZvaWQgdGhpcy5hY3RpdmF0ZVZpZXcoKSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwib3Blbi1qdy10aW1lclwiLFxuICAgICAgbmFtZTogXCJPcGVuIEpXIE1lZXRpbmcgVGltZXIgc2lkZWJhclwiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHZvaWQgdGhpcy5hY3RpdmF0ZVZpZXcoKSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgSndUaW1lclNldHRpbmdzVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB2b2lkIHRoaXMuYWN0aXZhdGVWaWV3KCkpO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuc2F2ZUhhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnNhdmVIYW5kbGUpO1xuICAgICAgdGhpcy5zYXZlSGFuZGxlID0gbnVsbDtcbiAgICB9XG4gICAgdm9pZCB0aGlzLnBlcnNpc3RUaW1lcnMoKTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9KV19USU1FUik7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2V0dGluZ3MgcGVyc2lzdGVuY2UgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMucGVyc2lzdERhdGEoKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZERhdGFfKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJhdyA9IGF3YWl0IHRoaXMubG9hZERhdGEoKSBhcyBQYXJ0aWFsPFBsdWdpbkRhdGE+IHwgbnVsbDtcbiAgICBpZiAoIXJhdykgcmV0dXJuO1xuICAgIGlmIChyYXcuc2V0dGluZ3MpIHtcbiAgICAgIHRoaXMuc2V0dGluZ3MgPSB7IC4uLkRFRkFVTFRfU0VUVElOR1MsIC4uLnJhdy5zZXR0aW5ncyB9O1xuICAgIH1cbiAgICBpZiAocmF3LnNjaGVkdWxlQ2FjaGUpIHtcbiAgICAgIHRoaXMuc2NoZWR1bGVDYWNoZSA9IHJhdy5zY2hlZHVsZUNhY2hlO1xuICAgIH1cbiAgICBpZiAocmF3LnRpbWVyU3RhdGVzKSB7XG4gICAgICB0aGlzLnRpbWVyRW5naW5lLnJlc3RvcmUocmF3LnRpbWVyU3RhdGVzKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHBlcnNpc3REYXRhKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHRpbWVyU3RhdGVzOiBSZWNvcmQ8c3RyaW5nLCBUaW1lclN0YXRlPiA9IHt9O1xuICAgIGZvciAoY29uc3QgW2ssIHZdIG9mIHRoaXMudGltZXJFbmdpbmUuc25hcHNob3RBbGwoKSkge1xuICAgICAgdGltZXJTdGF0ZXNba10gPSB2O1xuICAgIH1cbiAgICBjb25zdCBkYXRhOiBQbHVnaW5EYXRhID0ge1xuICAgICAgc2V0dGluZ3M6IHRoaXMuc2V0dGluZ3MsXG4gICAgICBzY2hlZHVsZUNhY2hlOiB0aGlzLnNjaGVkdWxlQ2FjaGUsXG4gICAgICB0aW1lclN0YXRlcyxcbiAgICB9O1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEoZGF0YSk7XG4gIH1cblxuICBwcml2YXRlIHNjaGVkdWxlU2F2ZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zYXZlSGFuZGxlICE9PSBudWxsKSB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuc2F2ZUhhbmRsZSk7XG4gICAgdGhpcy5zYXZlSGFuZGxlID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5zYXZlSGFuZGxlID0gbnVsbDtcbiAgICAgIHZvaWQgdGhpcy5wZXJzaXN0RGF0YSgpO1xuICAgIH0sIDUwMCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGltZXIgcGVyc2lzdGVuY2UgaGVscGVycyAoY2FsbGVkIGZyb20gdmlldykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgYXN5bmMgcGVyc2lzdFRpbWVycygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnBlcnNpc3REYXRhKCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2NoZWR1bGUgY2FjaGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgZ2V0Q2FjaGVkU2NoZWR1bGUoa2V5OiBzdHJpbmcpOiBXZWVrbHlTY2hlZHVsZSB8IG51bGwge1xuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuc2NoZWR1bGVDYWNoZVtrZXldO1xuICAgIGlmICghY2FjaGVkKSByZXR1cm4gbnVsbDtcbiAgICAvLyBDYWNoZSBpcyB2YWxpZCBmb3IgMTIgaG91cnNcbiAgICBjb25zdCBzdGFsZSA9IERhdGUubm93KCkgLSBjYWNoZWQuZmV0Y2hlZEF0ID4gMTIgKiA2MCAqIDYwICogMTAwMDtcbiAgICByZXR1cm4gc3RhbGUgPyBudWxsIDogY2FjaGVkO1xuICB9XG5cbiAgY2FjaGVTY2hlZHVsZShrZXk6IHN0cmluZywgc2NoZWR1bGU6IFdlZWtseVNjaGVkdWxlKTogdm9pZCB7XG4gICAgdGhpcy5zY2hlZHVsZUNhY2hlW2tleV0gPSBzY2hlZHVsZTtcbiAgICB0aGlzLnNjaGVkdWxlU2F2ZSgpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNldHRpbmdzIGNoYW5nZSBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGFzeW5jIGNsZWFyQ2FjaGVBbmRSZWZyZXNoKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2NoZWR1bGVDYWNoZSA9IHt9O1xuICAgIGF3YWl0IHRoaXMucGVyc2lzdERhdGEoKTtcbiAgICAvLyBSZWxvYWQgdGhlIG9wZW4gdmlldyBpZiBwcmVzZW50XG4gICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX0pXX1RJTUVSKVswXTtcbiAgICBpZiAobGVhZj8udmlldyBpbnN0YW5jZW9mIEp3VGltZXJWaWV3KSB7XG4gICAgICBhd2FpdCAobGVhZi52aWV3IGFzIEp3VGltZXJWaWV3KS5yZWxvYWQoKTtcbiAgICB9XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgVmlldyBhY3RpdmF0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgYXN5bmMgYWN0aXZhdGVWaWV3KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfSldfVElNRVIpO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGgpIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGV4aXN0aW5nWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRSaWdodExlYWYoZmFsc2UpO1xuICAgIGlmICghbGVhZikgcmV0dXJuO1xuICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHsgdHlwZTogVklFV19UWVBFX0pXX1RJTUVSLCBhY3RpdmU6IHRydWUgfSk7XG4gICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XG4gIH1cbn1cbiIsICIvLyBcdTI1MDBcdTI1MDBcdTI1MDAgRG9tYWluIHR5cGVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgaW50ZXJmYWNlIE1lZXRpbmdQYXJ0IHtcbiAgLyoqIERpc3BsYXkgbGFiZWwgKGUuZy4gXCIxLiBIb3cgTXVjaCBBcmUgWW91IFdpbGxpbmcgdG8gUGF5P1wiKSAqL1xuICBsYWJlbDogc3RyaW5nO1xuICAvKiogU2VjdGlvbiB0aGlzIHBhcnQgYmVsb25ncyB0byAqL1xuICBzZWN0aW9uOiBNZWV0aW5nU2VjdGlvbjtcbiAgLyoqIEFsbG93ZWQgZHVyYXRpb24gaW4gc2Vjb25kcyAqL1xuICBkdXJhdGlvblNlYzogbnVtYmVyO1xuICAvKiogT3JkZXIgd2l0aGluIHRoZSBmdWxsIG1lZXRpbmcgcHJvZ3JhbW1lICovXG4gIG9yZGVyOiBudW1iZXI7XG4gIC8qKiBJZiB0cnVlLCB0aGlzIHBhcnQgaGFzIG5vIHN0b3B3YXRjaCBcdTIwMTQgaXRzIGR1cmF0aW9uIGlzIG9ubHkgdXNlZCBmb3Igc2NoZWR1bGUgdGltaW5nIChlLmcuIHNvbmcpICovXG4gIGlzU2VwYXJhdG9yPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IHR5cGUgTWVldGluZ1NlY3Rpb24gPVxuICB8IFwib3BlbmluZ1wiXG4gIHwgXCJ0cmVhc3VyZXNcIlxuICB8IFwibWluaXN0cnlcIlxuICB8IFwibGl2aW5nXCJcbiAgfCBcImNsb3NpbmdcIjtcblxuZXhwb3J0IGludGVyZmFjZSBXZWVrbHlTY2hlZHVsZSB7XG4gIC8qKiBJU08gd2VlayBsYWJlbCwgZS5nLiBcIkFwcmlsIDIwLTI2XCIgKi9cbiAgd2Vla0xhYmVsOiBzdHJpbmc7XG4gIC8qKiBZZWFyICovXG4gIHllYXI6IG51bWJlcjtcbiAgLyoqIElTTyB3ZWVrIG51bWJlciAoMS01MykgKi9cbiAgd2Vla051bWJlcjogbnVtYmVyO1xuICBwYXJ0czogTWVldGluZ1BhcnRbXTtcbiAgLyoqIFdoZW4gdGhpcyBkYXRhIHdhcyBmZXRjaGVkIChtcyBzaW5jZSBlcG9jaCkgKi9cbiAgZmV0Y2hlZEF0OiBudW1iZXI7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBUaW1lciBzdGF0ZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGludGVyZmFjZSBUaW1lclN0YXRlIHtcbiAgcGFydE9yZGVyOiBudW1iZXI7XG4gIC8qKiBBY2N1bXVsYXRlZCBlbGFwc2VkIG1zICh3aGVuIHBhdXNlZCkgKi9cbiAgZWxhcHNlZE1zOiBudW1iZXI7XG4gIHJ1bm5pbmc6IGJvb2xlYW47XG4gIC8qKiBEYXRlLm5vdygpIHdoZW4gdGhlIGxhc3Qgc3RhcnQgaGFwcGVuZWQgKi9cbiAgc3RhcnRlZEF0OiBudW1iZXIgfCBudWxsO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgUGVyc2lzdGVkIHBsdWdpbiBkYXRhIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgaW50ZXJmYWNlIFBsdWdpbkRhdGEge1xuICBzZXR0aW5nczogUGx1Z2luU2V0dGluZ3M7XG4gIC8qKiBDYWNoZWQgc2NoZWR1bGUsIGtleWVkIGJ5IFwiWVlZWS1XV1wiICovXG4gIHNjaGVkdWxlQ2FjaGU6IFJlY29yZDxzdHJpbmcsIFdlZWtseVNjaGVkdWxlPjtcbiAgLyoqIFRpbWVyIHN0YXRlcywga2V5ZWQgYnkgXCJZWVlZLVdXOnBhcnRPcmRlclwiICovXG4gIHRpbWVyU3RhdGVzOiBSZWNvcmQ8c3RyaW5nLCBUaW1lclN0YXRlPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQbHVnaW5TZXR0aW5ncyB7XG4gIC8qKiBXT0wgbGFuZ3VhZ2UgbG9jYWxlLCBlLmcuIFwicjEvbHAtZVwiIChFbmdsaXNoKSBvciBcInI0L2xwLXNcIiAoU3BhbmlzaCkgKi9cbiAgd29sTG9jYWxlOiBzdHJpbmc7XG4gIC8qKiBNZWV0aW5nIHN0YXJ0IHRpbWUsIEhIOk1NIDI0aCBmb3JtYXQsIGUuZy4gXCIyMDowMFwiICovXG4gIG1lZXRpbmdTdGFydFRpbWU6IHN0cmluZztcbiAgLyoqIE1pbnV0ZXMgZm9yIG9wZW5pbmcgc29uZyArIHByYXllciBiZWZvcmUgZmlyc3QgcHJvZ3JhbW1lIHBhcnQgKi9cbiAgb3BlbmluZ1NvbmdNaW51dGVzOiBudW1iZXI7XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBQbHVnaW5TZXR0aW5ncyA9IHtcbiAgd29sTG9jYWxlOiBcInIxL2xwLWVcIixcbiAgbWVldGluZ1N0YXJ0VGltZTogXCIyMDowMFwiLFxuICBvcGVuaW5nU29uZ01pbnV0ZXM6IDUsXG59O1xuIiwgImltcG9ydCB0eXBlIHsgVGltZXJTdGF0ZSB9IGZyb20gXCIuL3R5cGVzXCI7XG5cbmV4cG9ydCB0eXBlIFRpbWVyU3RhdHVzID0gXCJpZGxlXCIgfCBcInJ1bm5pbmdcIiB8IFwicGF1c2VkXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGltZXJTbmFwc2hvdCB7XG4gIGVsYXBzZWRNczogbnVtYmVyO1xuICBzdGF0dXM6IFRpbWVyU3RhdHVzO1xufVxuXG5leHBvcnQgY2xhc3MgVGltZXJFbmdpbmUge1xuICBwcml2YXRlIHN0YXRlcyA9IG5ldyBNYXA8c3RyaW5nLCBUaW1lclN0YXRlPigpO1xuXG4gIHByaXZhdGUga2V5KHdlZWtLZXk6IHN0cmluZywgcGFydE9yZGVyOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIHJldHVybiBgJHt3ZWVrS2V5fToke3BhcnRPcmRlcn1gO1xuICB9XG5cbiAgZ2V0KHdlZWtLZXk6IHN0cmluZywgcGFydE9yZGVyOiBudW1iZXIpOiBUaW1lclNuYXBzaG90IHtcbiAgICBjb25zdCBzdGF0ZSA9IHRoaXMuc3RhdGVzLmdldCh0aGlzLmtleSh3ZWVrS2V5LCBwYXJ0T3JkZXIpKTtcbiAgICBpZiAoIXN0YXRlKSByZXR1cm4geyBlbGFwc2VkTXM6IDAsIHN0YXR1czogXCJpZGxlXCIgfTtcbiAgICBjb25zdCBlbGFwc2VkID0gc3RhdGUucnVubmluZyAmJiBzdGF0ZS5zdGFydGVkQXQgIT09IG51bGxcbiAgICAgID8gc3RhdGUuZWxhcHNlZE1zICsgKERhdGUubm93KCkgLSBzdGF0ZS5zdGFydGVkQXQpXG4gICAgICA6IHN0YXRlLmVsYXBzZWRNcztcbiAgICBjb25zdCBzdGF0dXM6IFRpbWVyU3RhdHVzID0gc3RhdGUucnVubmluZyA/IFwicnVubmluZ1wiIDogc3RhdGUuZWxhcHNlZE1zID4gMCA/IFwicGF1c2VkXCIgOiBcImlkbGVcIjtcbiAgICByZXR1cm4geyBlbGFwc2VkTXM6IGVsYXBzZWQsIHN0YXR1cyB9O1xuICB9XG5cbiAgc3RhcnQod2Vla0tleTogc3RyaW5nLCBwYXJ0T3JkZXI6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IGsgPSB0aGlzLmtleSh3ZWVrS2V5LCBwYXJ0T3JkZXIpO1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5zdGF0ZXMuZ2V0KGspO1xuICAgIGlmIChleGlzdGluZz8ucnVubmluZykgcmV0dXJuO1xuICAgIHRoaXMuc3RhdGVzLnNldChrLCB7XG4gICAgICBwYXJ0T3JkZXIsXG4gICAgICBlbGFwc2VkTXM6IGV4aXN0aW5nPy5lbGFwc2VkTXMgPz8gMCxcbiAgICAgIHJ1bm5pbmc6IHRydWUsXG4gICAgICBzdGFydGVkQXQ6IERhdGUubm93KCksXG4gICAgfSk7XG4gIH1cblxuICBwYXVzZSh3ZWVrS2V5OiBzdHJpbmcsIHBhcnRPcmRlcjogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgayA9IHRoaXMua2V5KHdlZWtLZXksIHBhcnRPcmRlcik7XG4gICAgY29uc3Qgc3RhdGUgPSB0aGlzLnN0YXRlcy5nZXQoayk7XG4gICAgaWYgKCFzdGF0ZT8ucnVubmluZykgcmV0dXJuO1xuICAgIHRoaXMuc3RhdGVzLnNldChrLCB7XG4gICAgICAuLi5zdGF0ZSxcbiAgICAgIGVsYXBzZWRNczogc3RhdGUuZWxhcHNlZE1zICsgKERhdGUubm93KCkgLSAoc3RhdGUuc3RhcnRlZEF0ID8/IERhdGUubm93KCkpKSxcbiAgICAgIHJ1bm5pbmc6IGZhbHNlLFxuICAgICAgc3RhcnRlZEF0OiBudWxsLFxuICAgIH0pO1xuICB9XG5cbiAgcmVzZXQod2Vla0tleTogc3RyaW5nLCBwYXJ0T3JkZXI6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuc3RhdGVzLmRlbGV0ZSh0aGlzLmtleSh3ZWVrS2V5LCBwYXJ0T3JkZXIpKTtcbiAgfVxuXG4gIC8qKiBTbmFwc2hvdCBhbGwgc3RhdGVzIGZvciBwZXJzaXN0ZW5jZSwgZnJlZXppbmcgcnVubmluZyB0aW1lcnMuICovXG4gIHNuYXBzaG90QWxsKCk6IE1hcDxzdHJpbmcsIFRpbWVyU3RhdGU+IHtcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgTWFwPHN0cmluZywgVGltZXJTdGF0ZT4oKTtcbiAgICBmb3IgKGNvbnN0IFtrLCBzdGF0ZV0gb2YgdGhpcy5zdGF0ZXMpIHtcbiAgICAgIGlmIChzdGF0ZS5ydW5uaW5nICYmIHN0YXRlLnN0YXJ0ZWRBdCAhPT0gbnVsbCkge1xuICAgICAgICByZXN1bHQuc2V0KGssIHtcbiAgICAgICAgICAuLi5zdGF0ZSxcbiAgICAgICAgICBlbGFwc2VkTXM6IHN0YXRlLmVsYXBzZWRNcyArIChEYXRlLm5vdygpIC0gc3RhdGUuc3RhcnRlZEF0KSxcbiAgICAgICAgICBydW5uaW5nOiBmYWxzZSxcbiAgICAgICAgICBzdGFydGVkQXQ6IG51bGwsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0LnNldChrLCB7IC4uLnN0YXRlIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqIFJlc3RvcmUgc3RhdGVzIGZyb20gcGVyc2lzdGVkIGRhdGEgKGFsbCBwYXVzZWQpLiAqL1xuICByZXN0b3JlKHNhdmVkOiBSZWNvcmQ8c3RyaW5nLCBUaW1lclN0YXRlPik6IHZvaWQge1xuICAgIHRoaXMuc3RhdGVzLmNsZWFyKCk7XG4gICAgZm9yIChjb25zdCBbaywgc3RhdGVdIG9mIE9iamVjdC5lbnRyaWVzKHNhdmVkKSkge1xuICAgICAgdGhpcy5zdGF0ZXMuc2V0KGssIHsgLi4uc3RhdGUsIHJ1bm5pbmc6IGZhbHNlLCBzdGFydGVkQXQ6IG51bGwgfSk7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSBKd1RpbWVyUGx1Z2luIGZyb20gXCIuL21haW5cIjtcbmltcG9ydCB0eXBlIHsgUGx1Z2luU2V0dGluZ3MgfSBmcm9tIFwiLi90eXBlc1wiO1xuXG4vLyBBdmFpbGFibGUgV09MIGxvY2FsZXM6IGxhYmVsIFx1MjE5MiBsb2NhbGUgcGF0aCBzZWdtZW50XG5jb25zdCBXT0xfTE9DQUxFUzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgXCJFbmdsaXNoXCI6ICAgIFwicjEvbHAtZVwiLFxuICBcIlNwYW5pc2hcIjogICAgXCJyNC9scC1zXCIsXG4gIFwiUG9ydHVndWVzZVwiOiBcInI1L2xwLXRcIixcbiAgXCJGcmVuY2hcIjogICAgIFwicjMwL2xwLWZcIixcbiAgXCJJdGFsaWFuXCI6ICAgIFwicjYvbHAtaVwiLFxuICBcIkdlcm1hblwiOiAgICAgXCJyMTAvbHAtZ1wiLFxuICBcIkR1dGNoXCI6ICAgICAgXCJyMTMvbHAtZFwiLFxuICBcIkphcGFuZXNlXCI6ICAgXCJyNy9scC1qXCIsXG4gIFwiS29yZWFuXCI6ICAgICBcInI4L2xwLWtvXCIsXG4gIFwiQ2hpbmVzZSAoU2ltcGxpZmllZClcIjogXCJyMjMvbHAtY2hzXCIsXG59O1xuXG5leHBvcnQgY2xhc3MgSndUaW1lclNldHRpbmdzVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHJlYWRvbmx5IHBsdWdpbjogSndUaW1lclBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiSlcgTWVldGluZyBUaW1lciBcdTIwMTQgU2V0dGluZ3NcIiB9KTtcblxuICAgIC8vIExhbmd1YWdlIC8gbG9jYWxlXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIk1lZXRpbmcgbGFuZ3VhZ2VcIilcbiAgICAgIC5zZXREZXNjKFwiTGFuZ3VhZ2UgdXNlZCB0byBmZXRjaCB0aGUgd2Vla2x5IHByb2dyYW1tZSBmcm9tIHdvbC5qdy5vcmcuXCIpXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3ApID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBbbGFiZWwsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhXT0xfTE9DQUxFUykpIHtcbiAgICAgICAgICBkcm9wLmFkZE9wdGlvbih2YWx1ZSwgbGFiZWwpO1xuICAgICAgICB9XG4gICAgICAgIGRyb3Auc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mud29sTG9jYWxlKTtcbiAgICAgICAgZHJvcC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy53b2xMb2NhbGUgPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIC8vIEN1c3RvbSBsb2NhbGUgb3ZlcnJpZGVcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiQ3VzdG9tIGxvY2FsZSAoYWR2YW5jZWQpXCIpXG4gICAgICAuc2V0RGVzYyhcbiAgICAgICAgJ092ZXJyaWRlIHdpdGggYW55IFdPTCBsb2NhbGUgcGF0aCwgZS5nLiBcInI0L2xwLXNcIi4gTGVhdmUgYmxhbmsgdG8gdXNlIHRoZSBkcm9wZG93biBzZWxlY3Rpb24uJ1xuICAgICAgKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+IHtcbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcInIxL2xwLWVcIilcbiAgICAgICAgICAuc2V0VmFsdWUoXCJcIilcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xuICAgICAgICAgICAgaWYgKHRyaW1tZWQpIHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mud29sTG9jYWxlID0gdHJpbW1lZDtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIC8vIE1lZXRpbmcgc3RhcnQgdGltZVxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJNZWV0aW5nIHN0YXJ0IHRpbWVcIilcbiAgICAgIC5zZXREZXNjKCcyNC1ob3VyIGZvcm1hdCwgZS5nLiBcIjIwOjAwXCIgb3IgXCIxODozMFwiLicpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT4ge1xuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiMjA6MDBcIilcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubWVldGluZ1N0YXJ0VGltZSlcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xuICAgICAgICAgICAgaWYgKC9eXFxkezEsMn06XFxkezJ9JC8udGVzdCh0cmltbWVkKSkge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tZWV0aW5nU3RhcnRUaW1lID0gdHJpbW1lZDtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIC8vIE9wZW5pbmcgc29uZyBkdXJhdGlvblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJPcGVuaW5nIHNvbmcgKyBwcmF5ZXIgKG1pbnV0ZXMpXCIpXG4gICAgICAuc2V0RGVzYyhcIkZpeGVkIG1pbnV0ZXMgYmVmb3JlIHRoZSBmaXJzdCBwcm9ncmFtbWUgcGFydCAoc29uZyArIHByYXllcikuIERlZmF1bHQ6IDUuXCIpXG4gICAgICAuYWRkU2xpZGVyKChzbGlkZXIpID0+IHtcbiAgICAgICAgc2xpZGVyXG4gICAgICAgICAgLnNldExpbWl0cygxLCAxNSwgMSlcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmluZ1NvbmdNaW51dGVzKVxuICAgICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmluZ1NvbmdNaW51dGVzID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgLy8gTWFudWFsIHJlZnJlc2ggYnV0dG9uXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlJlZnJlc2ggc2NoZWR1bGVcIilcbiAgICAgIC5zZXREZXNjKFwiQ2xlYXIgdGhlIGNhY2hlZCBzY2hlZHVsZSBhbmQgcmUtZmV0Y2ggZnJvbSB3b2wuancub3JnLlwiKVxuICAgICAgLmFkZEJ1dHRvbigoYnRuKSA9PiB7XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KFwiUmVmcmVzaCBub3dcIikub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uY2xlYXJDYWNoZUFuZFJlZnJlc2goKTtcbiAgICAgICAgICBidG4uc2V0QnV0dG9uVGV4dChcIkRvbmUgXHUyNzEzXCIpO1xuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IGJ0bi5zZXRCdXR0b25UZXh0KFwiUmVmcmVzaCBub3dcIiksIDIwMDApO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgSXRlbVZpZXcsIFdvcmtzcGFjZUxlYWYgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIEp3VGltZXJQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuaW1wb3J0IHR5cGUgeyBXZWVrbHlTY2hlZHVsZSwgTWVldGluZ1BhcnQgfSBmcm9tIFwiLi90eXBlc1wiO1xuaW1wb3J0IHR5cGUgeyBUaW1lclNuYXBzaG90IH0gZnJvbSBcIi4vdGltZXItZW5naW5lXCI7XG5pbXBvcnQgeyBjYWNoZUtleSwgY3VycmVudFdlZWtOdW1iZXIsIGZldGNoV2Vla1NjaGVkdWxlIH0gZnJvbSBcIi4vc2NyYXBlclwiO1xuXG5leHBvcnQgY29uc3QgVklFV19UWVBFX0pXX1RJTUVSID0gXCJqdy10aW1lci1zaWRlYmFyXCI7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBDb2xvdXIgdGhyZXNob2xkcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIGdyZWVuICA9IGVsYXBzZWQgPCA5MCUgb2YgYWxsb3dlZFxuLy8gb3JhbmdlID0gZWxhcHNlZCA+PSA5MCUgYW5kIDw9IDEwMCVcbi8vIHJlZCAgICA9IGVsYXBzZWQgPiAxMDAlXG5jb25zdCBXQVJOX1RIUkVTSE9MRCA9IDAuOTtcblxuZnVuY3Rpb24gZm9ybWF0TW1TcyhtczogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgdG90YWxTZWMgPSBNYXRoLm1heCgwLCBNYXRoLmZsb29yKG1zIC8gMTAwMCkpO1xuICBjb25zdCBtID0gTWF0aC5mbG9vcih0b3RhbFNlYyAvIDYwKTtcbiAgY29uc3QgcyA9IHRvdGFsU2VjICUgNjA7XG4gIHJldHVybiBgJHtTdHJpbmcobSkucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhzKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbn1cblxuLyoqIFBhcnNlIFwiSEg6TU1cIiBpbnRvIG1pbnV0ZXMgZnJvbSBtaWRuaWdodCAqL1xuZnVuY3Rpb24gdGltZVRvTWludXRlcyh0aW1lOiBzdHJpbmcpOiBudW1iZXIge1xuICBjb25zdCBbaGgsIG1tXSA9IHRpbWUuc3BsaXQoXCI6XCIpLm1hcChOdW1iZXIpO1xuICByZXR1cm4gKGhoID8/IDApICogNjAgKyAobW0gPz8gMCk7XG59XG5cbi8qKiBGb3JtYXQgbWludXRlcy1mcm9tLW1pZG5pZ2h0IGFzIFwiSEg6TU1cIiAqL1xuZnVuY3Rpb24gbWludXRlc1RvVGltZShtaW5zOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCBoID0gTWF0aC5mbG9vcihtaW5zIC8gNjApICUgMjQ7XG4gIGNvbnN0IG0gPSBtaW5zICUgNjA7XG4gIHJldHVybiBgJHtTdHJpbmcoaCkucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhtKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbn1cblxudHlwZSBUaW1lckNvbG9yU3RhdGUgPSBcImlkbGVcIiB8IFwib2tcIiB8IFwid2FyblwiIHwgXCJvdmVyXCI7XG5cbmZ1bmN0aW9uIGNvbG9yU3RhdGUoZWxhcHNlZE1zOiBudW1iZXIsIGR1cmF0aW9uU2VjOiBudW1iZXIsIHN0YXR1czogVGltZXJTbmFwc2hvdFtcInN0YXR1c1wiXSk6IFRpbWVyQ29sb3JTdGF0ZSB7XG4gIGlmIChzdGF0dXMgPT09IFwiaWRsZVwiKSByZXR1cm4gXCJpZGxlXCI7XG4gIGNvbnN0IHJhdGlvID0gZWxhcHNlZE1zIC8gKGR1cmF0aW9uU2VjICogMTAwMCk7XG4gIGlmIChyYXRpbyA+IDEpIHJldHVybiBcIm92ZXJcIjtcbiAgaWYgKHJhdGlvID49IFdBUk5fVEhSRVNIT0xEKSByZXR1cm4gXCJ3YXJuXCI7XG4gIHJldHVybiBcIm9rXCI7XG59XG5cbmludGVyZmFjZSBDYXJkUmVmcyB7XG4gIGNhcmRFbDogSFRNTEVsZW1lbnQ7XG4gIGVsYXBzZWRFbDogSFRNTEVsZW1lbnQ7XG4gIGRlbHRhRWw6IEhUTUxFbGVtZW50O1xuICBwbGF5QnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgcmVzZXRCdG46IEhUTUxCdXR0b25FbGVtZW50O1xuICBiYXJGaWxsRWw6IEhUTUxFbGVtZW50O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2VjdGlvbiBsYWJlbHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBTRUNUSU9OX0xBQkVMUzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgb3BlbmluZzogICBcIk9wZW5pbmdcIixcbiAgdHJlYXN1cmVzOiBcIlRyZWFzdXJlcyBmcm9tIEdvZCdzIFdvcmRcIixcbiAgbWluaXN0cnk6ICBcIkFwcGx5IFlvdXJzZWxmIHRvIHRoZSBNaW5pc3RyeVwiLFxuICBsaXZpbmc6ICAgIFwiTGl2aW5nIGFzIENocmlzdGlhbnNcIixcbiAgY2xvc2luZzogICBcIkNsb3NpbmdcIixcbn07XG5cbmV4cG9ydCBjbGFzcyBKd1RpbWVyVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgcHJpdmF0ZSBzY2hlZHVsZTogV2Vla2x5U2NoZWR1bGUgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSB3ZWVrS2V5ID0gXCJcIjtcbiAgcHJpdmF0ZSBjYXJkcyA9IG5ldyBNYXA8bnVtYmVyLCBDYXJkUmVmcz4oKTtcbiAgcHJpdmF0ZSB0aWNrSGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBzdGF0dXNFbCE6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGxpc3RFbCE6IEhUTUxFbGVtZW50O1xuXG4gIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHByaXZhdGUgcmVhZG9ubHkgcGx1Z2luOiBKd1RpbWVyUGx1Z2luKSB7XG4gICAgc3VwZXIobGVhZik7XG4gIH1cblxuICBnZXRWaWV3VHlwZSgpOiBzdHJpbmcgeyByZXR1cm4gVklFV19UWVBFX0pXX1RJTUVSOyB9XG4gIGdldERpc3BsYXlUZXh0KCk6IHN0cmluZyB7IHJldHVybiBcIkpXIE1lZXRpbmcgVGltZXJcIjsgfVxuICBnZXRJY29uKCk6IHN0cmluZyB7IHJldHVybiBcInRpbWVyXCI7IH1cblxuICBhc3luYyBvbk9wZW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGVudEVsO1xuICAgIHJvb3QuZW1wdHkoKTtcbiAgICByb290LmFkZENsYXNzKFwianctdGltZXItcm9vdFwiKTtcblxuICAgIHRoaXMuc3RhdHVzRWwgPSByb290LmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1zdGF0dXNcIiB9KTtcbiAgICB0aGlzLmxpc3RFbCA9IHJvb3QuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWxpc3RcIiB9KTtcblxuICAgIHRoaXMudGlja0hhbmRsZSA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnRpY2soKSwgMjUwKTtcblxuICAgIGF3YWl0IHRoaXMubG9hZFNjaGVkdWxlKCk7XG4gIH1cblxuICBhc3luYyBvbkNsb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLnRpY2tIYW5kbGUgIT09IG51bGwpIHtcbiAgICAgIHdpbmRvdy5jbGVhckludGVydmFsKHRoaXMudGlja0hhbmRsZSk7XG4gICAgICB0aGlzLnRpY2tIYW5kbGUgPSBudWxsO1xuICAgIH1cbiAgICBhd2FpdCB0aGlzLnBsdWdpbi5wZXJzaXN0VGltZXJzKCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgUHVibGljOiBjYWxsZWQgYnkgcGx1Z2luIHdoZW4gc2V0dGluZ3MgY2hhbmdlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGFzeW5jIHJlbG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnNjaGVkdWxlID0gbnVsbDtcbiAgICB0aGlzLmNhcmRzLmNsZWFyKCk7XG4gICAgdGhpcy5saXN0RWwuZW1wdHkoKTtcbiAgICBhd2FpdCB0aGlzLmxvYWRTY2hlZHVsZSgpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNjaGVkdWxlIGxvYWRpbmcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgcHJpdmF0ZSBhc3luYyBsb2FkU2NoZWR1bGUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgeWVhciA9IG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKTtcbiAgICBjb25zdCB3ZWVrID0gY3VycmVudFdlZWtOdW1iZXIoKTtcbiAgICB0aGlzLndlZWtLZXkgPSBjYWNoZUtleSh5ZWFyLCB3ZWVrKTtcblxuICAgIC8vIFRyeSBjYWNoZSBmaXJzdFxuICAgIGxldCBzY2hlZHVsZSA9IHRoaXMucGx1Z2luLmdldENhY2hlZFNjaGVkdWxlKHRoaXMud2Vla0tleSk7XG5cbiAgICBpZiAoIXNjaGVkdWxlKSB7XG4gICAgICB0aGlzLnNldFN0YXR1cyhcImxvYWRpbmdcIiwgXCJGZXRjaGluZyBtZWV0aW5nIHNjaGVkdWxlIGZyb20gd29sLmp3Lm9yZ1x1MjAyNlwiKTtcbiAgICAgIHNjaGVkdWxlID0gYXdhaXQgZmV0Y2hXZWVrU2NoZWR1bGUodGhpcy5wbHVnaW4uc2V0dGluZ3Mud29sTG9jYWxlLCB5ZWFyLCB3ZWVrKTtcbiAgICAgIGlmIChzY2hlZHVsZSkge1xuICAgICAgICB0aGlzLnBsdWdpbi5jYWNoZVNjaGVkdWxlKHRoaXMud2Vla0tleSwgc2NoZWR1bGUpO1xuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXNjaGVkdWxlKSB7XG4gICAgICB0aGlzLnNldFN0YXR1cyhcImVycm9yXCIsIFwiQ291bGQgbm90IGxvYWQgc2NoZWR1bGUuIENoZWNrIHlvdXIgY29ubmVjdGlvbiBhbmQgbGFuZ3VhZ2Ugc2V0dGluZy5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zY2hlZHVsZSA9IHNjaGVkdWxlO1xuICAgIHRoaXMuc2V0U3RhdHVzKFwib2tcIiwgYCR7c2NoZWR1bGUud2Vla0xhYmVsfWApO1xuICAgIHRoaXMucmVuZGVyU2NoZWR1bGUoc2NoZWR1bGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBzZXRTdGF0dXModHlwZTogXCJva1wiIHwgXCJsb2FkaW5nXCIgfCBcImVycm9yXCIsIHRleHQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuc3RhdHVzRWwuZW1wdHkoKTtcbiAgICB0aGlzLnN0YXR1c0VsLmNsYXNzTmFtZSA9IGBqdy10aW1lci1zdGF0dXMganctdGltZXItc3RhdHVzLS0ke3R5cGV9YDtcbiAgICB0aGlzLnN0YXR1c0VsLnNldFRleHQodGV4dCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgUmVuZGVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgcmVuZGVyU2NoZWR1bGUoc2NoZWR1bGU6IFdlZWtseVNjaGVkdWxlKTogdm9pZCB7XG4gICAgdGhpcy5saXN0RWwuZW1wdHkoKTtcbiAgICB0aGlzLmNhcmRzLmNsZWFyKCk7XG5cbiAgICAvLyBDb21wdXRlIHNjaGVkdWxlZCBzdGFydC1vZi1wYXJ0IHRpbWVzXG4gICAgY29uc3Qgc3RhcnRNaW51dGVzID0gdGltZVRvTWludXRlcyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5tZWV0aW5nU3RhcnRUaW1lKTtcbiAgICAvLyBBZGQgb3BlbmluZyBzb25nIG9mZnNldCAoc29uZytwcmF5ZXIgYmVmb3JlIGZpcnN0IHByb2dyYW1tZSBpdGVtKVxuICAgIGxldCBjdXJzb3IgPSBzdGFydE1pbnV0ZXMgKyB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVuaW5nU29uZ01pbnV0ZXM7XG5cbiAgICAvLyBCdWlsZCBvZmZzZXQgbWFwOiBwYXJ0T3JkZXIgXHUyMTkyIHNjaGVkdWxlZCBzdGFydCAobWludXRlcyBmcm9tIG1pZG5pZ2h0KVxuICAgIGNvbnN0IHNjaGVkdWxlZFN0YXJ0ID0gbmV3IE1hcDxudW1iZXIsIG51bWJlcj4oKTtcbiAgICBmb3IgKGNvbnN0IHBhcnQgb2Ygc2NoZWR1bGUucGFydHMpIHtcbiAgICAgIHNjaGVkdWxlZFN0YXJ0LnNldChwYXJ0Lm9yZGVyLCBjdXJzb3IpO1xuICAgICAgY3Vyc29yICs9IE1hdGguY2VpbChwYXJ0LmR1cmF0aW9uU2VjIC8gNjApO1xuICAgIH1cblxuICAgIC8vIEdyb3VwIHBhcnRzIGJ5IHNlY3Rpb25cbiAgICBjb25zdCBzZWN0aW9ucyA9IG5ldyBNYXA8c3RyaW5nLCBNZWV0aW5nUGFydFtdPigpO1xuICAgIGZvciAoY29uc3QgcGFydCBvZiBzY2hlZHVsZS5wYXJ0cykge1xuICAgICAgY29uc3QgbGlzdCA9IHNlY3Rpb25zLmdldChwYXJ0LnNlY3Rpb24pID8/IFtdO1xuICAgICAgbGlzdC5wdXNoKHBhcnQpO1xuICAgICAgc2VjdGlvbnMuc2V0KHBhcnQuc2VjdGlvbiwgbGlzdCk7XG4gICAgfVxuXG4gICAgY29uc3Qgc2VjdGlvbk9yZGVyOiBzdHJpbmdbXSA9IFtcIm9wZW5pbmdcIiwgXCJ0cmVhc3VyZXNcIiwgXCJtaW5pc3RyeVwiLCBcImxpdmluZ1wiLCBcImNsb3NpbmdcIl07XG4gICAgZm9yIChjb25zdCBzZWN0aW9uS2V5IG9mIHNlY3Rpb25PcmRlcikge1xuICAgICAgY29uc3QgcGFydHMgPSBzZWN0aW9ucy5nZXQoc2VjdGlvbktleSk7XG4gICAgICBpZiAoIXBhcnRzPy5sZW5ndGgpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBzZWN0aW9uRWwgPSB0aGlzLmxpc3RFbC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItc2VjdGlvblwiIH0pO1xuICAgICAgc2VjdGlvbkVsLmNyZWF0ZUVsKFwiaDNcIiwge1xuICAgICAgICBjbHM6IFwianctdGltZXItc2VjdGlvbi10aXRsZVwiLFxuICAgICAgICB0ZXh0OiBTRUNUSU9OX0xBQkVMU1tzZWN0aW9uS2V5XSA/PyBzZWN0aW9uS2V5LFxuICAgICAgfSk7XG5cbiAgICAgIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuICAgICAgICBpZiAocGFydC5pc1NlcGFyYXRvcikgY29udGludWU7IC8vIGNvdW50cyBmb3Igc2NoZWR1bGluZyBidXQgbm8gc3RvcHdhdGNoIGNhcmRcbiAgICAgICAgdGhpcy5yZW5kZXJDYXJkKHNlY3Rpb25FbCwgcGFydCwgc2NoZWR1bGVkU3RhcnQuZ2V0KHBhcnQub3JkZXIpID8/IHN0YXJ0TWludXRlcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJDYXJkKFxuICAgIHBhcmVudEVsOiBIVE1MRWxlbWVudCxcbiAgICBwYXJ0OiBNZWV0aW5nUGFydCxcbiAgICBzY2hlZHVsZWRTdGFydE1pbnM6IG51bWJlclxuICApOiB2b2lkIHtcbiAgICBjb25zdCBjYXJkID0gcGFyZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNhcmRcIiB9KTtcblxuICAgIC8vIFRpdGxlIHJvd1xuICAgIGNvbnN0IHRpdGxlUm93ID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2FyZC1oZWFkZXJcIiB9KTtcbiAgICB0aXRsZVJvdy5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2FyZC10aXRsZVwiLCB0ZXh0OiBwYXJ0LmxhYmVsIH0pO1xuICAgIHRpdGxlUm93LmNyZWF0ZURpdih7XG4gICAgICBjbHM6IFwianctdGltZXItY2FyZC1hbGxvdHRlZFwiLFxuICAgICAgdGV4dDogYCR7TWF0aC5yb3VuZChwYXJ0LmR1cmF0aW9uU2VjIC8gNjApfSBtaW5gLFxuICAgIH0pO1xuXG4gICAgLy8gU2NoZWR1bGVkIHN0YXJ0IHRpbWVcbiAgICBjYXJkLmNyZWF0ZURpdih7XG4gICAgICBjbHM6IFwianctdGltZXItY2FyZC1zdGFydC10aW1lXCIsXG4gICAgICB0ZXh0OiBgU3RhcnRzIFx1MjI0OCAke21pbnV0ZXNUb1RpbWUoc2NoZWR1bGVkU3RhcnRNaW5zKX1gLFxuICAgIH0pO1xuXG4gICAgLy8gUHJvZ3Jlc3MgYmFyXG4gICAgY29uc3QgYmFyRWwgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1iYXJcIiB9KTtcbiAgICBjb25zdCBiYXJGaWxsRWwgPSBiYXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItYmFyLWZpbGxcIiB9KTtcblxuICAgIC8vIENsb2NrIHJvd1xuICAgIGNvbnN0IGNsb2NrUm93ID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2xvY2stcm93XCIgfSk7XG4gICAgY29uc3QgZWxhcHNlZEVsID0gY2xvY2tSb3cuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWVsYXBzZWRcIiwgdGV4dDogXCIwMDowMFwiIH0pO1xuICAgIGNvbnN0IGRlbHRhRWwgPSBjbG9ja1Jvdy5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItZGVsdGFcIiB9KTtcblxuICAgIC8vIENvbnRyb2xzXG4gICAgY29uc3QgY29udHJvbHMgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jb250cm9sc1wiIH0pO1xuXG4gICAgY29uc3QgcGxheUJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImp3LXRpbWVyLWJ0biBqdy10aW1lci1idG4tcGxheVwiLCB0ZXh0OiBcIlx1MjVCNlwiIH0pO1xuICAgIHBsYXlCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJTdGFydCB0aW1lclwiKTtcblxuICAgIGNvbnN0IHJlc2V0QnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwianctdGltZXItYnRuIGp3LXRpbWVyLWJ0bi1yZXNldFwiLCB0ZXh0OiBcIlx1MjFCQVwiIH0pO1xuICAgIHJlc2V0QnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiUmVzZXQgdGltZXJcIik7XG5cbiAgICAvLyBXaXJlIGV2ZW50c1xuICAgIHBsYXlCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHRoaXMuaGFuZGxlUGxheVBhdXNlKHBhcnQpKTtcbiAgICByZXNldEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5oYW5kbGVSZXNldChwYXJ0KSk7XG5cbiAgICB0aGlzLmNhcmRzLnNldChwYXJ0Lm9yZGVyLCB7IGNhcmRFbDogY2FyZCwgZWxhcHNlZEVsLCBkZWx0YUVsLCBwbGF5QnRuLCByZXNldEJ0biwgYmFyRmlsbEVsIH0pO1xuICAgIHRoaXMudXBkYXRlQ2FyZChwYXJ0LCBzY2hlZHVsZWRTdGFydE1pbnMpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRpbWVyIGNvbnRyb2xzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgaGFuZGxlUGxheVBhdXNlKHBhcnQ6IE1lZXRpbmdQYXJ0KTogdm9pZCB7XG4gICAgY29uc3Qgc25hcCA9IHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLmdldCh0aGlzLndlZWtLZXksIHBhcnQub3JkZXIpO1xuICAgIGlmIChzbmFwLnN0YXR1cyA9PT0gXCJydW5uaW5nXCIpIHtcbiAgICAgIHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLnBhdXNlKHRoaXMud2Vla0tleSwgcGFydC5vcmRlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLnN0YXJ0KHRoaXMud2Vla0tleSwgcGFydC5vcmRlcik7XG4gICAgfVxuICAgIHRoaXMudXBkYXRlQ2FyZEJ5T3JkZXIocGFydCk7XG4gIH1cblxuICBwcml2YXRlIGhhbmRsZVJlc2V0KHBhcnQ6IE1lZXRpbmdQYXJ0KTogdm9pZCB7XG4gICAgdGhpcy5wbHVnaW4udGltZXJFbmdpbmUucmVzZXQodGhpcy53ZWVrS2V5LCBwYXJ0Lm9yZGVyKTtcbiAgICB0aGlzLnVwZGF0ZUNhcmRCeU9yZGVyKHBhcnQpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRpY2sgJiBkaXNwbGF5IHVwZGF0ZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIHRpY2soKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnNjaGVkdWxlKSByZXR1cm47XG4gICAgZm9yIChjb25zdCBwYXJ0IG9mIHRoaXMuc2NoZWR1bGUucGFydHMpIHtcbiAgICAgIGNvbnN0IHNuYXAgPSB0aGlzLnBsdWdpbi50aW1lckVuZ2luZS5nZXQodGhpcy53ZWVrS2V5LCBwYXJ0Lm9yZGVyKTtcbiAgICAgIGlmIChzbmFwLnN0YXR1cyA9PT0gXCJydW5uaW5nXCIpIHtcbiAgICAgICAgdGhpcy51cGRhdGVDYXJkQnlPcmRlcihwYXJ0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUNhcmRCeU9yZGVyKHBhcnQ6IE1lZXRpbmdQYXJ0KTogdm9pZCB7XG4gICAgY29uc3Qgc3RhcnRNaW51dGVzID0gdGltZVRvTWludXRlcyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5tZWV0aW5nU3RhcnRUaW1lKTtcbiAgICBsZXQgY3Vyc29yID0gc3RhcnRNaW51dGVzICsgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmluZ1NvbmdNaW51dGVzO1xuICAgIGxldCBzY2hlZHVsZWRTdGFydCA9IGN1cnNvcjtcbiAgICBmb3IgKGNvbnN0IHAgb2YgKHRoaXMuc2NoZWR1bGU/LnBhcnRzID8/IFtdKSkge1xuICAgICAgaWYgKHAub3JkZXIgPT09IHBhcnQub3JkZXIpIHsgc2NoZWR1bGVkU3RhcnQgPSBjdXJzb3I7IGJyZWFrOyB9XG4gICAgICBjdXJzb3IgKz0gTWF0aC5jZWlsKHAuZHVyYXRpb25TZWMgLyA2MCk7XG4gICAgfVxuICAgIHRoaXMudXBkYXRlQ2FyZChwYXJ0LCBzY2hlZHVsZWRTdGFydCk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUNhcmQocGFydDogTWVldGluZ1BhcnQsIHNjaGVkdWxlZFN0YXJ0TWluczogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgcmVmcyA9IHRoaXMuY2FyZHMuZ2V0KHBhcnQub3JkZXIpO1xuICAgIGlmICghcmVmcykgcmV0dXJuO1xuXG4gICAgY29uc3Qgc25hcCA9IHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLmdldCh0aGlzLndlZWtLZXksIHBhcnQub3JkZXIpO1xuICAgIGNvbnN0IHsgZWxhcHNlZE1zLCBzdGF0dXMgfSA9IHNuYXA7XG4gICAgY29uc3QgZHVyYXRpb25NcyA9IHBhcnQuZHVyYXRpb25TZWMgKiAxMDAwO1xuXG4gICAgLy8gRWxhcHNlZCBkaXNwbGF5XG4gICAgcmVmcy5lbGFwc2VkRWwuc2V0VGV4dChmb3JtYXRNbVNzKGVsYXBzZWRNcykpO1xuXG4gICAgLy8gUHJvZ3Jlc3MgYmFyXG4gICAgY29uc3QgcGN0ID0gTWF0aC5taW4oMSwgZWxhcHNlZE1zIC8gZHVyYXRpb25Ncyk7XG4gICAgcmVmcy5iYXJGaWxsRWwuc3R5bGUud2lkdGggPSBgJHsocGN0ICogMTAwKS50b0ZpeGVkKDEpfSVgO1xuXG4gICAgLy8gRGVsdGEgdnMgYWxsb3dlZFxuICAgIGNvbnN0IHJlbWFpbmluZ01zID0gZHVyYXRpb25NcyAtIGVsYXBzZWRNcztcbiAgICBpZiAoc3RhdHVzID09PSBcImlkbGVcIikge1xuICAgICAgcmVmcy5kZWx0YUVsLnNldFRleHQoYCR7TWF0aC5yb3VuZChwYXJ0LmR1cmF0aW9uU2VjIC8gNjApfSBtaW4gYWxsb3R0ZWRgKTtcbiAgICAgIHJlZnMuZGVsdGFFbC5jbGFzc05hbWUgPSBcImp3LXRpbWVyLWRlbHRhIGp3LXRpbWVyLWRlbHRhLS1uZXV0cmFsXCI7XG4gICAgfSBlbHNlIGlmIChyZW1haW5pbmdNcyA+PSAwKSB7XG4gICAgICByZWZzLmRlbHRhRWwuc2V0VGV4dChgXHUyMjEyJHtmb3JtYXRNbVNzKHJlbWFpbmluZ01zKX0gbGVmdGApO1xuICAgICAgcmVmcy5kZWx0YUVsLmNsYXNzTmFtZSA9IFwianctdGltZXItZGVsdGEganctdGltZXItZGVsdGEtLW9rXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZnMuZGVsdGFFbC5zZXRUZXh0KGArJHtmb3JtYXRNbVNzKC1yZW1haW5pbmdNcyl9IG92ZXJgKTtcbiAgICAgIHJlZnMuZGVsdGFFbC5jbGFzc05hbWUgPSBcImp3LXRpbWVyLWRlbHRhIGp3LXRpbWVyLWRlbHRhLS1vdmVyXCI7XG4gICAgfVxuXG4gICAgLy8gQ2FyZCBjb2xvdXIgc3RhdGVcbiAgICBjb25zdCBzdGF0ZSA9IGNvbG9yU3RhdGUoZWxhcHNlZE1zLCBwYXJ0LmR1cmF0aW9uU2VjLCBzdGF0dXMpO1xuICAgIHJlZnMuY2FyZEVsLnNldEF0dHJpYnV0ZShcImRhdGEtc3RhdGVcIiwgc3RhdGUpO1xuXG4gICAgLy8gUGxheSBidXR0b24gbGFiZWxcbiAgICBpZiAoc3RhdHVzID09PSBcInJ1bm5pbmdcIikge1xuICAgICAgcmVmcy5wbGF5QnRuLnNldFRleHQoXCJcdTIzRjhcIik7XG4gICAgICByZWZzLnBsYXlCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJQYXVzZSB0aW1lclwiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVmcy5wbGF5QnRuLnNldFRleHQoXCJcdTI1QjZcIik7XG4gICAgICByZWZzLnBsYXlCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgc3RhdHVzID09PSBcInBhdXNlZFwiID8gXCJSZXN1bWUgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgcmVxdWVzdFVybCB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgeyBXZWVrbHlTY2hlZHVsZSwgTWVldGluZ1BhcnQsIE1lZXRpbmdTZWN0aW9uIH0gZnJvbSBcIi4vdHlwZXNcIjtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFVSTCBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBpc29XZWVrKGRhdGU6IERhdGUpOiBudW1iZXIge1xuICBjb25zdCBkID0gbmV3IERhdGUoRGF0ZS5VVEMoZGF0ZS5nZXRGdWxsWWVhcigpLCBkYXRlLmdldE1vbnRoKCksIGRhdGUuZ2V0RGF0ZSgpKSk7XG4gIGQuc2V0VVRDRGF0ZShkLmdldFVUQ0RhdGUoKSArIDQgLSAoZC5nZXRVVENEYXkoKSB8fCA3KSk7XG4gIGNvbnN0IHllYXJTdGFydCA9IG5ldyBEYXRlKERhdGUuVVRDKGQuZ2V0VVRDRnVsbFllYXIoKSwgMCwgMSkpO1xuICByZXR1cm4gTWF0aC5jZWlsKCgoZC5nZXRUaW1lKCkgLSB5ZWFyU3RhcnQuZ2V0VGltZSgpKSAvIDg2XzQwMF8wMDAgKyAxKSAvIDcpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3VycmVudFdlZWtOdW1iZXIoKTogbnVtYmVyIHtcbiAgcmV0dXJuIGlzb1dlZWsobmV3IERhdGUoKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFdvbFVybChsb2NhbGU6IHN0cmluZywgeWVhcjogbnVtYmVyLCB3ZWVrOiBudW1iZXIpOiBzdHJpbmcge1xuICByZXR1cm4gYGh0dHBzOi8vd29sLmp3Lm9yZy9lbi93b2wvbWVldGluZ3MvJHtsb2NhbGV9LyR7eWVhcn0vJHt3ZWVrfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjYWNoZUtleSh5ZWFyOiBudW1iZXIsIHdlZWs6IG51bWJlcik6IHN0cmluZyB7XG4gIHJldHVybiBgJHt5ZWFyfS0ke1N0cmluZyh3ZWVrKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIER1cmF0aW9uIHBhcnNpbmcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbi8qKlxuICogTWF0Y2hlcyBcIihOIG1pbi4pXCIgT1IgXCIoTiBtaW5zLilcIiBcdTIwMTQgaGFuZGxlcyBFbmdsaXNoIChcIm1pbi5cIikgYW5kIFNwYW5pc2ggKFwibWlucy5cIikuXG4gKiBUaGUgcmVnZXggaXMgYXBwbGllZCBhZ2FpbnN0IHBsYWluIHRleHQgYWZ0ZXIgc3RyaXBwaW5nIEhUTUwgdGFncy5cbiAqL1xuY29uc3QgRFVSQVRJT05fUkUgPSAvXFwoKFxcZCspXFxzKm1pbnM/XFwuXFwpL2k7XG5cbmZ1bmN0aW9uIHBhcnNlRHVyYXRpb24odGV4dDogc3RyaW5nKTogbnVtYmVyIHwgbnVsbCB7XG4gIGNvbnN0IG0gPSBEVVJBVElPTl9SRS5leGVjKHRleHQpO1xuICByZXR1cm4gbSA/IHBhcnNlSW50KG1bMV0sIDEwKSAqIDYwIDogbnVsbDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEZldGNoIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmV0Y2hXZWVrU2NoZWR1bGUoXG4gIGxvY2FsZTogc3RyaW5nLFxuICB5ZWFyOiBudW1iZXIsXG4gIHdlZWs6IG51bWJlclxuKTogUHJvbWlzZTxXZWVrbHlTY2hlZHVsZSB8IG51bGw+IHtcbiAgLy8gU3RlcCAxOiBmZXRjaCB0aGUgbWVldGluZ3MgaW5kZXggcGFnZSB0byBmaW5kIHRoZSBNV0IgZG9jIGxpbmtcbiAgY29uc3QgbWVldGluZ3NVcmwgPSBidWlsZFdvbFVybChsb2NhbGUsIHllYXIsIHdlZWspO1xuICBsZXQgbWVldGluZ3NIdG1sOiBzdHJpbmc7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzcCA9IGF3YWl0IHJlcXVlc3RVcmwoe1xuICAgICAgdXJsOiBtZWV0aW5nc1VybCxcbiAgICAgIGhlYWRlcnM6IHsgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IEpXVGltZXJPYnNpZGlhbi8yLjApXCIgfSxcbiAgICB9KTtcbiAgICBpZiAocmVzcC5zdGF0dXMgPCAyMDAgfHwgcmVzcC5zdGF0dXMgPj0gMzAwKSByZXR1cm4gbnVsbDtcbiAgICBtZWV0aW5nc0h0bWwgPSByZXNwLnRleHQ7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gTVdCIGRvYyBJRHMgYXJlIDkrIGRpZ2l0c1xuICBjb25zdCBkb2NMaW5rUmUgPSAvaHJlZj1cIihcXC9bXlwiXStcXC93b2xcXC9kXFwvW15cIiM/XSspXCIvZztcbiAgY29uc3QgZG9jTGlua3M6IHN0cmluZ1tdID0gW107XG4gIGxldCBtOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuICB3aGlsZSAoKG0gPSBkb2NMaW5rUmUuZXhlYyhtZWV0aW5nc0h0bWwpKSAhPT0gbnVsbCkge1xuICAgIGlmICgvXFwvXFxkezksfSQvLnRlc3QobVsxXSkpIGRvY0xpbmtzLnB1c2gobVsxXSk7XG4gIH1cbiAgaWYgKGRvY0xpbmtzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG5cbiAgLy8gU3RlcCAyOiBmZXRjaCB0aGUgTVdCIGFydGljbGUgcGFnZVxuICBjb25zdCBkb2NVcmwgPSBgaHR0cHM6Ly93b2wuancub3JnJHtkb2NMaW5rc1swXX1gO1xuICBsZXQgZG9jSHRtbDogc3RyaW5nO1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3AgPSBhd2FpdCByZXF1ZXN0VXJsKHtcbiAgICAgIHVybDogZG9jVXJsLFxuICAgICAgaGVhZGVyczogeyBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgSldUaW1lck9ic2lkaWFuLzIuMClcIiB9LFxuICAgIH0pO1xuICAgIGlmIChyZXNwLnN0YXR1cyA8IDIwMCB8fCByZXNwLnN0YXR1cyA+PSAzMDApIHJldHVybiBudWxsO1xuICAgIGRvY0h0bWwgPSByZXNwLnRleHQ7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIHBhcnNlRG9jUGFnZShkb2NIdG1sLCB5ZWFyLCB3ZWVrKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEhUTUwgdXRpbGl0aWVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBjbGVhblRleHQoaHRtbDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGh0bWxcbiAgICAucmVwbGFjZSgvPFtePl0rPi9nLCBcIiBcIilcbiAgICAucmVwbGFjZSgvJmFtcDsvZywgXCImXCIpXG4gICAgLnJlcGxhY2UoLyZsdDsvZywgXCI8XCIpXG4gICAgLnJlcGxhY2UoLyZndDsvZywgXCI+XCIpXG4gICAgLnJlcGxhY2UoLyZxdW90Oy9nLCAnXCInKVxuICAgIC5yZXBsYWNlKC8mIzM5Oy9nLCBcIidcIilcbiAgICAucmVwbGFjZSgvJm5ic3A7L2csIFwiIFwiKVxuICAgIC5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKVxuICAgIC50cmltKCk7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBEb2MgcGFnZSBwYXJzaW5nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBwYXJzZURvY1BhZ2UoaHRtbDogc3RyaW5nLCB5ZWFyOiBudW1iZXIsIHdlZWs6IG51bWJlcik6IFdlZWtseVNjaGVkdWxlIHwgbnVsbCB7XG4gIC8vIFdlZWsgbGFiZWwgZnJvbSBoMVxuICBjb25zdCBoMU1hdGNoID0gLzxoMVtePl0qPihbXFxzXFxTXSo/KTxcXC9oMT4vaS5leGVjKGh0bWwpO1xuICBjb25zdCB3ZWVrTGFiZWwgPSBoMU1hdGNoID8gY2xlYW5UZXh0KGgxTWF0Y2hbMV0pIDogYFdlZWsgJHt3ZWVrfWA7XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFNlY3Rpb24gZGV0ZWN0aW9uIHZpYSBDU1MgY29sb3VyIGNsYXNzZXMgKGxhbmd1YWdlLWluZGVwZW5kZW50KSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgLy8gaDIgd2l0aCBjbGFzcyBkdS1jb2xvci0tdGVhbC03MDAgICBcdTIxOTIgVFJFQVNVUkVTIEZST00gR09EJ1MgV09SRFxuICAvLyBoMiB3aXRoIGNsYXNzIGR1LWNvbG9yLS1nb2xkLTcwMCAgIFx1MjE5MiBBUFBMWSBZT1VSU0VMRiBUTyBUSEUgRklFTEQgTUlOSVNUUllcbiAgLy8gaDIgd2l0aCBjbGFzcyBkdS1jb2xvci0tbWFyb29uLTYwMCBcdTIxOTIgTElWSU5HIEFTIENIUklTVElBTlNcbiAgdHlwZSBTZWN0aW9uQm91bmRhcnkgPSB7IHBvczogbnVtYmVyOyBzZWN0aW9uOiBNZWV0aW5nU2VjdGlvbiB9O1xuICBjb25zdCBib3VuZGFyaWVzOiBTZWN0aW9uQm91bmRhcnlbXSA9IFtdO1xuXG4gIGNvbnN0IGgyUmUgPSAvPGgyKFtePl0qKT4oW1xcc1xcU10qPyk8XFwvaDI+L2dpO1xuICBsZXQgaDJtOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuICB3aGlsZSAoKGgybSA9IGgyUmUuZXhlYyhodG1sKSkgIT09IG51bGwpIHtcbiAgICBjb25zdCBjbHMgPSBoMm1bMV07XG4gICAgY29uc3QgdGV4dCA9IGNsZWFuVGV4dChoMm1bMl0pLnRvVXBwZXJDYXNlKCk7XG4gICAgbGV0IHNlYzogTWVldGluZ1NlY3Rpb24gfCBudWxsID0gbnVsbDtcbiAgICAvLyBQcmltYXJ5OiBDU1MgY29sb3VyIGNsYXNzIFx1MjAxNCB3b3JrcyBpbiBhbnkgbGFuZ3VhZ2VcbiAgICBpZiAoY2xzLmluY2x1ZGVzKFwidGVhbC03MDBcIikpIHNlYyA9IFwidHJlYXN1cmVzXCI7XG4gICAgZWxzZSBpZiAoY2xzLmluY2x1ZGVzKFwiZ29sZC03MDBcIikpIHNlYyA9IFwibWluaXN0cnlcIjtcbiAgICBlbHNlIGlmIChjbHMuaW5jbHVkZXMoXCJtYXJvb24tNjAwXCIpKSBzZWMgPSBcImxpdmluZ1wiO1xuICAgIC8vIEZhbGxiYWNrOiBFbmdsaXNoIHNlY3Rpb24gdGV4dFxuICAgIGVsc2UgaWYgKHRleHQuaW5jbHVkZXMoXCJUUkVBU1VSRVNcIikpIHNlYyA9IFwidHJlYXN1cmVzXCI7XG4gICAgZWxzZSBpZiAodGV4dC5pbmNsdWRlcyhcIkFQUExZIFlPVVJTRUxGXCIpIHx8IHRleHQuaW5jbHVkZXMoXCJGSUVMRCBNSU5JU1RSWVwiKSkgc2VjID0gXCJtaW5pc3RyeVwiO1xuICAgIGVsc2UgaWYgKHRleHQuaW5jbHVkZXMoXCJMSVZJTkcgQVMgQ0hSSVNUSUFOU1wiKSkgc2VjID0gXCJsaXZpbmdcIjtcbiAgICBpZiAoc2VjKSBib3VuZGFyaWVzLnB1c2goeyBwb3M6IGgybS5pbmRleCwgc2VjdGlvbjogc2VjIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gc2VjdGlvbkZvclBvcyhwb3M6IG51bWJlcik6IE1lZXRpbmdTZWN0aW9uIHtcbiAgICBsZXQgc2VjOiBNZWV0aW5nU2VjdGlvbiA9IFwib3BlbmluZ1wiO1xuICAgIGZvciAoY29uc3QgYiBvZiBib3VuZGFyaWVzKSB7XG4gICAgICBpZiAocG9zID49IGIucG9zKSBzZWMgPSBiLnNlY3Rpb247XG4gICAgfVxuICAgIHJldHVybiBzZWM7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDAgUGFyc2UgaDMgZWxlbWVudHMgaW50byBwcm9ncmFtbWUgcGFydHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIGNvbnN0IHBhcnRzOiBNZWV0aW5nUGFydFtdID0gW107XG4gIGxldCBvcmRlciA9IDA7XG5cbiAgLy8gQ2FwdHVyZXM6IFsxXSBoMyBhdHRycywgWzJdIGgzIGlubmVyIEhUTUwsIFszXSBzaWJsaW5nIGJvZHkgSFRNTCB1bnRpbCBuZXh0IGgzL2gyXG4gIGNvbnN0IGgzUmUgPSAvPGgzKFtePl0qKT4oW1xcc1xcU10qPyk8XFwvaDM+KFtcXHNcXFNdKj8pKD89PGgzfDxoMnw8XFwvYXJ0aWNsZXwkKS9naTtcbiAgbGV0IGgzbTogUmVnRXhwRXhlY0FycmF5IHwgbnVsbDtcbiAgd2hpbGUgKChoM20gPSBoM1JlLmV4ZWMoaHRtbCkpICE9PSBudWxsKSB7XG4gICAgY29uc3QgaDNBdHRycyAgID0gaDNtWzFdO1xuICAgIGNvbnN0IHRpdGxlSHRtbCA9IGgzbVsyXTtcbiAgICBjb25zdCBib2R5SHRtbCAgPSBoM21bM10gPz8gXCJcIjtcbiAgICBjb25zdCB0aXRsZSAgICAgPSBjbGVhblRleHQodGl0bGVIdG1sKTtcbiAgICBjb25zdCBib2R5VGV4dCAgPSBjbGVhblRleHQoYm9keUh0bWwpO1xuICAgIGNvbnN0IHBvcyAgICAgICA9IGgzbS5pbmRleDtcblxuICAgIGNvbnN0IGlzU29uZyA9IGgzQXR0cnMuaW5jbHVkZXMoXCJkYy1pY29uLS1tdXNpY1wiKTtcblxuICAgIGlmIChpc1NvbmcpIHtcbiAgICAgIGNvbnN0IGR1ckluVGl0bGUgPSBwYXJzZUR1cmF0aW9uKHRpdGxlKTtcblxuICAgICAgaWYgKGR1ckluVGl0bGUgPT09IG51bGwpIHtcbiAgICAgICAgLy8gTWlkLW1lZXRpbmcgc29uZyBzZXBhcmF0b3I6IGNvdW50ZWQgZm9yIHNjaGVkdWxlIHRpbWluZyBidXQgbm8gc3RvcHdhdGNoIHNob3duXG4gICAgICAgIHBhcnRzLnB1c2goe1xuICAgICAgICAgIGxhYmVsOiB0aXRsZSxcbiAgICAgICAgICBzZWN0aW9uOiBzZWN0aW9uRm9yUG9zKHBvcyksXG4gICAgICAgICAgZHVyYXRpb25TZWM6IDUgKiA2MCxcbiAgICAgICAgICBvcmRlcjogb3JkZXIrKyxcbiAgICAgICAgICBpc1NlcGFyYXRvcjogdHJ1ZSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBPcGVuaW5nIHNvbmcgaDM6IFwiU29uZyA4NiBhbmQgUHJheWVyIHwgT3BlbmluZyBDb21tZW50cyAoMSBtaW4uKVwiXG4gICAgICAvLyBPbmx5IHN1cmZhY2UgdGhlIHByb2dyYW1tZSBsYWJlbCAodGhlIHBpcGUgc2VnbWVudCB0aGF0IGhhcyB0aGUgZHVyYXRpb24pXG4gICAgICBjb25zdCBsYWJlbCA9IGxhYmVsRnJvbVBpcGVTZWdtZW50KHRpdGxlKTtcbiAgICAgIGlmICghbGFiZWwpIGNvbnRpbnVlO1xuICAgICAgcGFydHMucHVzaCh7IGxhYmVsLCBzZWN0aW9uOiBzZWN0aW9uRm9yUG9zKHBvcyksIGR1cmF0aW9uU2VjOiBkdXJJblRpdGxlLCBvcmRlcjogb3JkZXIrKyB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFJlZ3VsYXIgcHJvZ3JhbW1lIHBhcnQgXHUyMDE0IGR1cmF0aW9uIG1heSBiZSBpbiB0aGUgaDMgdGl0bGUgKGNsb3Npbmcgcm93KSBvciBpbiBib2R5XG4gICAgY29uc3QgZHVySW5UaXRsZSA9IHBhcnNlRHVyYXRpb24odGl0bGUpO1xuICAgIGNvbnN0IGR1ckluQm9keSAgPSBwYXJzZUR1cmF0aW9uKGJvZHlUZXh0LnNsaWNlKDAsIDIwMCkpO1xuICAgIGNvbnN0IGR1cmF0aW9uU2VjID0gZHVySW5UaXRsZSA/PyBkdXJJbkJvZHk7XG4gICAgaWYgKGR1cmF0aW9uU2VjID09PSBudWxsKSBjb250aW51ZTtcblxuICAgIC8vIENsb3NpbmcgaDM6IFwiQ29uY2x1ZGluZyBDb21tZW50cyAoMyBtaW4uKSB8IFNvbmcgTiBhbmQgUHJheWVyXCJcbiAgICBpZiAodGl0bGUuaW5jbHVkZXMoXCJ8XCIpKSB7XG4gICAgICBjb25zdCBsYWJlbCA9IGxhYmVsRnJvbVBpcGVTZWdtZW50KHRpdGxlKTtcbiAgICAgIGlmICghbGFiZWwpIGNvbnRpbnVlO1xuICAgICAgcGFydHMucHVzaCh7IGxhYmVsLCBzZWN0aW9uOiBcImNsb3NpbmdcIiwgZHVyYXRpb25TZWMsIG9yZGVyOiBvcmRlcisrIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gTm9ybWFsIG51bWJlcmVkIHBhcnQgXHUyMDE0IHN0cmlwIGR1cmF0aW9uIGFubm90YXRpb24gZnJvbSBsYWJlbFxuICAgIGNvbnN0IGNsZWFuTGFiZWwgPSB0aXRsZS5yZXBsYWNlKERVUkFUSU9OX1JFLCBcIlwiKS5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCk7XG4gICAgcGFydHMucHVzaCh7IGxhYmVsOiBjbGVhbkxhYmVsLCBzZWN0aW9uOiBzZWN0aW9uRm9yUG9zKHBvcyksIGR1cmF0aW9uU2VjLCBvcmRlcjogb3JkZXIrKyB9KTtcbiAgfVxuXG4gIGlmIChwYXJ0cy5sZW5ndGggPCA1KSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIHsgd2Vla0xhYmVsLCB5ZWFyLCB3ZWVrTnVtYmVyOiB3ZWVrLCBwYXJ0cywgZmV0Y2hlZEF0OiBEYXRlLm5vdygpIH07XG59XG5cbi8qKlxuICogRm9yIHBpcGUtc2VwYXJhdGVkIGgzIHRpdGxlcyAob3BlbmluZyBvciBjbG9zaW5nIHJvd3MpLCByZXR1cm5zIHRoZSBzZWdtZW50XG4gKiB0aGF0IGNvbnRhaW5zIHRoZSBkdXJhdGlvbiBhbm5vdGF0aW9uLCB3aXRoIHRoYXQgYW5ub3RhdGlvbiBzdHJpcHBlZC5cbiAqXG4gKiBcIlNvbmcgODYgYW5kIFByYXllciB8IE9wZW5pbmcgQ29tbWVudHMgKDEgbWluLilcIiAgXHUyMTkyIFwiT3BlbmluZyBDb21tZW50c1wiXG4gKiBcIkNhbmNpXHUwMEYzbiA4NiB5IG9yYWNpXHUwMEYzbiB8IFBhbGFicmFzIGRlIGludHJvZHVjY2lcdTAwRjNuICgxIG1pbi4pXCIgXHUyMTkyIFwiUGFsYWJyYXMgZGUgaW50cm9kdWNjaVx1MDBGM25cIlxuICogXCJDb25jbHVkaW5nIENvbW1lbnRzICgzIG1pbi4pIHwgU29uZyA3MCBhbmQgUHJheWVyXCIgXHUyMTkyIFwiQ29uY2x1ZGluZyBDb21tZW50c1wiXG4gKi9cbmZ1bmN0aW9uIGxhYmVsRnJvbVBpcGVTZWdtZW50KHRpdGxlOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3Qgc2VnbWVudHMgPSB0aXRsZS5zcGxpdChcInxcIikubWFwKHMgPT4gcy50cmltKCkpO1xuICBjb25zdCB3aXRoRHVyID0gc2VnbWVudHMuZmluZChzID0+IERVUkFUSU9OX1JFLnRlc3QocykpO1xuICBpZiAoIXdpdGhEdXIpIHJldHVybiBudWxsO1xuICByZXR1cm4gd2l0aER1ci5yZXBsYWNlKERVUkFUSU9OX1JFLCBcIlwiKS5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCkgfHwgbnVsbDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQUFBLG1CQUF1Qjs7O0FDZ0VoQixJQUFNLG1CQUFtQztBQUFBLEVBQzlDLFdBQVc7QUFBQSxFQUNYLGtCQUFrQjtBQUFBLEVBQ2xCLG9CQUFvQjtBQUN0Qjs7O0FDM0RPLElBQU0sY0FBTixNQUFrQjtBQUFBLEVBQWxCO0FBQ0wsU0FBUSxTQUFTLG9CQUFJLElBQXdCO0FBQUE7QUFBQSxFQUVyQyxJQUFJLFNBQWlCLFdBQTJCO0FBQ3RELFdBQU8sR0FBRyxPQUFPLElBQUksU0FBUztBQUFBLEVBQ2hDO0FBQUEsRUFFQSxJQUFJLFNBQWlCLFdBQWtDO0FBQ3JELFVBQU0sUUFBUSxLQUFLLE9BQU8sSUFBSSxLQUFLLElBQUksU0FBUyxTQUFTLENBQUM7QUFDMUQsUUFBSSxDQUFDLE1BQU8sUUFBTyxFQUFFLFdBQVcsR0FBRyxRQUFRLE9BQU87QUFDbEQsVUFBTSxVQUFVLE1BQU0sV0FBVyxNQUFNLGNBQWMsT0FDakQsTUFBTSxhQUFhLEtBQUssSUFBSSxJQUFJLE1BQU0sYUFDdEMsTUFBTTtBQUNWLFVBQU0sU0FBc0IsTUFBTSxVQUFVLFlBQVksTUFBTSxZQUFZLElBQUksV0FBVztBQUN6RixXQUFPLEVBQUUsV0FBVyxTQUFTLE9BQU87QUFBQSxFQUN0QztBQUFBLEVBRUEsTUFBTSxTQUFpQixXQUF5QjtBQUM5QyxVQUFNLElBQUksS0FBSyxJQUFJLFNBQVMsU0FBUztBQUNyQyxVQUFNLFdBQVcsS0FBSyxPQUFPLElBQUksQ0FBQztBQUNsQyxRQUFJLFVBQVUsUUFBUztBQUN2QixTQUFLLE9BQU8sSUFBSSxHQUFHO0FBQUEsTUFDakI7QUFBQSxNQUNBLFdBQVcsVUFBVSxhQUFhO0FBQUEsTUFDbEMsU0FBUztBQUFBLE1BQ1QsV0FBVyxLQUFLLElBQUk7QUFBQSxJQUN0QixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRUEsTUFBTSxTQUFpQixXQUF5QjtBQUM5QyxVQUFNLElBQUksS0FBSyxJQUFJLFNBQVMsU0FBUztBQUNyQyxVQUFNLFFBQVEsS0FBSyxPQUFPLElBQUksQ0FBQztBQUMvQixRQUFJLENBQUMsT0FBTyxRQUFTO0FBQ3JCLFNBQUssT0FBTyxJQUFJLEdBQUc7QUFBQSxNQUNqQixHQUFHO0FBQUEsTUFDSCxXQUFXLE1BQU0sYUFBYSxLQUFLLElBQUksS0FBSyxNQUFNLGFBQWEsS0FBSyxJQUFJO0FBQUEsTUFDeEUsU0FBUztBQUFBLE1BQ1QsV0FBVztBQUFBLElBQ2IsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVBLE1BQU0sU0FBaUIsV0FBeUI7QUFDOUMsU0FBSyxPQUFPLE9BQU8sS0FBSyxJQUFJLFNBQVMsU0FBUyxDQUFDO0FBQUEsRUFDakQ7QUFBQTtBQUFBLEVBR0EsY0FBdUM7QUFDckMsVUFBTSxTQUFTLG9CQUFJLElBQXdCO0FBQzNDLGVBQVcsQ0FBQyxHQUFHLEtBQUssS0FBSyxLQUFLLFFBQVE7QUFDcEMsVUFBSSxNQUFNLFdBQVcsTUFBTSxjQUFjLE1BQU07QUFDN0MsZUFBTyxJQUFJLEdBQUc7QUFBQSxVQUNaLEdBQUc7QUFBQSxVQUNILFdBQVcsTUFBTSxhQUFhLEtBQUssSUFBSSxJQUFJLE1BQU07QUFBQSxVQUNqRCxTQUFTO0FBQUEsVUFDVCxXQUFXO0FBQUEsUUFDYixDQUFDO0FBQUEsTUFDSCxPQUFPO0FBQ0wsZUFBTyxJQUFJLEdBQUcsRUFBRSxHQUFHLE1BQU0sQ0FBQztBQUFBLE1BQzVCO0FBQUEsSUFDRjtBQUNBLFdBQU87QUFBQSxFQUNUO0FBQUE7QUFBQSxFQUdBLFFBQVEsT0FBeUM7QUFDL0MsU0FBSyxPQUFPLE1BQU07QUFDbEIsZUFBVyxDQUFDLEdBQUcsS0FBSyxLQUFLLE9BQU8sUUFBUSxLQUFLLEdBQUc7QUFDOUMsV0FBSyxPQUFPLElBQUksR0FBRyxFQUFFLEdBQUcsT0FBTyxTQUFTLE9BQU8sV0FBVyxLQUFLLENBQUM7QUFBQSxJQUNsRTtBQUFBLEVBQ0Y7QUFDRjs7O0FDL0VBLHNCQUErQztBQUsvQyxJQUFNLGNBQXNDO0FBQUEsRUFDMUMsV0FBYztBQUFBLEVBQ2QsV0FBYztBQUFBLEVBQ2QsY0FBYztBQUFBLEVBQ2QsVUFBYztBQUFBLEVBQ2QsV0FBYztBQUFBLEVBQ2QsVUFBYztBQUFBLEVBQ2QsU0FBYztBQUFBLEVBQ2QsWUFBYztBQUFBLEVBQ2QsVUFBYztBQUFBLEVBQ2Qsd0JBQXdCO0FBQzFCO0FBRU8sSUFBTSxxQkFBTixjQUFpQyxpQ0FBaUI7QUFBQSxFQUN2RCxZQUFZLEtBQTJCLFFBQXVCO0FBQzVELFVBQU0sS0FBSyxNQUFNO0FBRG9CO0FBQUEsRUFFdkM7QUFBQSxFQUVBLFVBQWdCO0FBQ2QsVUFBTSxFQUFFLFlBQVksSUFBSTtBQUN4QixnQkFBWSxNQUFNO0FBRWxCLGdCQUFZLFNBQVMsTUFBTSxFQUFFLE1BQU0sbUNBQThCLENBQUM7QUFHbEUsUUFBSSx3QkFBUSxXQUFXLEVBQ3BCLFFBQVEsa0JBQWtCLEVBQzFCLFFBQVEsOERBQThELEVBQ3RFLFlBQVksQ0FBQyxTQUFTO0FBQ3JCLGlCQUFXLENBQUMsT0FBTyxLQUFLLEtBQUssT0FBTyxRQUFRLFdBQVcsR0FBRztBQUN4RCxhQUFLLFVBQVUsT0FBTyxLQUFLO0FBQUEsTUFDN0I7QUFDQSxXQUFLLFNBQVMsS0FBSyxPQUFPLFNBQVMsU0FBUztBQUM1QyxXQUFLLFNBQVMsT0FBTyxVQUFVO0FBQzdCLGFBQUssT0FBTyxTQUFTLFlBQVk7QUFDakMsY0FBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLE1BQ2pDLENBQUM7QUFBQSxJQUNILENBQUM7QUFHSCxRQUFJLHdCQUFRLFdBQVcsRUFDcEIsUUFBUSwwQkFBMEIsRUFDbEM7QUFBQSxNQUNDO0FBQUEsSUFDRixFQUNDLFFBQVEsQ0FBQyxTQUFTO0FBQ2pCLFdBQ0csZUFBZSxTQUFTLEVBQ3hCLFNBQVMsRUFBRSxFQUNYLFNBQVMsT0FBTyxVQUFVO0FBQ3pCLGNBQU0sVUFBVSxNQUFNLEtBQUs7QUFDM0IsWUFBSSxTQUFTO0FBQ1gsZUFBSyxPQUFPLFNBQVMsWUFBWTtBQUNqQyxnQkFBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLFFBQ2pDO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDTCxDQUFDO0FBR0gsUUFBSSx3QkFBUSxXQUFXLEVBQ3BCLFFBQVEsb0JBQW9CLEVBQzVCLFFBQVEsMENBQTBDLEVBQ2xELFFBQVEsQ0FBQyxTQUFTO0FBQ2pCLFdBQ0csZUFBZSxPQUFPLEVBQ3RCLFNBQVMsS0FBSyxPQUFPLFNBQVMsZ0JBQWdCLEVBQzlDLFNBQVMsT0FBTyxVQUFVO0FBQ3pCLGNBQU0sVUFBVSxNQUFNLEtBQUs7QUFDM0IsWUFBSSxrQkFBa0IsS0FBSyxPQUFPLEdBQUc7QUFDbkMsZUFBSyxPQUFPLFNBQVMsbUJBQW1CO0FBQ3hDLGdCQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsUUFDakM7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNMLENBQUM7QUFHSCxRQUFJLHdCQUFRLFdBQVcsRUFDcEIsUUFBUSxpQ0FBaUMsRUFDekMsUUFBUSw0RUFBNEUsRUFDcEYsVUFBVSxDQUFDLFdBQVc7QUFDckIsYUFDRyxVQUFVLEdBQUcsSUFBSSxDQUFDLEVBQ2xCLFNBQVMsS0FBSyxPQUFPLFNBQVMsa0JBQWtCLEVBQ2hELGtCQUFrQixFQUNsQixTQUFTLE9BQU8sVUFBVTtBQUN6QixhQUFLLE9BQU8sU0FBUyxxQkFBcUI7QUFDMUMsY0FBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLE1BQ2pDLENBQUM7QUFBQSxJQUNMLENBQUM7QUFHSCxRQUFJLHdCQUFRLFdBQVcsRUFDcEIsUUFBUSxrQkFBa0IsRUFDMUIsUUFBUSx5REFBeUQsRUFDakUsVUFBVSxDQUFDLFFBQVE7QUFDbEIsVUFBSSxjQUFjLGFBQWEsRUFBRSxRQUFRLFlBQVk7QUFDbkQsY0FBTSxLQUFLLE9BQU8scUJBQXFCO0FBQ3ZDLFlBQUksY0FBYyxhQUFRO0FBQzFCLGVBQU8sV0FBVyxNQUFNLElBQUksY0FBYyxhQUFhLEdBQUcsR0FBSTtBQUFBLE1BQ2hFLENBQUM7QUFBQSxJQUNILENBQUM7QUFBQSxFQUNMO0FBQ0Y7OztBQzNHQSxJQUFBQyxtQkFBd0M7OztBQ0F4QyxJQUFBQyxtQkFBMkI7QUFLM0IsU0FBUyxRQUFRLE1BQW9CO0FBQ25DLFFBQU0sSUFBSSxJQUFJLEtBQUssS0FBSyxJQUFJLEtBQUssWUFBWSxHQUFHLEtBQUssU0FBUyxHQUFHLEtBQUssUUFBUSxDQUFDLENBQUM7QUFDaEYsSUFBRSxXQUFXLEVBQUUsV0FBVyxJQUFJLEtBQUssRUFBRSxVQUFVLEtBQUssRUFBRTtBQUN0RCxRQUFNLFlBQVksSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFLGVBQWUsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUM3RCxTQUFPLEtBQUssT0FBTyxFQUFFLFFBQVEsSUFBSSxVQUFVLFFBQVEsS0FBSyxRQUFhLEtBQUssQ0FBQztBQUM3RTtBQUVPLFNBQVMsb0JBQTRCO0FBQzFDLFNBQU8sUUFBUSxvQkFBSSxLQUFLLENBQUM7QUFDM0I7QUFFTyxTQUFTLFlBQVksUUFBZ0IsTUFBYyxNQUFzQjtBQUM5RSxTQUFPLHNDQUFzQyxNQUFNLElBQUksSUFBSSxJQUFJLElBQUk7QUFDckU7QUFFTyxTQUFTLFNBQVMsTUFBYyxNQUFzQjtBQUMzRCxTQUFPLEdBQUcsSUFBSSxJQUFJLE9BQU8sSUFBSSxFQUFFLFNBQVMsR0FBRyxHQUFHLENBQUM7QUFDakQ7QUFRQSxJQUFNLGNBQWM7QUFFcEIsU0FBUyxjQUFjLE1BQTZCO0FBQ2xELFFBQU0sSUFBSSxZQUFZLEtBQUssSUFBSTtBQUMvQixTQUFPLElBQUksU0FBUyxFQUFFLENBQUMsR0FBRyxFQUFFLElBQUksS0FBSztBQUN2QztBQUlBLGVBQXNCLGtCQUNwQixRQUNBLE1BQ0EsTUFDZ0M7QUFFaEMsUUFBTSxjQUFjLFlBQVksUUFBUSxNQUFNLElBQUk7QUFDbEQsTUFBSTtBQUNKLE1BQUk7QUFDRixVQUFNLE9BQU8sVUFBTSw2QkFBVztBQUFBLE1BQzVCLEtBQUs7QUFBQSxNQUNMLFNBQVMsRUFBRSxjQUFjLGdEQUFnRDtBQUFBLElBQzNFLENBQUM7QUFDRCxRQUFJLEtBQUssU0FBUyxPQUFPLEtBQUssVUFBVSxJQUFLLFFBQU87QUFDcEQsbUJBQWUsS0FBSztBQUFBLEVBQ3RCLFFBQVE7QUFDTixXQUFPO0FBQUEsRUFDVDtBQUdBLFFBQU0sWUFBWTtBQUNsQixRQUFNLFdBQXFCLENBQUM7QUFDNUIsTUFBSTtBQUNKLFVBQVEsSUFBSSxVQUFVLEtBQUssWUFBWSxPQUFPLE1BQU07QUFDbEQsUUFBSSxZQUFZLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRyxVQUFTLEtBQUssRUFBRSxDQUFDLENBQUM7QUFBQSxFQUNoRDtBQUNBLE1BQUksU0FBUyxXQUFXLEVBQUcsUUFBTztBQUdsQyxRQUFNLFNBQVMscUJBQXFCLFNBQVMsQ0FBQyxDQUFDO0FBQy9DLE1BQUk7QUFDSixNQUFJO0FBQ0YsVUFBTSxPQUFPLFVBQU0sNkJBQVc7QUFBQSxNQUM1QixLQUFLO0FBQUEsTUFDTCxTQUFTLEVBQUUsY0FBYyxnREFBZ0Q7QUFBQSxJQUMzRSxDQUFDO0FBQ0QsUUFBSSxLQUFLLFNBQVMsT0FBTyxLQUFLLFVBQVUsSUFBSyxRQUFPO0FBQ3BELGNBQVUsS0FBSztBQUFBLEVBQ2pCLFFBQVE7QUFDTixXQUFPO0FBQUEsRUFDVDtBQUVBLFNBQU8sYUFBYSxTQUFTLE1BQU0sSUFBSTtBQUN6QztBQUlBLFNBQVMsVUFBVSxNQUFzQjtBQUN2QyxTQUFPLEtBQ0osUUFBUSxZQUFZLEdBQUcsRUFDdkIsUUFBUSxVQUFVLEdBQUcsRUFDckIsUUFBUSxTQUFTLEdBQUcsRUFDcEIsUUFBUSxTQUFTLEdBQUcsRUFDcEIsUUFBUSxXQUFXLEdBQUcsRUFDdEIsUUFBUSxVQUFVLEdBQUcsRUFDckIsUUFBUSxXQUFXLEdBQUcsRUFDdEIsUUFBUSxRQUFRLEdBQUcsRUFDbkIsS0FBSztBQUNWO0FBSUEsU0FBUyxhQUFhLE1BQWMsTUFBYyxNQUFxQztBQUVyRixRQUFNLFVBQVUsNkJBQTZCLEtBQUssSUFBSTtBQUN0RCxRQUFNLFlBQVksVUFBVSxVQUFVLFFBQVEsQ0FBQyxDQUFDLElBQUksUUFBUSxJQUFJO0FBT2hFLFFBQU0sYUFBZ0MsQ0FBQztBQUV2QyxRQUFNLE9BQU87QUFDYixNQUFJO0FBQ0osVUFBUSxNQUFNLEtBQUssS0FBSyxJQUFJLE9BQU8sTUFBTTtBQUN2QyxVQUFNLE1BQU0sSUFBSSxDQUFDO0FBQ2pCLFVBQU0sT0FBTyxVQUFVLElBQUksQ0FBQyxDQUFDLEVBQUUsWUFBWTtBQUMzQyxRQUFJLE1BQTZCO0FBRWpDLFFBQUksSUFBSSxTQUFTLFVBQVUsRUFBRyxPQUFNO0FBQUEsYUFDM0IsSUFBSSxTQUFTLFVBQVUsRUFBRyxPQUFNO0FBQUEsYUFDaEMsSUFBSSxTQUFTLFlBQVksRUFBRyxPQUFNO0FBQUEsYUFFbEMsS0FBSyxTQUFTLFdBQVcsRUFBRyxPQUFNO0FBQUEsYUFDbEMsS0FBSyxTQUFTLGdCQUFnQixLQUFLLEtBQUssU0FBUyxnQkFBZ0IsRUFBRyxPQUFNO0FBQUEsYUFDMUUsS0FBSyxTQUFTLHNCQUFzQixFQUFHLE9BQU07QUFDdEQsUUFBSSxJQUFLLFlBQVcsS0FBSyxFQUFFLEtBQUssSUFBSSxPQUFPLFNBQVMsSUFBSSxDQUFDO0FBQUEsRUFDM0Q7QUFFQSxXQUFTLGNBQWMsS0FBNkI7QUFDbEQsUUFBSSxNQUFzQjtBQUMxQixlQUFXLEtBQUssWUFBWTtBQUMxQixVQUFJLE9BQU8sRUFBRSxJQUFLLE9BQU0sRUFBRTtBQUFBLElBQzVCO0FBQ0EsV0FBTztBQUFBLEVBQ1Q7QUFHQSxRQUFNLFFBQXVCLENBQUM7QUFDOUIsTUFBSSxRQUFRO0FBR1osUUFBTSxPQUFPO0FBQ2IsTUFBSTtBQUNKLFVBQVEsTUFBTSxLQUFLLEtBQUssSUFBSSxPQUFPLE1BQU07QUFDdkMsVUFBTSxVQUFZLElBQUksQ0FBQztBQUN2QixVQUFNLFlBQVksSUFBSSxDQUFDO0FBQ3ZCLFVBQU0sV0FBWSxJQUFJLENBQUMsS0FBSztBQUM1QixVQUFNLFFBQVksVUFBVSxTQUFTO0FBQ3JDLFVBQU0sV0FBWSxVQUFVLFFBQVE7QUFDcEMsVUFBTSxNQUFZLElBQUk7QUFFdEIsVUFBTSxTQUFTLFFBQVEsU0FBUyxnQkFBZ0I7QUFFaEQsUUFBSSxRQUFRO0FBQ1YsWUFBTUMsY0FBYSxjQUFjLEtBQUs7QUFFdEMsVUFBSUEsZ0JBQWUsTUFBTTtBQUV2QixjQUFNLEtBQUs7QUFBQSxVQUNULE9BQU87QUFBQSxVQUNQLFNBQVMsY0FBYyxHQUFHO0FBQUEsVUFDMUIsYUFBYSxJQUFJO0FBQUEsVUFDakIsT0FBTztBQUFBLFVBQ1AsYUFBYTtBQUFBLFFBQ2YsQ0FBQztBQUNEO0FBQUEsTUFDRjtBQUlBLFlBQU0sUUFBUSxxQkFBcUIsS0FBSztBQUN4QyxVQUFJLENBQUMsTUFBTztBQUNaLFlBQU0sS0FBSyxFQUFFLE9BQU8sU0FBUyxjQUFjLEdBQUcsR0FBRyxhQUFhQSxhQUFZLE9BQU8sUUFBUSxDQUFDO0FBQzFGO0FBQUEsSUFDRjtBQUdBLFVBQU0sYUFBYSxjQUFjLEtBQUs7QUFDdEMsVUFBTSxZQUFhLGNBQWMsU0FBUyxNQUFNLEdBQUcsR0FBRyxDQUFDO0FBQ3ZELFVBQU0sY0FBYyxjQUFjO0FBQ2xDLFFBQUksZ0JBQWdCLEtBQU07QUFHMUIsUUFBSSxNQUFNLFNBQVMsR0FBRyxHQUFHO0FBQ3ZCLFlBQU0sUUFBUSxxQkFBcUIsS0FBSztBQUN4QyxVQUFJLENBQUMsTUFBTztBQUNaLFlBQU0sS0FBSyxFQUFFLE9BQU8sU0FBUyxXQUFXLGFBQWEsT0FBTyxRQUFRLENBQUM7QUFDckU7QUFBQSxJQUNGO0FBR0EsVUFBTSxhQUFhLE1BQU0sUUFBUSxhQUFhLEVBQUUsRUFBRSxRQUFRLFFBQVEsR0FBRyxFQUFFLEtBQUs7QUFDNUUsVUFBTSxLQUFLLEVBQUUsT0FBTyxZQUFZLFNBQVMsY0FBYyxHQUFHLEdBQUcsYUFBYSxPQUFPLFFBQVEsQ0FBQztBQUFBLEVBQzVGO0FBRUEsTUFBSSxNQUFNLFNBQVMsRUFBRyxRQUFPO0FBQzdCLFNBQU8sRUFBRSxXQUFXLE1BQU0sWUFBWSxNQUFNLE9BQU8sV0FBVyxLQUFLLElBQUksRUFBRTtBQUMzRTtBQVVBLFNBQVMscUJBQXFCLE9BQThCO0FBQzFELFFBQU0sV0FBVyxNQUFNLE1BQU0sR0FBRyxFQUFFLElBQUksT0FBSyxFQUFFLEtBQUssQ0FBQztBQUNuRCxRQUFNLFVBQVUsU0FBUyxLQUFLLE9BQUssWUFBWSxLQUFLLENBQUMsQ0FBQztBQUN0RCxNQUFJLENBQUMsUUFBUyxRQUFPO0FBQ3JCLFNBQU8sUUFBUSxRQUFRLGFBQWEsRUFBRSxFQUFFLFFBQVEsUUFBUSxHQUFHLEVBQUUsS0FBSyxLQUFLO0FBQ3pFOzs7QURoTk8sSUFBTSxxQkFBcUI7QUFNbEMsSUFBTSxpQkFBaUI7QUFFdkIsU0FBUyxXQUFXLElBQW9CO0FBQ3RDLFFBQU0sV0FBVyxLQUFLLElBQUksR0FBRyxLQUFLLE1BQU0sS0FBSyxHQUFJLENBQUM7QUFDbEQsUUFBTSxJQUFJLEtBQUssTUFBTSxXQUFXLEVBQUU7QUFDbEMsUUFBTSxJQUFJLFdBQVc7QUFDckIsU0FBTyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFNBQVMsR0FBRyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsRUFBRSxTQUFTLEdBQUcsR0FBRyxDQUFDO0FBQ3BFO0FBR0EsU0FBUyxjQUFjLE1BQXNCO0FBQzNDLFFBQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxLQUFLLE1BQU0sR0FBRyxFQUFFLElBQUksTUFBTTtBQUMzQyxVQUFRLE1BQU0sS0FBSyxNQUFNLE1BQU07QUFDakM7QUFHQSxTQUFTLGNBQWMsTUFBc0I7QUFDM0MsUUFBTSxJQUFJLEtBQUssTUFBTSxPQUFPLEVBQUUsSUFBSTtBQUNsQyxRQUFNLElBQUksT0FBTztBQUNqQixTQUFPLEdBQUcsT0FBTyxDQUFDLEVBQUUsU0FBUyxHQUFHLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxFQUFFLFNBQVMsR0FBRyxHQUFHLENBQUM7QUFDcEU7QUFJQSxTQUFTLFdBQVcsV0FBbUIsYUFBcUIsUUFBa0Q7QUFDNUcsTUFBSSxXQUFXLE9BQVEsUUFBTztBQUM5QixRQUFNLFFBQVEsYUFBYSxjQUFjO0FBQ3pDLE1BQUksUUFBUSxFQUFHLFFBQU87QUFDdEIsTUFBSSxTQUFTLGVBQWdCLFFBQU87QUFDcEMsU0FBTztBQUNUO0FBWUEsSUFBTSxpQkFBeUM7QUFBQSxFQUM3QyxTQUFXO0FBQUEsRUFDWCxXQUFXO0FBQUEsRUFDWCxVQUFXO0FBQUEsRUFDWCxRQUFXO0FBQUEsRUFDWCxTQUFXO0FBQ2I7QUFFTyxJQUFNLGNBQU4sY0FBMEIsMEJBQVM7QUFBQSxFQVF4QyxZQUFZLE1BQXNDLFFBQXVCO0FBQ3ZFLFVBQU0sSUFBSTtBQURzQztBQVBsRCxTQUFRLFdBQWtDO0FBQzFDLFNBQVEsVUFBVTtBQUNsQixTQUFRLFFBQVEsb0JBQUksSUFBc0I7QUFDMUMsU0FBUSxhQUE0QjtBQUFBLEVBTXBDO0FBQUEsRUFFQSxjQUFzQjtBQUFFLFdBQU87QUFBQSxFQUFvQjtBQUFBLEVBQ25ELGlCQUF5QjtBQUFFLFdBQU87QUFBQSxFQUFvQjtBQUFBLEVBQ3RELFVBQWtCO0FBQUUsV0FBTztBQUFBLEVBQVM7QUFBQSxFQUVwQyxNQUFNLFNBQXdCO0FBQzVCLFVBQU0sT0FBTyxLQUFLO0FBQ2xCLFNBQUssTUFBTTtBQUNYLFNBQUssU0FBUyxlQUFlO0FBRTdCLFNBQUssV0FBVyxLQUFLLFVBQVUsRUFBRSxLQUFLLGtCQUFrQixDQUFDO0FBQ3pELFNBQUssU0FBUyxLQUFLLFVBQVUsRUFBRSxLQUFLLGdCQUFnQixDQUFDO0FBRXJELFNBQUssYUFBYSxPQUFPLFlBQVksTUFBTSxLQUFLLEtBQUssR0FBRyxHQUFHO0FBRTNELFVBQU0sS0FBSyxhQUFhO0FBQUEsRUFDMUI7QUFBQSxFQUVBLE1BQU0sVUFBeUI7QUFDN0IsUUFBSSxLQUFLLGVBQWUsTUFBTTtBQUM1QixhQUFPLGNBQWMsS0FBSyxVQUFVO0FBQ3BDLFdBQUssYUFBYTtBQUFBLElBQ3BCO0FBQ0EsVUFBTSxLQUFLLE9BQU8sY0FBYztBQUFBLEVBQ2xDO0FBQUE7QUFBQSxFQUlBLE1BQU0sU0FBd0I7QUFDNUIsU0FBSyxXQUFXO0FBQ2hCLFNBQUssTUFBTSxNQUFNO0FBQ2pCLFNBQUssT0FBTyxNQUFNO0FBQ2xCLFVBQU0sS0FBSyxhQUFhO0FBQUEsRUFDMUI7QUFBQTtBQUFBLEVBSUEsTUFBYyxlQUE4QjtBQUMxQyxVQUFNLFFBQU8sb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFDcEMsVUFBTSxPQUFPLGtCQUFrQjtBQUMvQixTQUFLLFVBQVUsU0FBUyxNQUFNLElBQUk7QUFHbEMsUUFBSSxXQUFXLEtBQUssT0FBTyxrQkFBa0IsS0FBSyxPQUFPO0FBRXpELFFBQUksQ0FBQyxVQUFVO0FBQ2IsV0FBSyxVQUFVLFdBQVcsaURBQTRDO0FBQ3RFLGlCQUFXLE1BQU0sa0JBQWtCLEtBQUssT0FBTyxTQUFTLFdBQVcsTUFBTSxJQUFJO0FBQzdFLFVBQUksVUFBVTtBQUNaLGFBQUssT0FBTyxjQUFjLEtBQUssU0FBUyxRQUFRO0FBQ2hELGNBQU0sS0FBSyxPQUFPLGFBQWE7QUFBQSxNQUNqQztBQUFBLElBQ0Y7QUFFQSxRQUFJLENBQUMsVUFBVTtBQUNiLFdBQUssVUFBVSxTQUFTLHNFQUFzRTtBQUM5RjtBQUFBLElBQ0Y7QUFFQSxTQUFLLFdBQVc7QUFDaEIsU0FBSyxVQUFVLE1BQU0sR0FBRyxTQUFTLFNBQVMsRUFBRTtBQUM1QyxTQUFLLGVBQWUsUUFBUTtBQUFBLEVBQzlCO0FBQUEsRUFFUSxVQUFVLE1BQWtDLE1BQW9CO0FBQ3RFLFNBQUssU0FBUyxNQUFNO0FBQ3BCLFNBQUssU0FBUyxZQUFZLG9DQUFvQyxJQUFJO0FBQ2xFLFNBQUssU0FBUyxRQUFRLElBQUk7QUFBQSxFQUM1QjtBQUFBO0FBQUEsRUFJUSxlQUFlLFVBQWdDO0FBQ3JELFNBQUssT0FBTyxNQUFNO0FBQ2xCLFNBQUssTUFBTSxNQUFNO0FBR2pCLFVBQU0sZUFBZSxjQUFjLEtBQUssT0FBTyxTQUFTLGdCQUFnQjtBQUV4RSxRQUFJLFNBQVMsZUFBZSxLQUFLLE9BQU8sU0FBUztBQUdqRCxVQUFNLGlCQUFpQixvQkFBSSxJQUFvQjtBQUMvQyxlQUFXLFFBQVEsU0FBUyxPQUFPO0FBQ2pDLHFCQUFlLElBQUksS0FBSyxPQUFPLE1BQU07QUFDckMsZ0JBQVUsS0FBSyxLQUFLLEtBQUssY0FBYyxFQUFFO0FBQUEsSUFDM0M7QUFHQSxVQUFNLFdBQVcsb0JBQUksSUFBMkI7QUFDaEQsZUFBVyxRQUFRLFNBQVMsT0FBTztBQUNqQyxZQUFNLE9BQU8sU0FBUyxJQUFJLEtBQUssT0FBTyxLQUFLLENBQUM7QUFDNUMsV0FBSyxLQUFLLElBQUk7QUFDZCxlQUFTLElBQUksS0FBSyxTQUFTLElBQUk7QUFBQSxJQUNqQztBQUVBLFVBQU0sZUFBeUIsQ0FBQyxXQUFXLGFBQWEsWUFBWSxVQUFVLFNBQVM7QUFDdkYsZUFBVyxjQUFjLGNBQWM7QUFDckMsWUFBTSxRQUFRLFNBQVMsSUFBSSxVQUFVO0FBQ3JDLFVBQUksQ0FBQyxPQUFPLE9BQVE7QUFFcEIsWUFBTSxZQUFZLEtBQUssT0FBTyxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUNuRSxnQkFBVSxTQUFTLE1BQU07QUFBQSxRQUN2QixLQUFLO0FBQUEsUUFDTCxNQUFNLGVBQWUsVUFBVSxLQUFLO0FBQUEsTUFDdEMsQ0FBQztBQUVELGlCQUFXLFFBQVEsT0FBTztBQUN4QixZQUFJLEtBQUssWUFBYTtBQUN0QixhQUFLLFdBQVcsV0FBVyxNQUFNLGVBQWUsSUFBSSxLQUFLLEtBQUssS0FBSyxZQUFZO0FBQUEsTUFDakY7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBRVEsV0FDTixVQUNBLE1BQ0Esb0JBQ007QUFDTixVQUFNLE9BQU8sU0FBUyxVQUFVLEVBQUUsS0FBSyxnQkFBZ0IsQ0FBQztBQUd4RCxVQUFNLFdBQVcsS0FBSyxVQUFVLEVBQUUsS0FBSyx1QkFBdUIsQ0FBQztBQUMvRCxhQUFTLFVBQVUsRUFBRSxLQUFLLHVCQUF1QixNQUFNLEtBQUssTUFBTSxDQUFDO0FBQ25FLGFBQVMsVUFBVTtBQUFBLE1BQ2pCLEtBQUs7QUFBQSxNQUNMLE1BQU0sR0FBRyxLQUFLLE1BQU0sS0FBSyxjQUFjLEVBQUUsQ0FBQztBQUFBLElBQzVDLENBQUM7QUFHRCxTQUFLLFVBQVU7QUFBQSxNQUNiLEtBQUs7QUFBQSxNQUNMLE1BQU0saUJBQVksY0FBYyxrQkFBa0IsQ0FBQztBQUFBLElBQ3JELENBQUM7QUFHRCxVQUFNLFFBQVEsS0FBSyxVQUFVLEVBQUUsS0FBSyxlQUFlLENBQUM7QUFDcEQsVUFBTSxZQUFZLE1BQU0sVUFBVSxFQUFFLEtBQUssb0JBQW9CLENBQUM7QUFHOUQsVUFBTSxXQUFXLEtBQUssVUFBVSxFQUFFLEtBQUsscUJBQXFCLENBQUM7QUFDN0QsVUFBTSxZQUFZLFNBQVMsVUFBVSxFQUFFLEtBQUssb0JBQW9CLE1BQU0sUUFBUSxDQUFDO0FBQy9FLFVBQU0sVUFBVSxTQUFTLFVBQVUsRUFBRSxLQUFLLGlCQUFpQixDQUFDO0FBRzVELFVBQU0sV0FBVyxLQUFLLFVBQVUsRUFBRSxLQUFLLG9CQUFvQixDQUFDO0FBRTVELFVBQU0sVUFBVSxTQUFTLFNBQVMsVUFBVSxFQUFFLEtBQUssa0NBQWtDLE1BQU0sU0FBSSxDQUFDO0FBQ2hHLFlBQVEsUUFBUSxjQUFjLGFBQWE7QUFFM0MsVUFBTSxXQUFXLFNBQVMsU0FBUyxVQUFVLEVBQUUsS0FBSyxtQ0FBbUMsTUFBTSxTQUFJLENBQUM7QUFDbEcsYUFBUyxRQUFRLGNBQWMsYUFBYTtBQUc1QyxZQUFRLGlCQUFpQixTQUFTLE1BQU0sS0FBSyxnQkFBZ0IsSUFBSSxDQUFDO0FBQ2xFLGFBQVMsaUJBQWlCLFNBQVMsTUFBTSxLQUFLLFlBQVksSUFBSSxDQUFDO0FBRS9ELFNBQUssTUFBTSxJQUFJLEtBQUssT0FBTyxFQUFFLFFBQVEsTUFBTSxXQUFXLFNBQVMsU0FBUyxVQUFVLFVBQVUsQ0FBQztBQUM3RixTQUFLLFdBQVcsTUFBTSxrQkFBa0I7QUFBQSxFQUMxQztBQUFBO0FBQUEsRUFJUSxnQkFBZ0IsTUFBeUI7QUFDL0MsVUFBTSxPQUFPLEtBQUssT0FBTyxZQUFZLElBQUksS0FBSyxTQUFTLEtBQUssS0FBSztBQUNqRSxRQUFJLEtBQUssV0FBVyxXQUFXO0FBQzdCLFdBQUssT0FBTyxZQUFZLE1BQU0sS0FBSyxTQUFTLEtBQUssS0FBSztBQUFBLElBQ3hELE9BQU87QUFDTCxXQUFLLE9BQU8sWUFBWSxNQUFNLEtBQUssU0FBUyxLQUFLLEtBQUs7QUFBQSxJQUN4RDtBQUNBLFNBQUssa0JBQWtCLElBQUk7QUFBQSxFQUM3QjtBQUFBLEVBRVEsWUFBWSxNQUF5QjtBQUMzQyxTQUFLLE9BQU8sWUFBWSxNQUFNLEtBQUssU0FBUyxLQUFLLEtBQUs7QUFDdEQsU0FBSyxrQkFBa0IsSUFBSTtBQUFBLEVBQzdCO0FBQUE7QUFBQSxFQUlRLE9BQWE7QUFDbkIsUUFBSSxDQUFDLEtBQUssU0FBVTtBQUNwQixlQUFXLFFBQVEsS0FBSyxTQUFTLE9BQU87QUFDdEMsWUFBTSxPQUFPLEtBQUssT0FBTyxZQUFZLElBQUksS0FBSyxTQUFTLEtBQUssS0FBSztBQUNqRSxVQUFJLEtBQUssV0FBVyxXQUFXO0FBQzdCLGFBQUssa0JBQWtCLElBQUk7QUFBQSxNQUM3QjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFUSxrQkFBa0IsTUFBeUI7QUFDakQsVUFBTSxlQUFlLGNBQWMsS0FBSyxPQUFPLFNBQVMsZ0JBQWdCO0FBQ3hFLFFBQUksU0FBUyxlQUFlLEtBQUssT0FBTyxTQUFTO0FBQ2pELFFBQUksaUJBQWlCO0FBQ3JCLGVBQVcsS0FBTSxLQUFLLFVBQVUsU0FBUyxDQUFDLEdBQUk7QUFDNUMsVUFBSSxFQUFFLFVBQVUsS0FBSyxPQUFPO0FBQUUseUJBQWlCO0FBQVE7QUFBQSxNQUFPO0FBQzlELGdCQUFVLEtBQUssS0FBSyxFQUFFLGNBQWMsRUFBRTtBQUFBLElBQ3hDO0FBQ0EsU0FBSyxXQUFXLE1BQU0sY0FBYztBQUFBLEVBQ3RDO0FBQUEsRUFFUSxXQUFXLE1BQW1CLG9CQUFrQztBQUN0RSxVQUFNLE9BQU8sS0FBSyxNQUFNLElBQUksS0FBSyxLQUFLO0FBQ3RDLFFBQUksQ0FBQyxLQUFNO0FBRVgsVUFBTSxPQUFPLEtBQUssT0FBTyxZQUFZLElBQUksS0FBSyxTQUFTLEtBQUssS0FBSztBQUNqRSxVQUFNLEVBQUUsV0FBVyxPQUFPLElBQUk7QUFDOUIsVUFBTSxhQUFhLEtBQUssY0FBYztBQUd0QyxTQUFLLFVBQVUsUUFBUSxXQUFXLFNBQVMsQ0FBQztBQUc1QyxVQUFNLE1BQU0sS0FBSyxJQUFJLEdBQUcsWUFBWSxVQUFVO0FBQzlDLFNBQUssVUFBVSxNQUFNLFFBQVEsSUFBSSxNQUFNLEtBQUssUUFBUSxDQUFDLENBQUM7QUFHdEQsVUFBTSxjQUFjLGFBQWE7QUFDakMsUUFBSSxXQUFXLFFBQVE7QUFDckIsV0FBSyxRQUFRLFFBQVEsR0FBRyxLQUFLLE1BQU0sS0FBSyxjQUFjLEVBQUUsQ0FBQyxlQUFlO0FBQ3hFLFdBQUssUUFBUSxZQUFZO0FBQUEsSUFDM0IsV0FBVyxlQUFlLEdBQUc7QUFDM0IsV0FBSyxRQUFRLFFBQVEsU0FBSSxXQUFXLFdBQVcsQ0FBQyxPQUFPO0FBQ3ZELFdBQUssUUFBUSxZQUFZO0FBQUEsSUFDM0IsT0FBTztBQUNMLFdBQUssUUFBUSxRQUFRLElBQUksV0FBVyxDQUFDLFdBQVcsQ0FBQyxPQUFPO0FBQ3hELFdBQUssUUFBUSxZQUFZO0FBQUEsSUFDM0I7QUFHQSxVQUFNLFFBQVEsV0FBVyxXQUFXLEtBQUssYUFBYSxNQUFNO0FBQzVELFNBQUssT0FBTyxhQUFhLGNBQWMsS0FBSztBQUc1QyxRQUFJLFdBQVcsV0FBVztBQUN4QixXQUFLLFFBQVEsUUFBUSxRQUFHO0FBQ3hCLFdBQUssUUFBUSxRQUFRLGNBQWMsYUFBYTtBQUFBLElBQ2xELE9BQU87QUFDTCxXQUFLLFFBQVEsUUFBUSxRQUFHO0FBQ3hCLFdBQUssUUFBUSxRQUFRLGNBQWMsV0FBVyxXQUFXLGlCQUFpQixhQUFhO0FBQUEsSUFDekY7QUFBQSxFQUNGO0FBQ0Y7OztBSnBUQSxJQUFxQixnQkFBckIsY0FBMkMsd0JBQU87QUFBQSxFQUFsRDtBQUFBO0FBQ0Usb0JBQTJCLEVBQUUsR0FBRyxpQkFBaUI7QUFDakQsdUJBQWMsSUFBSSxZQUFZO0FBQzlCLFNBQVEsZ0JBQWdELENBQUM7QUFDekQsU0FBUSxhQUE0QjtBQUFBO0FBQUE7QUFBQSxFQUlwQyxNQUFNLFNBQXdCO0FBQzVCLFVBQU0sS0FBSyxVQUFVO0FBRXJCLFNBQUssYUFBYSxvQkFBb0IsQ0FBQyxTQUFTLElBQUksWUFBWSxNQUFNLElBQUksQ0FBQztBQUUzRSxTQUFLLGNBQWMsU0FBUyx5QkFBeUIsTUFBTSxLQUFLLEtBQUssYUFBYSxDQUFDO0FBRW5GLFNBQUssV0FBVztBQUFBLE1BQ2QsSUFBSTtBQUFBLE1BQ0osTUFBTTtBQUFBLE1BQ04sVUFBVSxNQUFNLEtBQUssS0FBSyxhQUFhO0FBQUEsSUFDekMsQ0FBQztBQUVELFNBQUssY0FBYyxJQUFJLG1CQUFtQixLQUFLLEtBQUssSUFBSSxDQUFDO0FBRXpELFNBQUssSUFBSSxVQUFVLGNBQWMsTUFBTSxLQUFLLEtBQUssYUFBYSxDQUFDO0FBQUEsRUFDakU7QUFBQSxFQUVBLFdBQWlCO0FBQ2YsUUFBSSxLQUFLLGVBQWUsTUFBTTtBQUM1QixhQUFPLGFBQWEsS0FBSyxVQUFVO0FBQ25DLFdBQUssYUFBYTtBQUFBLElBQ3BCO0FBQ0EsU0FBSyxLQUFLLGNBQWM7QUFDeEIsU0FBSyxJQUFJLFVBQVUsbUJBQW1CLGtCQUFrQjtBQUFBLEVBQzFEO0FBQUE7QUFBQSxFQUlBLE1BQU0sZUFBOEI7QUFDbEMsVUFBTSxLQUFLLFlBQVk7QUFBQSxFQUN6QjtBQUFBLEVBRUEsTUFBYyxZQUEyQjtBQUN2QyxVQUFNLE1BQU0sTUFBTSxLQUFLLFNBQVM7QUFDaEMsUUFBSSxDQUFDLElBQUs7QUFDVixRQUFJLElBQUksVUFBVTtBQUNoQixXQUFLLFdBQVcsRUFBRSxHQUFHLGtCQUFrQixHQUFHLElBQUksU0FBUztBQUFBLElBQ3pEO0FBQ0EsUUFBSSxJQUFJLGVBQWU7QUFDckIsV0FBSyxnQkFBZ0IsSUFBSTtBQUFBLElBQzNCO0FBQ0EsUUFBSSxJQUFJLGFBQWE7QUFDbkIsV0FBSyxZQUFZLFFBQVEsSUFBSSxXQUFXO0FBQUEsSUFDMUM7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFjLGNBQTZCO0FBQ3pDLFVBQU0sY0FBMEMsQ0FBQztBQUNqRCxlQUFXLENBQUMsR0FBRyxDQUFDLEtBQUssS0FBSyxZQUFZLFlBQVksR0FBRztBQUNuRCxrQkFBWSxDQUFDLElBQUk7QUFBQSxJQUNuQjtBQUNBLFVBQU0sT0FBbUI7QUFBQSxNQUN2QixVQUFVLEtBQUs7QUFBQSxNQUNmLGVBQWUsS0FBSztBQUFBLE1BQ3BCO0FBQUEsSUFDRjtBQUNBLFVBQU0sS0FBSyxTQUFTLElBQUk7QUFBQSxFQUMxQjtBQUFBLEVBRVEsZUFBcUI7QUFDM0IsUUFBSSxLQUFLLGVBQWUsS0FBTSxRQUFPLGFBQWEsS0FBSyxVQUFVO0FBQ2pFLFNBQUssYUFBYSxPQUFPLFdBQVcsTUFBTTtBQUN4QyxXQUFLLGFBQWE7QUFDbEIsV0FBSyxLQUFLLFlBQVk7QUFBQSxJQUN4QixHQUFHLEdBQUc7QUFBQSxFQUNSO0FBQUE7QUFBQSxFQUlBLE1BQU0sZ0JBQStCO0FBQ25DLFVBQU0sS0FBSyxZQUFZO0FBQUEsRUFDekI7QUFBQTtBQUFBLEVBSUEsa0JBQWtCLEtBQW9DO0FBQ3BELFVBQU0sU0FBUyxLQUFLLGNBQWMsR0FBRztBQUNyQyxRQUFJLENBQUMsT0FBUSxRQUFPO0FBRXBCLFVBQU0sUUFBUSxLQUFLLElBQUksSUFBSSxPQUFPLFlBQVksS0FBSyxLQUFLLEtBQUs7QUFDN0QsV0FBTyxRQUFRLE9BQU87QUFBQSxFQUN4QjtBQUFBLEVBRUEsY0FBYyxLQUFhLFVBQWdDO0FBQ3pELFNBQUssY0FBYyxHQUFHLElBQUk7QUFDMUIsU0FBSyxhQUFhO0FBQUEsRUFDcEI7QUFBQTtBQUFBLEVBSUEsTUFBTSx1QkFBc0M7QUFDMUMsU0FBSyxnQkFBZ0IsQ0FBQztBQUN0QixVQUFNLEtBQUssWUFBWTtBQUV2QixVQUFNLE9BQU8sS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLGtCQUFrQixFQUFFLENBQUM7QUFDckUsUUFBSSxNQUFNLGdCQUFnQixhQUFhO0FBQ3JDLFlBQU8sS0FBSyxLQUFxQixPQUFPO0FBQUEsSUFDMUM7QUFBQSxFQUNGO0FBQUE7QUFBQSxFQUlBLE1BQWMsZUFBOEI7QUFDMUMsVUFBTSxXQUFXLEtBQUssSUFBSSxVQUFVLGdCQUFnQixrQkFBa0I7QUFDdEUsUUFBSSxTQUFTLFFBQVE7QUFDbkIsWUFBTSxLQUFLLElBQUksVUFBVSxXQUFXLFNBQVMsQ0FBQyxDQUFDO0FBQy9DO0FBQUEsSUFDRjtBQUNBLFVBQU0sT0FBTyxLQUFLLElBQUksVUFBVSxhQUFhLEtBQUs7QUFDbEQsUUFBSSxDQUFDLEtBQU07QUFDWCxVQUFNLEtBQUssYUFBYSxFQUFFLE1BQU0sb0JBQW9CLFFBQVEsS0FBSyxDQUFDO0FBQ2xFLFVBQU0sS0FBSyxJQUFJLFVBQVUsV0FBVyxJQUFJO0FBQUEsRUFDMUM7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiZHVySW5UaXRsZSJdCn0K
