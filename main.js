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
    if (!state) return { elapsedMs: 0, status: "idle", stoppedAt: null };
    const elapsed = state.running && state.startedAt !== null ? state.elapsedMs + (Date.now() - state.startedAt) : state.elapsedMs;
    const status = state.running ? "running" : state.elapsedMs > 0 ? "paused" : "idle";
    return { elapsedMs: elapsed, status, stoppedAt: state.stoppedAt ?? null };
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
    const now = Date.now();
    this.states.set(k, {
      ...state,
      elapsedMs: state.elapsedMs + (now - (state.startedAt ?? now)),
      running: false,
      startedAt: null,
      stoppedAt: now
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
    if (sec) boundaries.push({ pos: h2m.index, section: sec, label: cleanText(h2m[2]) });
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
  const sectionLabels = {};
  for (const b of boundaries) {
    sectionLabels[b.section] = b.label;
  }
  return { weekLabel, year, weekNumber: week, parts, fetchedAt: Date.now(), sectionLabels };
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
var SECTION_FALLBACK = {
  opening: "Opening",
  treasures: "Treasures from God's Word",
  ministry: "Apply Yourself to the Ministry",
  living: "Living as Christians",
  closing: "Closing"
};
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
function timestampToHHMM(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function isoWeeksInYear(year) {
  const d = new Date(Date.UTC(year, 11, 28));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
}
function colorState(elapsedMs, durationSec, status) {
  if (status === "idle") return "idle";
  const ratio = elapsedMs / (durationSec * 1e3);
  if (ratio > 1) return "over";
  if (ratio >= WARN_THRESHOLD) return "warn";
  return "ok";
}
var JwTimerView = class extends import_obsidian3.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.schedule = null;
    this.weekKey = "";
    this.cards = /* @__PURE__ */ new Map();
    this.tickHandle = null;
    // Pagination state — initialised to current week in onOpen
    this.viewYear = (/* @__PURE__ */ new Date()).getFullYear();
    this.viewWeek = currentWeekNumber();
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
    const navEl = root.createDiv({ cls: "jw-timer-nav" });
    const prevBtn = navEl.createEl("button", { cls: "jw-timer-nav-btn", text: "\u25C0" });
    this.navLabelEl = navEl.createDiv({ cls: "jw-timer-nav-label" });
    const nextBtn = navEl.createEl("button", { cls: "jw-timer-nav-btn", text: "\u25B6" });
    prevBtn.addEventListener("click", () => void this.navigateWeek(-1));
    nextBtn.addEventListener("click", () => void this.navigateWeek(1));
    this.statusEl = root.createDiv({ cls: "jw-timer-status" });
    this.listEl = root.createDiv({ cls: "jw-timer-list" });
    this.tickHandle = window.setInterval(() => this.tick(), 250);
    this.viewYear = (/* @__PURE__ */ new Date()).getFullYear();
    this.viewWeek = currentWeekNumber();
    await this.loadScheduleForWeek(this.viewYear, this.viewWeek);
  }
  async onClose() {
    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    await this.plugin.persistTimers();
  }
  // ─── Public: called when settings change ────────────────────────────────────
  async reload() {
    this.schedule = null;
    this.cards.clear();
    this.listEl.empty();
    await this.loadScheduleForWeek(this.viewYear, this.viewWeek);
  }
  // ─── Week navigation ─────────────────────────────────────────────────────────
  async navigateWeek(delta) {
    let w = this.viewWeek + delta;
    let y = this.viewYear;
    if (w < 1) {
      y--;
      w = isoWeeksInYear(y);
    } else if (w > isoWeeksInYear(y)) {
      y++;
      w = 1;
    }
    this.viewYear = y;
    this.viewWeek = w;
    this.schedule = null;
    this.cards.clear();
    this.listEl.empty();
    await this.loadScheduleForWeek(y, w);
  }
  // ─── Schedule loading ─────────────────────────────────────────────────────────
  async loadScheduleForWeek(year, week) {
    this.weekKey = cacheKey(year, week);
    this.navLabelEl.setText(`${year} \xB7 W${String(week).padStart(2, "0")}`);
    let schedule = this.plugin.getCachedSchedule(this.weekKey);
    if (!schedule) {
      this.setStatus("loading", "Fetching schedule from wol.jw.org\u2026");
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
    this.navLabelEl.setText(schedule.weekLabel);
    this.setStatus("ok", "");
    this.renderSchedule(schedule);
  }
  setStatus(type, text) {
    this.statusEl.empty();
    this.statusEl.className = `jw-timer-status jw-timer-status--${type}`;
    this.statusEl.setText(text);
  }
  // ─── Render ──────────────────────────────────────────────────────────────────
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
    const sectionLabels = {
      ...SECTION_FALLBACK,
      ...schedule.sectionLabels ?? {}
    };
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
        text: sectionLabels[sectionKey] ?? sectionKey
      });
      for (const part of parts) {
        if (part.isSeparator) continue;
        this.renderCard(sectionEl, part, scheduledStart.get(part.order) ?? startMinutes);
      }
    }
  }
  renderCard(parentEl, part, scheduledStartMins) {
    const card = parentEl.createDiv({ cls: "jw-timer-card" });
    card.setAttribute("data-state", "idle");
    card.setAttribute("data-running", "false");
    const header = card.createDiv({ cls: "jw-timer-card-header" });
    header.createDiv({ cls: "jw-timer-card-title", text: part.label });
    header.createDiv({ cls: "jw-timer-card-allotted", text: `${Math.round(part.durationSec / 60)} min` });
    const endTimeMins = scheduledStartMins + Math.ceil(part.durationSec / 60);
    const timeRow = card.createDiv({ cls: "jw-timer-time-row" });
    const endTimeEl = timeRow.createSpan({
      cls: "jw-timer-end-time",
      text: `End ${minutesToTime(endTimeMins)}`
    });
    const stoppedAtEl = timeRow.createSpan({ cls: "jw-timer-stopped-at" });
    const barEl = card.createDiv({ cls: "jw-timer-bar" });
    const barFillEl = barEl.createDiv({ cls: "jw-timer-bar-fill" });
    const clockRow = card.createDiv({ cls: "jw-timer-clock-row" });
    const elapsedEl = clockRow.createDiv({ cls: "jw-timer-elapsed", text: "00:00" });
    const controls = card.createDiv({ cls: "jw-timer-controls" });
    const playBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-play", text: "\u25B6" });
    playBtn.setAttr("aria-label", "Start timer");
    const resetBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-reset", text: "\u21BA" });
    resetBtn.setAttr("aria-label", "Reset timer");
    playBtn.addEventListener("click", () => this.handlePlayPause(part));
    resetBtn.addEventListener("click", () => this.handleReset(part));
    void endTimeEl;
    this.cards.set(part.order, { cardEl: card, elapsedEl, endTimeEl, stoppedAtEl, playBtn, resetBtn, barFillEl });
    this.updateCard(part, scheduledStartMins);
  }
  // ─── Timer controls ─────────────────────────────────────────────────────────
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
  // ─── Tick & display update ───────────────────────────────────────────────────
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
    const { elapsedMs, status, stoppedAt } = snap;
    const durationMs = part.durationSec * 1e3;
    refs.elapsedEl.setText(formatMmSs(elapsedMs));
    refs.barFillEl.style.width = `${(Math.min(1, elapsedMs / durationMs) * 100).toFixed(1)}%`;
    const endTimeMins = scheduledStartMins + Math.ceil(part.durationSec / 60);
    if (status === "paused" && stoppedAt != null) {
      const d = new Date(stoppedAt);
      const stoppedMins = d.getHours() * 60 + d.getMinutes();
      const late = stoppedMins > endTimeMins;
      refs.stoppedAtEl.setText(`\xB7 Stopped ${timestampToHHMM(stoppedAt)}`);
      refs.stoppedAtEl.className = late ? "jw-timer-stopped-at jw-timer-stopped-at--late" : "jw-timer-stopped-at";
    } else {
      refs.stoppedAtEl.setText("");
      refs.stoppedAtEl.className = "jw-timer-stopped-at";
    }
    const state = colorState(elapsedMs, part.durationSec, status);
    refs.cardEl.setAttribute("data-state", state);
    refs.cardEl.setAttribute("data-running", status === "running" ? "true" : "false");
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3R5cGVzLnRzIiwgInNyYy90aW1lci1lbmdpbmUudHMiLCAic3JjL3NldHRpbmdzLXRhYi50cyIsICJzcmMvdmlldy50cyIsICJzcmMvc2NyYXBlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBERUZBVUxUX1NFVFRJTkdTIH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB0eXBlIHsgUGx1Z2luU2V0dGluZ3MsIFBsdWdpbkRhdGEsIFdlZWtseVNjaGVkdWxlLCBUaW1lclN0YXRlIH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB7IFRpbWVyRW5naW5lIH0gZnJvbSBcIi4vdGltZXItZW5naW5lXCI7XG5pbXBvcnQgeyBKd1RpbWVyU2V0dGluZ3NUYWIgfSBmcm9tIFwiLi9zZXR0aW5ncy10YWJcIjtcbmltcG9ydCB7IEp3VGltZXJWaWV3LCBWSUVXX1RZUEVfSldfVElNRVIgfSBmcm9tIFwiLi92aWV3XCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEp3VGltZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5nczogUGx1Z2luU2V0dGluZ3MgPSB7IC4uLkRFRkFVTFRfU0VUVElOR1MgfTtcbiAgdGltZXJFbmdpbmUgPSBuZXcgVGltZXJFbmdpbmUoKTtcbiAgcHJpdmF0ZSBzY2hlZHVsZUNhY2hlOiBSZWNvcmQ8c3RyaW5nLCBXZWVrbHlTY2hlZHVsZT4gPSB7fTtcbiAgcHJpdmF0ZSBzYXZlSGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgTGlmZWN5Y2xlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLmxvYWREYXRhXygpO1xuXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoVklFV19UWVBFX0pXX1RJTUVSLCAobGVhZikgPT4gbmV3IEp3VGltZXJWaWV3KGxlYWYsIHRoaXMpKTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcInRpbWVyXCIsIFwiT3BlbiBKVyBNZWV0aW5nIFRpbWVyXCIsICgpID0+IHZvaWQgdGhpcy5hY3RpdmF0ZVZpZXcoKSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwib3Blbi1qdy10aW1lclwiLFxuICAgICAgbmFtZTogXCJPcGVuIEpXIE1lZXRpbmcgVGltZXIgc2lkZWJhclwiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHZvaWQgdGhpcy5hY3RpdmF0ZVZpZXcoKSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgSndUaW1lclNldHRpbmdzVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB2b2lkIHRoaXMuYWN0aXZhdGVWaWV3KCkpO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuc2F2ZUhhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnNhdmVIYW5kbGUpO1xuICAgICAgdGhpcy5zYXZlSGFuZGxlID0gbnVsbDtcbiAgICB9XG4gICAgdm9pZCB0aGlzLnBlcnNpc3RUaW1lcnMoKTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9KV19USU1FUik7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2V0dGluZ3MgcGVyc2lzdGVuY2UgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMucGVyc2lzdERhdGEoKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZERhdGFfKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJhdyA9IGF3YWl0IHRoaXMubG9hZERhdGEoKSBhcyBQYXJ0aWFsPFBsdWdpbkRhdGE+IHwgbnVsbDtcbiAgICBpZiAoIXJhdykgcmV0dXJuO1xuICAgIGlmIChyYXcuc2V0dGluZ3MpIHtcbiAgICAgIHRoaXMuc2V0dGluZ3MgPSB7IC4uLkRFRkFVTFRfU0VUVElOR1MsIC4uLnJhdy5zZXR0aW5ncyB9O1xuICAgIH1cbiAgICBpZiAocmF3LnNjaGVkdWxlQ2FjaGUpIHtcbiAgICAgIHRoaXMuc2NoZWR1bGVDYWNoZSA9IHJhdy5zY2hlZHVsZUNhY2hlO1xuICAgIH1cbiAgICBpZiAocmF3LnRpbWVyU3RhdGVzKSB7XG4gICAgICB0aGlzLnRpbWVyRW5naW5lLnJlc3RvcmUocmF3LnRpbWVyU3RhdGVzKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHBlcnNpc3REYXRhKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHRpbWVyU3RhdGVzOiBSZWNvcmQ8c3RyaW5nLCBUaW1lclN0YXRlPiA9IHt9O1xuICAgIGZvciAoY29uc3QgW2ssIHZdIG9mIHRoaXMudGltZXJFbmdpbmUuc25hcHNob3RBbGwoKSkge1xuICAgICAgdGltZXJTdGF0ZXNba10gPSB2O1xuICAgIH1cbiAgICBjb25zdCBkYXRhOiBQbHVnaW5EYXRhID0ge1xuICAgICAgc2V0dGluZ3M6IHRoaXMuc2V0dGluZ3MsXG4gICAgICBzY2hlZHVsZUNhY2hlOiB0aGlzLnNjaGVkdWxlQ2FjaGUsXG4gICAgICB0aW1lclN0YXRlcyxcbiAgICB9O1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEoZGF0YSk7XG4gIH1cblxuICBwcml2YXRlIHNjaGVkdWxlU2F2ZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zYXZlSGFuZGxlICE9PSBudWxsKSB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuc2F2ZUhhbmRsZSk7XG4gICAgdGhpcy5zYXZlSGFuZGxlID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5zYXZlSGFuZGxlID0gbnVsbDtcbiAgICAgIHZvaWQgdGhpcy5wZXJzaXN0RGF0YSgpO1xuICAgIH0sIDUwMCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGltZXIgcGVyc2lzdGVuY2UgaGVscGVycyAoY2FsbGVkIGZyb20gdmlldykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgYXN5bmMgcGVyc2lzdFRpbWVycygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnBlcnNpc3REYXRhKCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2NoZWR1bGUgY2FjaGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgZ2V0Q2FjaGVkU2NoZWR1bGUoa2V5OiBzdHJpbmcpOiBXZWVrbHlTY2hlZHVsZSB8IG51bGwge1xuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuc2NoZWR1bGVDYWNoZVtrZXldO1xuICAgIGlmICghY2FjaGVkKSByZXR1cm4gbnVsbDtcbiAgICAvLyBDYWNoZSBpcyB2YWxpZCBmb3IgMTIgaG91cnNcbiAgICBjb25zdCBzdGFsZSA9IERhdGUubm93KCkgLSBjYWNoZWQuZmV0Y2hlZEF0ID4gMTIgKiA2MCAqIDYwICogMTAwMDtcbiAgICByZXR1cm4gc3RhbGUgPyBudWxsIDogY2FjaGVkO1xuICB9XG5cbiAgY2FjaGVTY2hlZHVsZShrZXk6IHN0cmluZywgc2NoZWR1bGU6IFdlZWtseVNjaGVkdWxlKTogdm9pZCB7XG4gICAgdGhpcy5zY2hlZHVsZUNhY2hlW2tleV0gPSBzY2hlZHVsZTtcbiAgICB0aGlzLnNjaGVkdWxlU2F2ZSgpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNldHRpbmdzIGNoYW5nZSBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGFzeW5jIGNsZWFyQ2FjaGVBbmRSZWZyZXNoKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2NoZWR1bGVDYWNoZSA9IHt9O1xuICAgIGF3YWl0IHRoaXMucGVyc2lzdERhdGEoKTtcbiAgICAvLyBSZWxvYWQgdGhlIG9wZW4gdmlldyBpZiBwcmVzZW50XG4gICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX0pXX1RJTUVSKVswXTtcbiAgICBpZiAobGVhZj8udmlldyBpbnN0YW5jZW9mIEp3VGltZXJWaWV3KSB7XG4gICAgICBhd2FpdCAobGVhZi52aWV3IGFzIEp3VGltZXJWaWV3KS5yZWxvYWQoKTtcbiAgICB9XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgVmlldyBhY3RpdmF0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgYXN5bmMgYWN0aXZhdGVWaWV3KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfSldfVElNRVIpO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGgpIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGV4aXN0aW5nWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRSaWdodExlYWYoZmFsc2UpO1xuICAgIGlmICghbGVhZikgcmV0dXJuO1xuICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHsgdHlwZTogVklFV19UWVBFX0pXX1RJTUVSLCBhY3RpdmU6IHRydWUgfSk7XG4gICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XG4gIH1cbn1cbiIsICIvLyBcdTI1MDBcdTI1MDBcdTI1MDAgRG9tYWluIHR5cGVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgaW50ZXJmYWNlIE1lZXRpbmdQYXJ0IHtcbiAgLyoqIERpc3BsYXkgbGFiZWwgKGUuZy4gXCIxLiBIb3cgTXVjaCBBcmUgWW91IFdpbGxpbmcgdG8gUGF5P1wiKSAqL1xuICBsYWJlbDogc3RyaW5nO1xuICAvKiogU2VjdGlvbiB0aGlzIHBhcnQgYmVsb25ncyB0byAqL1xuICBzZWN0aW9uOiBNZWV0aW5nU2VjdGlvbjtcbiAgLyoqIEFsbG93ZWQgZHVyYXRpb24gaW4gc2Vjb25kcyAqL1xuICBkdXJhdGlvblNlYzogbnVtYmVyO1xuICAvKiogT3JkZXIgd2l0aGluIHRoZSBmdWxsIG1lZXRpbmcgcHJvZ3JhbW1lICovXG4gIG9yZGVyOiBudW1iZXI7XG4gIC8qKiBJZiB0cnVlLCB0aGlzIHBhcnQgaGFzIG5vIHN0b3B3YXRjaCBcdTIwMTQgaXRzIGR1cmF0aW9uIGlzIG9ubHkgdXNlZCBmb3Igc2NoZWR1bGUgdGltaW5nIChlLmcuIHNvbmcpICovXG4gIGlzU2VwYXJhdG9yPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IHR5cGUgTWVldGluZ1NlY3Rpb24gPVxuICB8IFwib3BlbmluZ1wiXG4gIHwgXCJ0cmVhc3VyZXNcIlxuICB8IFwibWluaXN0cnlcIlxuICB8IFwibGl2aW5nXCJcbiAgfCBcImNsb3NpbmdcIjtcblxuZXhwb3J0IGludGVyZmFjZSBXZWVrbHlTY2hlZHVsZSB7XG4gIC8qKiBJU08gd2VlayBsYWJlbCwgZS5nLiBcIkFwcmlsIDIwLTI2XCIgKi9cbiAgd2Vla0xhYmVsOiBzdHJpbmc7XG4gIC8qKiBZZWFyICovXG4gIHllYXI6IG51bWJlcjtcbiAgLyoqIElTTyB3ZWVrIG51bWJlciAoMS01MykgKi9cbiAgd2Vla051bWJlcjogbnVtYmVyO1xuICBwYXJ0czogTWVldGluZ1BhcnRbXTtcbiAgLyoqIFdoZW4gdGhpcyBkYXRhIHdhcyBmZXRjaGVkIChtcyBzaW5jZSBlcG9jaCkgKi9cbiAgZmV0Y2hlZEF0OiBudW1iZXI7XG4gIC8qKiBTY3JhcGVkIGgyIHNlY3Rpb24gaGVhZGluZ3MgaW4gdGhlIHBhZ2UgbGFuZ3VhZ2UgKG9wdGlvbmFsIFx1MjAxNCBhYnNlbnQgaW4gb2xkIGNhY2hlIGVudHJpZXMpICovXG4gIHNlY3Rpb25MYWJlbHM/OiBQYXJ0aWFsPFJlY29yZDxNZWV0aW5nU2VjdGlvbiwgc3RyaW5nPj47XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBUaW1lciBzdGF0ZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGludGVyZmFjZSBUaW1lclN0YXRlIHtcbiAgcGFydE9yZGVyOiBudW1iZXI7XG4gIC8qKiBBY2N1bXVsYXRlZCBlbGFwc2VkIG1zICh3aGVuIHBhdXNlZCkgKi9cbiAgZWxhcHNlZE1zOiBudW1iZXI7XG4gIHJ1bm5pbmc6IGJvb2xlYW47XG4gIC8qKiBEYXRlLm5vdygpIHdoZW4gdGhlIGxhc3Qgc3RhcnQgaGFwcGVuZWQgKi9cbiAgc3RhcnRlZEF0OiBudW1iZXIgfCBudWxsO1xuICAvKiogRGF0ZS5ub3coKSB3aGVuIHRoZSB0aW1lciB3YXMgbGFzdCBwYXVzZWQgKG51bGwgaWYgbmV2ZXIgcGF1c2VkIG9yIGN1cnJlbnRseSBydW5uaW5nKSAqL1xuICBzdG9wcGVkQXQ/OiBudW1iZXIgfCBudWxsO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgUGVyc2lzdGVkIHBsdWdpbiBkYXRhIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgaW50ZXJmYWNlIFBsdWdpbkRhdGEge1xuICBzZXR0aW5nczogUGx1Z2luU2V0dGluZ3M7XG4gIC8qKiBDYWNoZWQgc2NoZWR1bGUsIGtleWVkIGJ5IFwiWVlZWS1XV1wiICovXG4gIHNjaGVkdWxlQ2FjaGU6IFJlY29yZDxzdHJpbmcsIFdlZWtseVNjaGVkdWxlPjtcbiAgLyoqIFRpbWVyIHN0YXRlcywga2V5ZWQgYnkgXCJZWVlZLVdXOnBhcnRPcmRlclwiICovXG4gIHRpbWVyU3RhdGVzOiBSZWNvcmQ8c3RyaW5nLCBUaW1lclN0YXRlPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQbHVnaW5TZXR0aW5ncyB7XG4gIC8qKiBXT0wgbGFuZ3VhZ2UgbG9jYWxlLCBlLmcuIFwicjEvbHAtZVwiIChFbmdsaXNoKSBvciBcInI0L2xwLXNcIiAoU3BhbmlzaCkgKi9cbiAgd29sTG9jYWxlOiBzdHJpbmc7XG4gIC8qKiBNZWV0aW5nIHN0YXJ0IHRpbWUsIEhIOk1NIDI0aCBmb3JtYXQsIGUuZy4gXCIyMDowMFwiICovXG4gIG1lZXRpbmdTdGFydFRpbWU6IHN0cmluZztcbiAgLyoqIE1pbnV0ZXMgZm9yIG9wZW5pbmcgc29uZyArIHByYXllciBiZWZvcmUgZmlyc3QgcHJvZ3JhbW1lIHBhcnQgKi9cbiAgb3BlbmluZ1NvbmdNaW51dGVzOiBudW1iZXI7XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBQbHVnaW5TZXR0aW5ncyA9IHtcbiAgd29sTG9jYWxlOiBcInIxL2xwLWVcIixcbiAgbWVldGluZ1N0YXJ0VGltZTogXCIyMDowMFwiLFxuICBvcGVuaW5nU29uZ01pbnV0ZXM6IDUsXG59O1xuIiwgImltcG9ydCB0eXBlIHsgVGltZXJTdGF0ZSB9IGZyb20gXCIuL3R5cGVzXCI7XG5cbmV4cG9ydCB0eXBlIFRpbWVyU3RhdHVzID0gXCJpZGxlXCIgfCBcInJ1bm5pbmdcIiB8IFwicGF1c2VkXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGltZXJTbmFwc2hvdCB7XG4gIGVsYXBzZWRNczogbnVtYmVyO1xuICBzdGF0dXM6IFRpbWVyU3RhdHVzO1xuICAvKiogV2FsbC1jbG9jayBtcyAoRGF0ZS5ub3coKSkgd2hlbiB0aGUgdGltZXIgd2FzIGxhc3QgcGF1c2VkLiBudWxsIHdoZW4gaWRsZSBvciBydW5uaW5nLiAqL1xuICBzdG9wcGVkQXQ6IG51bWJlciB8IG51bGw7XG59XG5cbmV4cG9ydCBjbGFzcyBUaW1lckVuZ2luZSB7XG4gIHByaXZhdGUgc3RhdGVzID0gbmV3IE1hcDxzdHJpbmcsIFRpbWVyU3RhdGU+KCk7XG5cbiAgcHJpdmF0ZSBrZXkod2Vla0tleTogc3RyaW5nLCBwYXJ0T3JkZXI6IG51bWJlcik6IHN0cmluZyB7XG4gICAgcmV0dXJuIGAke3dlZWtLZXl9OiR7cGFydE9yZGVyfWA7XG4gIH1cblxuICBnZXQod2Vla0tleTogc3RyaW5nLCBwYXJ0T3JkZXI6IG51bWJlcik6IFRpbWVyU25hcHNob3Qge1xuICAgIGNvbnN0IHN0YXRlID0gdGhpcy5zdGF0ZXMuZ2V0KHRoaXMua2V5KHdlZWtLZXksIHBhcnRPcmRlcikpO1xuICAgIGlmICghc3RhdGUpIHJldHVybiB7IGVsYXBzZWRNczogMCwgc3RhdHVzOiBcImlkbGVcIiwgc3RvcHBlZEF0OiBudWxsIH07XG4gICAgY29uc3QgZWxhcHNlZCA9IHN0YXRlLnJ1bm5pbmcgJiYgc3RhdGUuc3RhcnRlZEF0ICE9PSBudWxsXG4gICAgICA/IHN0YXRlLmVsYXBzZWRNcyArIChEYXRlLm5vdygpIC0gc3RhdGUuc3RhcnRlZEF0KVxuICAgICAgOiBzdGF0ZS5lbGFwc2VkTXM7XG4gICAgY29uc3Qgc3RhdHVzOiBUaW1lclN0YXR1cyA9IHN0YXRlLnJ1bm5pbmcgPyBcInJ1bm5pbmdcIiA6IHN0YXRlLmVsYXBzZWRNcyA+IDAgPyBcInBhdXNlZFwiIDogXCJpZGxlXCI7XG4gICAgcmV0dXJuIHsgZWxhcHNlZE1zOiBlbGFwc2VkLCBzdGF0dXMsIHN0b3BwZWRBdDogc3RhdGUuc3RvcHBlZEF0ID8/IG51bGwgfTtcbiAgfVxuXG4gIHN0YXJ0KHdlZWtLZXk6IHN0cmluZywgcGFydE9yZGVyOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBrID0gdGhpcy5rZXkod2Vla0tleSwgcGFydE9yZGVyKTtcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuc3RhdGVzLmdldChrKTtcbiAgICBpZiAoZXhpc3Rpbmc/LnJ1bm5pbmcpIHJldHVybjtcbiAgICB0aGlzLnN0YXRlcy5zZXQoaywge1xuICAgICAgcGFydE9yZGVyLFxuICAgICAgZWxhcHNlZE1zOiBleGlzdGluZz8uZWxhcHNlZE1zID8/IDAsXG4gICAgICBydW5uaW5nOiB0cnVlLFxuICAgICAgc3RhcnRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH0pO1xuICB9XG5cbiAgcGF1c2Uod2Vla0tleTogc3RyaW5nLCBwYXJ0T3JkZXI6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IGsgPSB0aGlzLmtleSh3ZWVrS2V5LCBwYXJ0T3JkZXIpO1xuICAgIGNvbnN0IHN0YXRlID0gdGhpcy5zdGF0ZXMuZ2V0KGspO1xuICAgIGlmICghc3RhdGU/LnJ1bm5pbmcpIHJldHVybjtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMuc3RhdGVzLnNldChrLCB7XG4gICAgICAuLi5zdGF0ZSxcbiAgICAgIGVsYXBzZWRNczogc3RhdGUuZWxhcHNlZE1zICsgKG5vdyAtIChzdGF0ZS5zdGFydGVkQXQgPz8gbm93KSksXG4gICAgICBydW5uaW5nOiBmYWxzZSxcbiAgICAgIHN0YXJ0ZWRBdDogbnVsbCxcbiAgICAgIHN0b3BwZWRBdDogbm93LFxuICAgIH0pO1xuICB9XG5cbiAgcmVzZXQod2Vla0tleTogc3RyaW5nLCBwYXJ0T3JkZXI6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuc3RhdGVzLmRlbGV0ZSh0aGlzLmtleSh3ZWVrS2V5LCBwYXJ0T3JkZXIpKTtcbiAgfVxuXG4gIC8qKiBTbmFwc2hvdCBhbGwgc3RhdGVzIGZvciBwZXJzaXN0ZW5jZSwgZnJlZXppbmcgcnVubmluZyB0aW1lcnMuICovXG4gIHNuYXBzaG90QWxsKCk6IE1hcDxzdHJpbmcsIFRpbWVyU3RhdGU+IHtcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgTWFwPHN0cmluZywgVGltZXJTdGF0ZT4oKTtcbiAgICBmb3IgKGNvbnN0IFtrLCBzdGF0ZV0gb2YgdGhpcy5zdGF0ZXMpIHtcbiAgICAgIGlmIChzdGF0ZS5ydW5uaW5nICYmIHN0YXRlLnN0YXJ0ZWRBdCAhPT0gbnVsbCkge1xuICAgICAgICByZXN1bHQuc2V0KGssIHtcbiAgICAgICAgICAuLi5zdGF0ZSxcbiAgICAgICAgICBlbGFwc2VkTXM6IHN0YXRlLmVsYXBzZWRNcyArIChEYXRlLm5vdygpIC0gc3RhdGUuc3RhcnRlZEF0KSxcbiAgICAgICAgICBydW5uaW5nOiBmYWxzZSxcbiAgICAgICAgICBzdGFydGVkQXQ6IG51bGwsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0LnNldChrLCB7IC4uLnN0YXRlIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqIFJlc3RvcmUgc3RhdGVzIGZyb20gcGVyc2lzdGVkIGRhdGEgKGFsbCBwYXVzZWQpLiAqL1xuICByZXN0b3JlKHNhdmVkOiBSZWNvcmQ8c3RyaW5nLCBUaW1lclN0YXRlPik6IHZvaWQge1xuICAgIHRoaXMuc3RhdGVzLmNsZWFyKCk7XG4gICAgZm9yIChjb25zdCBbaywgc3RhdGVdIG9mIE9iamVjdC5lbnRyaWVzKHNhdmVkKSkge1xuICAgICAgdGhpcy5zdGF0ZXMuc2V0KGssIHsgLi4uc3RhdGUsIHJ1bm5pbmc6IGZhbHNlLCBzdGFydGVkQXQ6IG51bGwgfSk7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSBKd1RpbWVyUGx1Z2luIGZyb20gXCIuL21haW5cIjtcbmltcG9ydCB0eXBlIHsgUGx1Z2luU2V0dGluZ3MgfSBmcm9tIFwiLi90eXBlc1wiO1xuXG4vLyBBdmFpbGFibGUgV09MIGxvY2FsZXM6IGxhYmVsIFx1MjE5MiBsb2NhbGUgcGF0aCBzZWdtZW50XG5jb25zdCBXT0xfTE9DQUxFUzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgXCJFbmdsaXNoXCI6ICAgIFwicjEvbHAtZVwiLFxuICBcIlNwYW5pc2hcIjogICAgXCJyNC9scC1zXCIsXG4gIFwiUG9ydHVndWVzZVwiOiBcInI1L2xwLXRcIixcbiAgXCJGcmVuY2hcIjogICAgIFwicjMwL2xwLWZcIixcbiAgXCJJdGFsaWFuXCI6ICAgIFwicjYvbHAtaVwiLFxuICBcIkdlcm1hblwiOiAgICAgXCJyMTAvbHAtZ1wiLFxuICBcIkR1dGNoXCI6ICAgICAgXCJyMTMvbHAtZFwiLFxuICBcIkphcGFuZXNlXCI6ICAgXCJyNy9scC1qXCIsXG4gIFwiS29yZWFuXCI6ICAgICBcInI4L2xwLWtvXCIsXG4gIFwiQ2hpbmVzZSAoU2ltcGxpZmllZClcIjogXCJyMjMvbHAtY2hzXCIsXG59O1xuXG5leHBvcnQgY2xhc3MgSndUaW1lclNldHRpbmdzVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHJlYWRvbmx5IHBsdWdpbjogSndUaW1lclBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiSlcgTWVldGluZyBUaW1lciBcdTIwMTQgU2V0dGluZ3NcIiB9KTtcblxuICAgIC8vIExhbmd1YWdlIC8gbG9jYWxlXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIk1lZXRpbmcgbGFuZ3VhZ2VcIilcbiAgICAgIC5zZXREZXNjKFwiTGFuZ3VhZ2UgdXNlZCB0byBmZXRjaCB0aGUgd2Vla2x5IHByb2dyYW1tZSBmcm9tIHdvbC5qdy5vcmcuXCIpXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3ApID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBbbGFiZWwsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhXT0xfTE9DQUxFUykpIHtcbiAgICAgICAgICBkcm9wLmFkZE9wdGlvbih2YWx1ZSwgbGFiZWwpO1xuICAgICAgICB9XG4gICAgICAgIGRyb3Auc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mud29sTG9jYWxlKTtcbiAgICAgICAgZHJvcC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy53b2xMb2NhbGUgPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIC8vIEN1c3RvbSBsb2NhbGUgb3ZlcnJpZGVcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiQ3VzdG9tIGxvY2FsZSAoYWR2YW5jZWQpXCIpXG4gICAgICAuc2V0RGVzYyhcbiAgICAgICAgJ092ZXJyaWRlIHdpdGggYW55IFdPTCBsb2NhbGUgcGF0aCwgZS5nLiBcInI0L2xwLXNcIi4gTGVhdmUgYmxhbmsgdG8gdXNlIHRoZSBkcm9wZG93biBzZWxlY3Rpb24uJ1xuICAgICAgKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+IHtcbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcInIxL2xwLWVcIilcbiAgICAgICAgICAuc2V0VmFsdWUoXCJcIilcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xuICAgICAgICAgICAgaWYgKHRyaW1tZWQpIHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mud29sTG9jYWxlID0gdHJpbW1lZDtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIC8vIE1lZXRpbmcgc3RhcnQgdGltZVxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJNZWV0aW5nIHN0YXJ0IHRpbWVcIilcbiAgICAgIC5zZXREZXNjKCcyNC1ob3VyIGZvcm1hdCwgZS5nLiBcIjIwOjAwXCIgb3IgXCIxODozMFwiLicpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT4ge1xuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiMjA6MDBcIilcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubWVldGluZ1N0YXJ0VGltZSlcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xuICAgICAgICAgICAgaWYgKC9eXFxkezEsMn06XFxkezJ9JC8udGVzdCh0cmltbWVkKSkge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tZWV0aW5nU3RhcnRUaW1lID0gdHJpbW1lZDtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIC8vIE9wZW5pbmcgc29uZyBkdXJhdGlvblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJPcGVuaW5nIHNvbmcgKyBwcmF5ZXIgKG1pbnV0ZXMpXCIpXG4gICAgICAuc2V0RGVzYyhcIkZpeGVkIG1pbnV0ZXMgYmVmb3JlIHRoZSBmaXJzdCBwcm9ncmFtbWUgcGFydCAoc29uZyArIHByYXllcikuIERlZmF1bHQ6IDUuXCIpXG4gICAgICAuYWRkU2xpZGVyKChzbGlkZXIpID0+IHtcbiAgICAgICAgc2xpZGVyXG4gICAgICAgICAgLnNldExpbWl0cygxLCAxNSwgMSlcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmluZ1NvbmdNaW51dGVzKVxuICAgICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmluZ1NvbmdNaW51dGVzID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgLy8gTWFudWFsIHJlZnJlc2ggYnV0dG9uXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlJlZnJlc2ggc2NoZWR1bGVcIilcbiAgICAgIC5zZXREZXNjKFwiQ2xlYXIgdGhlIGNhY2hlZCBzY2hlZHVsZSBhbmQgcmUtZmV0Y2ggZnJvbSB3b2wuancub3JnLlwiKVxuICAgICAgLmFkZEJ1dHRvbigoYnRuKSA9PiB7XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KFwiUmVmcmVzaCBub3dcIikub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uY2xlYXJDYWNoZUFuZFJlZnJlc2goKTtcbiAgICAgICAgICBidG4uc2V0QnV0dG9uVGV4dChcIkRvbmUgXHUyNzEzXCIpO1xuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IGJ0bi5zZXRCdXR0b25UZXh0KFwiUmVmcmVzaCBub3dcIiksIDIwMDApO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgSXRlbVZpZXcsIFdvcmtzcGFjZUxlYWYgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIEp3VGltZXJQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuaW1wb3J0IHR5cGUgeyBXZWVrbHlTY2hlZHVsZSwgTWVldGluZ1BhcnQgfSBmcm9tIFwiLi90eXBlc1wiO1xuaW1wb3J0IHR5cGUgeyBUaW1lclNuYXBzaG90IH0gZnJvbSBcIi4vdGltZXItZW5naW5lXCI7XG5pbXBvcnQgeyBjYWNoZUtleSwgY3VycmVudFdlZWtOdW1iZXIsIGZldGNoV2Vla1NjaGVkdWxlIH0gZnJvbSBcIi4vc2NyYXBlclwiO1xuXG5leHBvcnQgY29uc3QgVklFV19UWVBFX0pXX1RJTUVSID0gXCJqdy10aW1lci1zaWRlYmFyXCI7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBDb25zdGFudHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBXQVJOX1RIUkVTSE9MRCA9IDAuOTtcblxuLy8gRmFsbGJhY2sgc2VjdGlvbiBsYWJlbHMgXHUyMDE0IHVzZWQgd2hlbiBzY3JhcGVyIHNlY3Rpb25MYWJlbHMgaXMgYWJzZW50IChvbGQgY2FjaGUpXG5jb25zdCBTRUNUSU9OX0ZBTExCQUNLOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBvcGVuaW5nOiAgIFwiT3BlbmluZ1wiLFxuICB0cmVhc3VyZXM6IFwiVHJlYXN1cmVzIGZyb20gR29kJ3MgV29yZFwiLFxuICBtaW5pc3RyeTogIFwiQXBwbHkgWW91cnNlbGYgdG8gdGhlIE1pbmlzdHJ5XCIsXG4gIGxpdmluZzogICAgXCJMaXZpbmcgYXMgQ2hyaXN0aWFuc1wiLFxuICBjbG9zaW5nOiAgIFwiQ2xvc2luZ1wiLFxufTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEhlbHBlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGZvcm1hdE1tU3MobXM6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IHRvdGFsU2VjID0gTWF0aC5tYXgoMCwgTWF0aC5mbG9vcihtcyAvIDEwMDApKTtcbiAgY29uc3QgbSA9IE1hdGguZmxvb3IodG90YWxTZWMgLyA2MCk7XG4gIGNvbnN0IHMgPSB0b3RhbFNlYyAlIDYwO1xuICByZXR1cm4gYCR7U3RyaW5nKG0pLnBhZFN0YXJ0KDIsIFwiMFwiKX06JHtTdHJpbmcocykucGFkU3RhcnQoMiwgXCIwXCIpfWA7XG59XG5cbmZ1bmN0aW9uIHRpbWVUb01pbnV0ZXModGltZTogc3RyaW5nKTogbnVtYmVyIHtcbiAgY29uc3QgW2hoLCBtbV0gPSB0aW1lLnNwbGl0KFwiOlwiKS5tYXAoTnVtYmVyKTtcbiAgcmV0dXJuIChoaCA/PyAwKSAqIDYwICsgKG1tID8/IDApO1xufVxuXG5mdW5jdGlvbiBtaW51dGVzVG9UaW1lKG1pbnM6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IGggPSBNYXRoLmZsb29yKG1pbnMgLyA2MCkgJSAyNDtcbiAgY29uc3QgbSA9IG1pbnMgJSA2MDtcbiAgcmV0dXJuIGAke1N0cmluZyhoKS5wYWRTdGFydCgyLCBcIjBcIil9OiR7U3RyaW5nKG0pLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xufVxuXG5mdW5jdGlvbiB0aW1lc3RhbXBUb0hITU0obXM6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IGQgPSBuZXcgRGF0ZShtcyk7XG4gIHJldHVybiBgJHtTdHJpbmcoZC5nZXRIb3VycygpKS5wYWRTdGFydCgyLCBcIjBcIil9OiR7U3RyaW5nKGQuZ2V0TWludXRlcygpKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbn1cblxuLyoqIE51bWJlciBvZiBJU08gd2Vla3MgaW4gYSB5ZWFyICg1MiBvciA1MykuIERlYyAyOCBpcyBhbHdheXMgaW4gdGhlIGxhc3QgSVNPIHdlZWsuICovXG5mdW5jdGlvbiBpc29XZWVrc0luWWVhcih5ZWFyOiBudW1iZXIpOiBudW1iZXIge1xuICBjb25zdCBkID0gbmV3IERhdGUoRGF0ZS5VVEMoeWVhciwgMTEsIDI4KSk7XG4gIGQuc2V0VVRDRGF0ZShkLmdldFVUQ0RhdGUoKSArIDQgLSAoZC5nZXRVVENEYXkoKSB8fCA3KSk7XG4gIGNvbnN0IHllYXJTdGFydCA9IG5ldyBEYXRlKERhdGUuVVRDKGQuZ2V0VVRDRnVsbFllYXIoKSwgMCwgMSkpO1xuICByZXR1cm4gTWF0aC5jZWlsKCgoZC5nZXRUaW1lKCkgLSB5ZWFyU3RhcnQuZ2V0VGltZSgpKSAvIDg2XzQwMF8wMDAgKyAxKSAvIDcpO1xufVxuXG50eXBlIFRpbWVyQ29sb3JTdGF0ZSA9IFwiaWRsZVwiIHwgXCJva1wiIHwgXCJ3YXJuXCIgfCBcIm92ZXJcIjtcblxuZnVuY3Rpb24gY29sb3JTdGF0ZShlbGFwc2VkTXM6IG51bWJlciwgZHVyYXRpb25TZWM6IG51bWJlciwgc3RhdHVzOiBUaW1lclNuYXBzaG90W1wic3RhdHVzXCJdKTogVGltZXJDb2xvclN0YXRlIHtcbiAgaWYgKHN0YXR1cyA9PT0gXCJpZGxlXCIpIHJldHVybiBcImlkbGVcIjtcbiAgY29uc3QgcmF0aW8gPSBlbGFwc2VkTXMgLyAoZHVyYXRpb25TZWMgKiAxMDAwKTtcbiAgaWYgKHJhdGlvID4gMSkgcmV0dXJuIFwib3ZlclwiO1xuICBpZiAocmF0aW8gPj0gV0FSTl9USFJFU0hPTEQpIHJldHVybiBcIndhcm5cIjtcbiAgcmV0dXJuIFwib2tcIjtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFR5cGVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5pbnRlcmZhY2UgQ2FyZFJlZnMge1xuICBjYXJkRWw6IEhUTUxFbGVtZW50O1xuICBlbGFwc2VkRWw6IEhUTUxFbGVtZW50O1xuICBlbmRUaW1lRWw6IEhUTUxFbGVtZW50O1xuICBzdG9wcGVkQXRFbDogSFRNTEVsZW1lbnQ7XG4gIHBsYXlCdG46IEhUTUxCdXR0b25FbGVtZW50O1xuICByZXNldEJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIGJhckZpbGxFbDogSFRNTEVsZW1lbnQ7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBWaWV3IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgY2xhc3MgSndUaW1lclZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gIHByaXZhdGUgc2NoZWR1bGU6IFdlZWtseVNjaGVkdWxlIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgd2Vla0tleSA9IFwiXCI7XG4gIHByaXZhdGUgY2FyZHMgPSBuZXcgTWFwPG51bWJlciwgQ2FyZFJlZnM+KCk7XG4gIHByaXZhdGUgdGlja0hhbmRsZTogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgc3RhdHVzRWwhOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBuYXZMYWJlbEVsITogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgbGlzdEVsITogSFRNTEVsZW1lbnQ7XG5cbiAgLy8gUGFnaW5hdGlvbiBzdGF0ZSBcdTIwMTQgaW5pdGlhbGlzZWQgdG8gY3VycmVudCB3ZWVrIGluIG9uT3BlblxuICBwcml2YXRlIHZpZXdZZWFyOiBudW1iZXIgPSBuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCk7XG4gIHByaXZhdGUgdmlld1dlZWs6IG51bWJlciA9IGN1cnJlbnRXZWVrTnVtYmVyKCk7XG5cbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZiwgcHJpdmF0ZSByZWFkb25seSBwbHVnaW46IEp3VGltZXJQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7IHJldHVybiBWSUVXX1RZUEVfSldfVElNRVI7IH1cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHsgcmV0dXJuIFwiSlcgTWVldGluZyBUaW1lclwiOyB9XG4gIGdldEljb24oKTogc3RyaW5nIHsgcmV0dXJuIFwidGltZXJcIjsgfVxuXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByb290ID0gdGhpcy5jb250ZW50RWw7XG4gICAgcm9vdC5lbXB0eSgpO1xuICAgIHJvb3QuYWRkQ2xhc3MoXCJqdy10aW1lci1yb290XCIpO1xuXG4gICAgLy8gXHUyNTAwXHUyNTAwIFdlZWsgbmF2aWdhdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICBjb25zdCBuYXZFbCA9IHJvb3QuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLW5hdlwiIH0pO1xuICAgIGNvbnN0IHByZXZCdG4gPSBuYXZFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJqdy10aW1lci1uYXYtYnRuXCIsIHRleHQ6IFwiXHUyNUMwXCIgfSk7XG4gICAgdGhpcy5uYXZMYWJlbEVsID0gbmF2RWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLW5hdi1sYWJlbFwiIH0pO1xuICAgIGNvbnN0IG5leHRCdG4gPSBuYXZFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJqdy10aW1lci1uYXYtYnRuXCIsIHRleHQ6IFwiXHUyNUI2XCIgfSk7XG4gICAgcHJldkJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdm9pZCB0aGlzLm5hdmlnYXRlV2VlaygtMSkpO1xuICAgIG5leHRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHZvaWQgdGhpcy5uYXZpZ2F0ZVdlZWsoKzEpKTtcblxuICAgIC8vIFx1MjUwMFx1MjUwMCBTdGF0dXMgKyBsaXN0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAgIHRoaXMuc3RhdHVzRWwgPSByb290LmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1zdGF0dXNcIiB9KTtcbiAgICB0aGlzLmxpc3RFbCA9IHJvb3QuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWxpc3RcIiB9KTtcblxuICAgIHRoaXMudGlja0hhbmRsZSA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnRpY2soKSwgMjUwKTtcblxuICAgIHRoaXMudmlld1llYXIgPSBuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCk7XG4gICAgdGhpcy52aWV3V2VlayA9IGN1cnJlbnRXZWVrTnVtYmVyKCk7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2NoZWR1bGVGb3JXZWVrKHRoaXMudmlld1llYXIsIHRoaXMudmlld1dlZWspO1xuICB9XG5cbiAgYXN5bmMgb25DbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy50aWNrSGFuZGxlICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLnRpY2tIYW5kbGUpO1xuICAgICAgdGhpcy50aWNrSGFuZGxlID0gbnVsbDtcbiAgICB9XG4gICAgYXdhaXQgdGhpcy5wbHVnaW4ucGVyc2lzdFRpbWVycygpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFB1YmxpYzogY2FsbGVkIHdoZW4gc2V0dGluZ3MgY2hhbmdlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGFzeW5jIHJlbG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnNjaGVkdWxlID0gbnVsbDtcbiAgICB0aGlzLmNhcmRzLmNsZWFyKCk7XG4gICAgdGhpcy5saXN0RWwuZW1wdHkoKTtcbiAgICBhd2FpdCB0aGlzLmxvYWRTY2hlZHVsZUZvcldlZWsodGhpcy52aWV3WWVhciwgdGhpcy52aWV3V2Vlayk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgV2VlayBuYXZpZ2F0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgYXN5bmMgbmF2aWdhdGVXZWVrKGRlbHRhOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBsZXQgdyA9IHRoaXMudmlld1dlZWsgKyBkZWx0YTtcbiAgICBsZXQgeSA9IHRoaXMudmlld1llYXI7XG4gICAgaWYgKHcgPCAxKSB7XG4gICAgICB5LS07XG4gICAgICB3ID0gaXNvV2Vla3NJblllYXIoeSk7XG4gICAgfSBlbHNlIGlmICh3ID4gaXNvV2Vla3NJblllYXIoeSkpIHtcbiAgICAgIHkrKztcbiAgICAgIHcgPSAxO1xuICAgIH1cbiAgICB0aGlzLnZpZXdZZWFyID0geTtcbiAgICB0aGlzLnZpZXdXZWVrID0gdztcbiAgICB0aGlzLnNjaGVkdWxlID0gbnVsbDtcbiAgICB0aGlzLmNhcmRzLmNsZWFyKCk7XG4gICAgdGhpcy5saXN0RWwuZW1wdHkoKTtcbiAgICBhd2FpdCB0aGlzLmxvYWRTY2hlZHVsZUZvcldlZWsoeSwgdyk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2NoZWR1bGUgbG9hZGluZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIGFzeW5jIGxvYWRTY2hlZHVsZUZvcldlZWsoeWVhcjogbnVtYmVyLCB3ZWVrOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLndlZWtLZXkgPSBjYWNoZUtleSh5ZWFyLCB3ZWVrKTtcbiAgICB0aGlzLm5hdkxhYmVsRWwuc2V0VGV4dChgJHt5ZWFyfSBcdTAwQjcgVyR7U3RyaW5nKHdlZWspLnBhZFN0YXJ0KDIsIFwiMFwiKX1gKTtcblxuICAgIGxldCBzY2hlZHVsZSA9IHRoaXMucGx1Z2luLmdldENhY2hlZFNjaGVkdWxlKHRoaXMud2Vla0tleSk7XG5cbiAgICBpZiAoIXNjaGVkdWxlKSB7XG4gICAgICB0aGlzLnNldFN0YXR1cyhcImxvYWRpbmdcIiwgXCJGZXRjaGluZyBzY2hlZHVsZSBmcm9tIHdvbC5qdy5vcmdcdTIwMjZcIik7XG4gICAgICBzY2hlZHVsZSA9IGF3YWl0IGZldGNoV2Vla1NjaGVkdWxlKHRoaXMucGx1Z2luLnNldHRpbmdzLndvbExvY2FsZSwgeWVhciwgd2Vlayk7XG4gICAgICBpZiAoc2NoZWR1bGUpIHtcbiAgICAgICAgdGhpcy5wbHVnaW4uY2FjaGVTY2hlZHVsZSh0aGlzLndlZWtLZXksIHNjaGVkdWxlKTtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFzY2hlZHVsZSkge1xuICAgICAgdGhpcy5zZXRTdGF0dXMoXCJlcnJvclwiLCBcIkNvdWxkIG5vdCBsb2FkIHNjaGVkdWxlLiBDaGVjayB5b3VyIGNvbm5lY3Rpb24gYW5kIGxhbmd1YWdlIHNldHRpbmcuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc2NoZWR1bGUgPSBzY2hlZHVsZTtcbiAgICB0aGlzLm5hdkxhYmVsRWwuc2V0VGV4dChzY2hlZHVsZS53ZWVrTGFiZWwpO1xuICAgIHRoaXMuc2V0U3RhdHVzKFwib2tcIiwgXCJcIik7XG4gICAgdGhpcy5yZW5kZXJTY2hlZHVsZShzY2hlZHVsZSk7XG4gIH1cblxuICBwcml2YXRlIHNldFN0YXR1cyh0eXBlOiBcIm9rXCIgfCBcImxvYWRpbmdcIiB8IFwiZXJyb3JcIiwgdGV4dDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5zdGF0dXNFbC5lbXB0eSgpO1xuICAgIHRoaXMuc3RhdHVzRWwuY2xhc3NOYW1lID0gYGp3LXRpbWVyLXN0YXR1cyBqdy10aW1lci1zdGF0dXMtLSR7dHlwZX1gO1xuICAgIHRoaXMuc3RhdHVzRWwuc2V0VGV4dCh0ZXh0KTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBSZW5kZXIgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgcHJpdmF0ZSByZW5kZXJTY2hlZHVsZShzY2hlZHVsZTogV2Vla2x5U2NoZWR1bGUpOiB2b2lkIHtcbiAgICB0aGlzLmxpc3RFbC5lbXB0eSgpO1xuICAgIHRoaXMuY2FyZHMuY2xlYXIoKTtcblxuICAgIGNvbnN0IHN0YXJ0TWludXRlcyA9IHRpbWVUb01pbnV0ZXModGhpcy5wbHVnaW4uc2V0dGluZ3MubWVldGluZ1N0YXJ0VGltZSk7XG4gICAgbGV0IGN1cnNvciA9IHN0YXJ0TWludXRlcyArIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5pbmdTb25nTWludXRlcztcblxuICAgIGNvbnN0IHNjaGVkdWxlZFN0YXJ0ID0gbmV3IE1hcDxudW1iZXIsIG51bWJlcj4oKTtcbiAgICBmb3IgKGNvbnN0IHBhcnQgb2Ygc2NoZWR1bGUucGFydHMpIHtcbiAgICAgIHNjaGVkdWxlZFN0YXJ0LnNldChwYXJ0Lm9yZGVyLCBjdXJzb3IpO1xuICAgICAgY3Vyc29yICs9IE1hdGguY2VpbChwYXJ0LmR1cmF0aW9uU2VjIC8gNjApO1xuICAgIH1cblxuICAgIC8vIE1lcmdlIHNjcmFwZWQgc2VjdGlvbiBsYWJlbHMgKGluIHBhZ2UgbGFuZ3VhZ2UpIHdpdGggRW5nbGlzaCBmYWxsYmFja1xuICAgIGNvbnN0IHNlY3Rpb25MYWJlbHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICAuLi5TRUNUSU9OX0ZBTExCQUNLLFxuICAgICAgLi4uKHNjaGVkdWxlLnNlY3Rpb25MYWJlbHMgPz8ge30pLFxuICAgIH07XG5cbiAgICAvLyBHcm91cCBwYXJ0cyBieSBzZWN0aW9uXG4gICAgY29uc3Qgc2VjdGlvbnMgPSBuZXcgTWFwPHN0cmluZywgTWVldGluZ1BhcnRbXT4oKTtcbiAgICBmb3IgKGNvbnN0IHBhcnQgb2Ygc2NoZWR1bGUucGFydHMpIHtcbiAgICAgIGNvbnN0IGxpc3QgPSBzZWN0aW9ucy5nZXQocGFydC5zZWN0aW9uKSA/PyBbXTtcbiAgICAgIGxpc3QucHVzaChwYXJ0KTtcbiAgICAgIHNlY3Rpb25zLnNldChwYXJ0LnNlY3Rpb24sIGxpc3QpO1xuICAgIH1cblxuICAgIGNvbnN0IHNlY3Rpb25PcmRlciA9IFtcIm9wZW5pbmdcIiwgXCJ0cmVhc3VyZXNcIiwgXCJtaW5pc3RyeVwiLCBcImxpdmluZ1wiLCBcImNsb3NpbmdcIl07XG4gICAgZm9yIChjb25zdCBzZWN0aW9uS2V5IG9mIHNlY3Rpb25PcmRlcikge1xuICAgICAgY29uc3QgcGFydHMgPSBzZWN0aW9ucy5nZXQoc2VjdGlvbktleSk7XG4gICAgICBpZiAoIXBhcnRzPy5sZW5ndGgpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBzZWN0aW9uRWwgPSB0aGlzLmxpc3RFbC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItc2VjdGlvblwiIH0pO1xuICAgICAgc2VjdGlvbkVsLmNyZWF0ZUVsKFwiaDNcIiwge1xuICAgICAgICBjbHM6IFwianctdGltZXItc2VjdGlvbi10aXRsZVwiLFxuICAgICAgICB0ZXh0OiBzZWN0aW9uTGFiZWxzW3NlY3Rpb25LZXldID8/IHNlY3Rpb25LZXksXG4gICAgICB9KTtcblxuICAgICAgZm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzKSB7XG4gICAgICAgIGlmIChwYXJ0LmlzU2VwYXJhdG9yKSBjb250aW51ZTtcbiAgICAgICAgdGhpcy5yZW5kZXJDYXJkKHNlY3Rpb25FbCwgcGFydCwgc2NoZWR1bGVkU3RhcnQuZ2V0KHBhcnQub3JkZXIpID8/IHN0YXJ0TWludXRlcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJDYXJkKHBhcmVudEVsOiBIVE1MRWxlbWVudCwgcGFydDogTWVldGluZ1BhcnQsIHNjaGVkdWxlZFN0YXJ0TWluczogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgY2FyZCA9IHBhcmVudEVsLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jYXJkXCIgfSk7XG4gICAgY2FyZC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXN0YXRlXCIsIFwiaWRsZVwiKTtcbiAgICBjYXJkLnNldEF0dHJpYnV0ZShcImRhdGEtcnVubmluZ1wiLCBcImZhbHNlXCIpO1xuXG4gICAgLy8gVGl0bGUgKyBhbGxvdHRlZCBtaW51dGVzXG4gICAgY29uc3QgaGVhZGVyID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2FyZC1oZWFkZXJcIiB9KTtcbiAgICBoZWFkZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNhcmQtdGl0bGVcIiwgdGV4dDogcGFydC5sYWJlbCB9KTtcbiAgICBoZWFkZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNhcmQtYWxsb3R0ZWRcIiwgdGV4dDogYCR7TWF0aC5yb3VuZChwYXJ0LmR1cmF0aW9uU2VjIC8gNjApfSBtaW5gIH0pO1xuXG4gICAgLy8gU2NoZWR1bGVkIGVuZCB0aW1lICsgYWN0dWFsIHN0b3BwZWQtYXQgdGltZVxuICAgIGNvbnN0IGVuZFRpbWVNaW5zID0gc2NoZWR1bGVkU3RhcnRNaW5zICsgTWF0aC5jZWlsKHBhcnQuZHVyYXRpb25TZWMgLyA2MCk7XG4gICAgY29uc3QgdGltZVJvdyA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLXRpbWUtcm93XCIgfSk7XG4gICAgY29uc3QgZW5kVGltZUVsID0gdGltZVJvdy5jcmVhdGVTcGFuKHtcbiAgICAgIGNsczogXCJqdy10aW1lci1lbmQtdGltZVwiLFxuICAgICAgdGV4dDogYEVuZCAke21pbnV0ZXNUb1RpbWUoZW5kVGltZU1pbnMpfWAsXG4gICAgfSk7XG4gICAgY29uc3Qgc3RvcHBlZEF0RWwgPSB0aW1lUm93LmNyZWF0ZVNwYW4oeyBjbHM6IFwianctdGltZXItc3RvcHBlZC1hdFwiIH0pO1xuXG4gICAgLy8gUHJvZ3Jlc3MgYmFyXG4gICAgY29uc3QgYmFyRWwgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1iYXJcIiB9KTtcbiAgICBjb25zdCBiYXJGaWxsRWwgPSBiYXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItYmFyLWZpbGxcIiB9KTtcblxuICAgIC8vIExhcmdlIGVsYXBzZWQgY2xvY2tcbiAgICBjb25zdCBjbG9ja1JvdyA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNsb2NrLXJvd1wiIH0pO1xuICAgIGNvbnN0IGVsYXBzZWRFbCA9IGNsb2NrUm93LmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1lbGFwc2VkXCIsIHRleHQ6IFwiMDA6MDBcIiB9KTtcblxuICAgIC8vIENvbnRyb2xzXG4gICAgY29uc3QgY29udHJvbHMgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jb250cm9sc1wiIH0pO1xuICAgIGNvbnN0IHBsYXlCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJqdy10aW1lci1idG4ganctdGltZXItYnRuLXBsYXlcIiwgdGV4dDogXCJcdTI1QjZcIiB9KTtcbiAgICBwbGF5QnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiU3RhcnQgdGltZXJcIik7XG4gICAgY29uc3QgcmVzZXRCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJqdy10aW1lci1idG4ganctdGltZXItYnRuLXJlc2V0XCIsIHRleHQ6IFwiXHUyMUJBXCIgfSk7XG4gICAgcmVzZXRCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJSZXNldCB0aW1lclwiKTtcblxuICAgIHBsYXlCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHRoaXMuaGFuZGxlUGxheVBhdXNlKHBhcnQpKTtcbiAgICByZXNldEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5oYW5kbGVSZXNldChwYXJ0KSk7XG5cbiAgICAvLyBTdXBwcmVzcyB1bnVzZWQtdmFyIHdhcm5pbmcgXHUyMDE0IGVuZFRpbWVFbCBjb250ZW50IGlzIHNldCBvbmNlIGFuZCBuZXZlciBjaGFuZ2VzXG4gICAgdm9pZCBlbmRUaW1lRWw7XG5cbiAgICB0aGlzLmNhcmRzLnNldChwYXJ0Lm9yZGVyLCB7IGNhcmRFbDogY2FyZCwgZWxhcHNlZEVsLCBlbmRUaW1lRWwsIHN0b3BwZWRBdEVsLCBwbGF5QnRuLCByZXNldEJ0biwgYmFyRmlsbEVsIH0pO1xuICAgIHRoaXMudXBkYXRlQ2FyZChwYXJ0LCBzY2hlZHVsZWRTdGFydE1pbnMpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRpbWVyIGNvbnRyb2xzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgaGFuZGxlUGxheVBhdXNlKHBhcnQ6IE1lZXRpbmdQYXJ0KTogdm9pZCB7XG4gICAgY29uc3Qgc25hcCA9IHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLmdldCh0aGlzLndlZWtLZXksIHBhcnQub3JkZXIpO1xuICAgIGlmIChzbmFwLnN0YXR1cyA9PT0gXCJydW5uaW5nXCIpIHtcbiAgICAgIHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLnBhdXNlKHRoaXMud2Vla0tleSwgcGFydC5vcmRlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLnN0YXJ0KHRoaXMud2Vla0tleSwgcGFydC5vcmRlcik7XG4gICAgfVxuICAgIHRoaXMudXBkYXRlQ2FyZEJ5T3JkZXIocGFydCk7XG4gIH1cblxuICBwcml2YXRlIGhhbmRsZVJlc2V0KHBhcnQ6IE1lZXRpbmdQYXJ0KTogdm9pZCB7XG4gICAgdGhpcy5wbHVnaW4udGltZXJFbmdpbmUucmVzZXQodGhpcy53ZWVrS2V5LCBwYXJ0Lm9yZGVyKTtcbiAgICB0aGlzLnVwZGF0ZUNhcmRCeU9yZGVyKHBhcnQpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRpY2sgJiBkaXNwbGF5IHVwZGF0ZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIHRpY2soKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnNjaGVkdWxlKSByZXR1cm47XG4gICAgZm9yIChjb25zdCBwYXJ0IG9mIHRoaXMuc2NoZWR1bGUucGFydHMpIHtcbiAgICAgIGNvbnN0IHNuYXAgPSB0aGlzLnBsdWdpbi50aW1lckVuZ2luZS5nZXQodGhpcy53ZWVrS2V5LCBwYXJ0Lm9yZGVyKTtcbiAgICAgIGlmIChzbmFwLnN0YXR1cyA9PT0gXCJydW5uaW5nXCIpIHtcbiAgICAgICAgdGhpcy51cGRhdGVDYXJkQnlPcmRlcihwYXJ0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUNhcmRCeU9yZGVyKHBhcnQ6IE1lZXRpbmdQYXJ0KTogdm9pZCB7XG4gICAgY29uc3Qgc3RhcnRNaW51dGVzID0gdGltZVRvTWludXRlcyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5tZWV0aW5nU3RhcnRUaW1lKTtcbiAgICBsZXQgY3Vyc29yID0gc3RhcnRNaW51dGVzICsgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmluZ1NvbmdNaW51dGVzO1xuICAgIGxldCBzY2hlZHVsZWRTdGFydCA9IGN1cnNvcjtcbiAgICBmb3IgKGNvbnN0IHAgb2YgKHRoaXMuc2NoZWR1bGU/LnBhcnRzID8/IFtdKSkge1xuICAgICAgaWYgKHAub3JkZXIgPT09IHBhcnQub3JkZXIpIHsgc2NoZWR1bGVkU3RhcnQgPSBjdXJzb3I7IGJyZWFrOyB9XG4gICAgICBjdXJzb3IgKz0gTWF0aC5jZWlsKHAuZHVyYXRpb25TZWMgLyA2MCk7XG4gICAgfVxuICAgIHRoaXMudXBkYXRlQ2FyZChwYXJ0LCBzY2hlZHVsZWRTdGFydCk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUNhcmQocGFydDogTWVldGluZ1BhcnQsIHNjaGVkdWxlZFN0YXJ0TWluczogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgcmVmcyA9IHRoaXMuY2FyZHMuZ2V0KHBhcnQub3JkZXIpO1xuICAgIGlmICghcmVmcykgcmV0dXJuO1xuXG4gICAgY29uc3Qgc25hcCA9IHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLmdldCh0aGlzLndlZWtLZXksIHBhcnQub3JkZXIpO1xuICAgIGNvbnN0IHsgZWxhcHNlZE1zLCBzdGF0dXMsIHN0b3BwZWRBdCB9ID0gc25hcDtcbiAgICBjb25zdCBkdXJhdGlvbk1zID0gcGFydC5kdXJhdGlvblNlYyAqIDEwMDA7XG5cbiAgICAvLyBFbGFwc2VkIGNsb2NrXG4gICAgcmVmcy5lbGFwc2VkRWwuc2V0VGV4dChmb3JtYXRNbVNzKGVsYXBzZWRNcykpO1xuXG4gICAgLy8gUHJvZ3Jlc3MgYmFyXG4gICAgcmVmcy5iYXJGaWxsRWwuc3R5bGUud2lkdGggPSBgJHsoTWF0aC5taW4oMSwgZWxhcHNlZE1zIC8gZHVyYXRpb25NcykgKiAxMDApLnRvRml4ZWQoMSl9JWA7XG5cbiAgICAvLyBTdG9wcGVkLWF0IGluZGljYXRvciAoc2hvd24gb25seSB3aGVuIHBhdXNlZClcbiAgICBjb25zdCBlbmRUaW1lTWlucyA9IHNjaGVkdWxlZFN0YXJ0TWlucyArIE1hdGguY2VpbChwYXJ0LmR1cmF0aW9uU2VjIC8gNjApO1xuICAgIGlmIChzdGF0dXMgPT09IFwicGF1c2VkXCIgJiYgc3RvcHBlZEF0ICE9IG51bGwpIHtcbiAgICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShzdG9wcGVkQXQpO1xuICAgICAgY29uc3Qgc3RvcHBlZE1pbnMgPSBkLmdldEhvdXJzKCkgKiA2MCArIGQuZ2V0TWludXRlcygpO1xuICAgICAgY29uc3QgbGF0ZSA9IHN0b3BwZWRNaW5zID4gZW5kVGltZU1pbnM7XG4gICAgICByZWZzLnN0b3BwZWRBdEVsLnNldFRleHQoYFx1MDBCNyBTdG9wcGVkICR7dGltZXN0YW1wVG9ISE1NKHN0b3BwZWRBdCl9YCk7XG4gICAgICByZWZzLnN0b3BwZWRBdEVsLmNsYXNzTmFtZSA9IGxhdGVcbiAgICAgICAgPyBcImp3LXRpbWVyLXN0b3BwZWQtYXQganctdGltZXItc3RvcHBlZC1hdC0tbGF0ZVwiXG4gICAgICAgIDogXCJqdy10aW1lci1zdG9wcGVkLWF0XCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZnMuc3RvcHBlZEF0RWwuc2V0VGV4dChcIlwiKTtcbiAgICAgIHJlZnMuc3RvcHBlZEF0RWwuY2xhc3NOYW1lID0gXCJqdy10aW1lci1zdG9wcGVkLWF0XCI7XG4gICAgfVxuXG4gICAgLy8gQ2FyZCBjb2xvdXIgc3RhdGUgKyBydW5uaW5nIGluZGljYXRvciBmb3IgQ1NTXG4gICAgY29uc3Qgc3RhdGUgPSBjb2xvclN0YXRlKGVsYXBzZWRNcywgcGFydC5kdXJhdGlvblNlYywgc3RhdHVzKTtcbiAgICByZWZzLmNhcmRFbC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXN0YXRlXCIsIHN0YXRlKTtcbiAgICByZWZzLmNhcmRFbC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXJ1bm5pbmdcIiwgc3RhdHVzID09PSBcInJ1bm5pbmdcIiA/IFwidHJ1ZVwiIDogXCJmYWxzZVwiKTtcblxuICAgIC8vIFBsYXkvcGF1c2UgYnV0dG9uIGljb25cbiAgICBpZiAoc3RhdHVzID09PSBcInJ1bm5pbmdcIikge1xuICAgICAgcmVmcy5wbGF5QnRuLnNldFRleHQoXCJcdTIzRjhcIik7XG4gICAgICByZWZzLnBsYXlCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJQYXVzZSB0aW1lclwiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVmcy5wbGF5QnRuLnNldFRleHQoXCJcdTI1QjZcIik7XG4gICAgICByZWZzLnBsYXlCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgc3RhdHVzID09PSBcInBhdXNlZFwiID8gXCJSZXN1bWUgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgcmVxdWVzdFVybCB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgeyBXZWVrbHlTY2hlZHVsZSwgTWVldGluZ1BhcnQsIE1lZXRpbmdTZWN0aW9uIH0gZnJvbSBcIi4vdHlwZXNcIjtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFVSTCBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBpc29XZWVrKGRhdGU6IERhdGUpOiBudW1iZXIge1xuICBjb25zdCBkID0gbmV3IERhdGUoRGF0ZS5VVEMoZGF0ZS5nZXRGdWxsWWVhcigpLCBkYXRlLmdldE1vbnRoKCksIGRhdGUuZ2V0RGF0ZSgpKSk7XG4gIGQuc2V0VVRDRGF0ZShkLmdldFVUQ0RhdGUoKSArIDQgLSAoZC5nZXRVVENEYXkoKSB8fCA3KSk7XG4gIGNvbnN0IHllYXJTdGFydCA9IG5ldyBEYXRlKERhdGUuVVRDKGQuZ2V0VVRDRnVsbFllYXIoKSwgMCwgMSkpO1xuICByZXR1cm4gTWF0aC5jZWlsKCgoZC5nZXRUaW1lKCkgLSB5ZWFyU3RhcnQuZ2V0VGltZSgpKSAvIDg2XzQwMF8wMDAgKyAxKSAvIDcpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3VycmVudFdlZWtOdW1iZXIoKTogbnVtYmVyIHtcbiAgcmV0dXJuIGlzb1dlZWsobmV3IERhdGUoKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFdvbFVybChsb2NhbGU6IHN0cmluZywgeWVhcjogbnVtYmVyLCB3ZWVrOiBudW1iZXIpOiBzdHJpbmcge1xuICByZXR1cm4gYGh0dHBzOi8vd29sLmp3Lm9yZy9lbi93b2wvbWVldGluZ3MvJHtsb2NhbGV9LyR7eWVhcn0vJHt3ZWVrfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjYWNoZUtleSh5ZWFyOiBudW1iZXIsIHdlZWs6IG51bWJlcik6IHN0cmluZyB7XG4gIHJldHVybiBgJHt5ZWFyfS0ke1N0cmluZyh3ZWVrKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIER1cmF0aW9uIHBhcnNpbmcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbi8qKlxuICogTWF0Y2hlcyBcIihOIG1pbi4pXCIgT1IgXCIoTiBtaW5zLilcIiBcdTIwMTQgaGFuZGxlcyBFbmdsaXNoIChcIm1pbi5cIikgYW5kIFNwYW5pc2ggKFwibWlucy5cIikuXG4gKiBUaGUgcmVnZXggaXMgYXBwbGllZCBhZ2FpbnN0IHBsYWluIHRleHQgYWZ0ZXIgc3RyaXBwaW5nIEhUTUwgdGFncy5cbiAqL1xuY29uc3QgRFVSQVRJT05fUkUgPSAvXFwoKFxcZCspXFxzKm1pbnM/XFwuXFwpL2k7XG5cbmZ1bmN0aW9uIHBhcnNlRHVyYXRpb24odGV4dDogc3RyaW5nKTogbnVtYmVyIHwgbnVsbCB7XG4gIGNvbnN0IG0gPSBEVVJBVElPTl9SRS5leGVjKHRleHQpO1xuICByZXR1cm4gbSA/IHBhcnNlSW50KG1bMV0sIDEwKSAqIDYwIDogbnVsbDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEZldGNoIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmV0Y2hXZWVrU2NoZWR1bGUoXG4gIGxvY2FsZTogc3RyaW5nLFxuICB5ZWFyOiBudW1iZXIsXG4gIHdlZWs6IG51bWJlclxuKTogUHJvbWlzZTxXZWVrbHlTY2hlZHVsZSB8IG51bGw+IHtcbiAgLy8gU3RlcCAxOiBmZXRjaCB0aGUgbWVldGluZ3MgaW5kZXggcGFnZSB0byBmaW5kIHRoZSBNV0IgZG9jIGxpbmtcbiAgY29uc3QgbWVldGluZ3NVcmwgPSBidWlsZFdvbFVybChsb2NhbGUsIHllYXIsIHdlZWspO1xuICBsZXQgbWVldGluZ3NIdG1sOiBzdHJpbmc7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzcCA9IGF3YWl0IHJlcXVlc3RVcmwoe1xuICAgICAgdXJsOiBtZWV0aW5nc1VybCxcbiAgICAgIGhlYWRlcnM6IHsgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IEpXVGltZXJPYnNpZGlhbi8yLjApXCIgfSxcbiAgICB9KTtcbiAgICBpZiAocmVzcC5zdGF0dXMgPCAyMDAgfHwgcmVzcC5zdGF0dXMgPj0gMzAwKSByZXR1cm4gbnVsbDtcbiAgICBtZWV0aW5nc0h0bWwgPSByZXNwLnRleHQ7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gTVdCIGRvYyBJRHMgYXJlIDkrIGRpZ2l0c1xuICBjb25zdCBkb2NMaW5rUmUgPSAvaHJlZj1cIihcXC9bXlwiXStcXC93b2xcXC9kXFwvW15cIiM/XSspXCIvZztcbiAgY29uc3QgZG9jTGlua3M6IHN0cmluZ1tdID0gW107XG4gIGxldCBtOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuICB3aGlsZSAoKG0gPSBkb2NMaW5rUmUuZXhlYyhtZWV0aW5nc0h0bWwpKSAhPT0gbnVsbCkge1xuICAgIGlmICgvXFwvXFxkezksfSQvLnRlc3QobVsxXSkpIGRvY0xpbmtzLnB1c2gobVsxXSk7XG4gIH1cbiAgaWYgKGRvY0xpbmtzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG5cbiAgLy8gU3RlcCAyOiBmZXRjaCB0aGUgTVdCIGFydGljbGUgcGFnZVxuICBjb25zdCBkb2NVcmwgPSBgaHR0cHM6Ly93b2wuancub3JnJHtkb2NMaW5rc1swXX1gO1xuICBsZXQgZG9jSHRtbDogc3RyaW5nO1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3AgPSBhd2FpdCByZXF1ZXN0VXJsKHtcbiAgICAgIHVybDogZG9jVXJsLFxuICAgICAgaGVhZGVyczogeyBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgSldUaW1lck9ic2lkaWFuLzIuMClcIiB9LFxuICAgIH0pO1xuICAgIGlmIChyZXNwLnN0YXR1cyA8IDIwMCB8fCByZXNwLnN0YXR1cyA+PSAzMDApIHJldHVybiBudWxsO1xuICAgIGRvY0h0bWwgPSByZXNwLnRleHQ7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIHBhcnNlRG9jUGFnZShkb2NIdG1sLCB5ZWFyLCB3ZWVrKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEhUTUwgdXRpbGl0aWVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBjbGVhblRleHQoaHRtbDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGh0bWxcbiAgICAucmVwbGFjZSgvPFtePl0rPi9nLCBcIiBcIilcbiAgICAucmVwbGFjZSgvJmFtcDsvZywgXCImXCIpXG4gICAgLnJlcGxhY2UoLyZsdDsvZywgXCI8XCIpXG4gICAgLnJlcGxhY2UoLyZndDsvZywgXCI+XCIpXG4gICAgLnJlcGxhY2UoLyZxdW90Oy9nLCAnXCInKVxuICAgIC5yZXBsYWNlKC8mIzM5Oy9nLCBcIidcIilcbiAgICAucmVwbGFjZSgvJm5ic3A7L2csIFwiIFwiKVxuICAgIC5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKVxuICAgIC50cmltKCk7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBEb2MgcGFnZSBwYXJzaW5nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBwYXJzZURvY1BhZ2UoaHRtbDogc3RyaW5nLCB5ZWFyOiBudW1iZXIsIHdlZWs6IG51bWJlcik6IFdlZWtseVNjaGVkdWxlIHwgbnVsbCB7XG4gIC8vIFdlZWsgbGFiZWwgZnJvbSBoMVxuICBjb25zdCBoMU1hdGNoID0gLzxoMVtePl0qPihbXFxzXFxTXSo/KTxcXC9oMT4vaS5leGVjKGh0bWwpO1xuICBjb25zdCB3ZWVrTGFiZWwgPSBoMU1hdGNoID8gY2xlYW5UZXh0KGgxTWF0Y2hbMV0pIDogYFdlZWsgJHt3ZWVrfWA7XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFNlY3Rpb24gZGV0ZWN0aW9uIHZpYSBDU1MgY29sb3VyIGNsYXNzZXMgKGxhbmd1YWdlLWluZGVwZW5kZW50KSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgLy8gaDIgd2l0aCBjbGFzcyBkdS1jb2xvci0tdGVhbC03MDAgICBcdTIxOTIgVFJFQVNVUkVTIEZST00gR09EJ1MgV09SRFxuICAvLyBoMiB3aXRoIGNsYXNzIGR1LWNvbG9yLS1nb2xkLTcwMCAgIFx1MjE5MiBBUFBMWSBZT1VSU0VMRiBUTyBUSEUgRklFTEQgTUlOSVNUUllcbiAgLy8gaDIgd2l0aCBjbGFzcyBkdS1jb2xvci0tbWFyb29uLTYwMCBcdTIxOTIgTElWSU5HIEFTIENIUklTVElBTlNcbiAgdHlwZSBTZWN0aW9uQm91bmRhcnkgPSB7IHBvczogbnVtYmVyOyBzZWN0aW9uOiBNZWV0aW5nU2VjdGlvbjsgbGFiZWw6IHN0cmluZyB9O1xuICBjb25zdCBib3VuZGFyaWVzOiBTZWN0aW9uQm91bmRhcnlbXSA9IFtdO1xuXG4gIGNvbnN0IGgyUmUgPSAvPGgyKFtePl0qKT4oW1xcc1xcU10qPyk8XFwvaDI+L2dpO1xuICBsZXQgaDJtOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuICB3aGlsZSAoKGgybSA9IGgyUmUuZXhlYyhodG1sKSkgIT09IG51bGwpIHtcbiAgICBjb25zdCBjbHMgPSBoMm1bMV07XG4gICAgY29uc3QgdGV4dCA9IGNsZWFuVGV4dChoMm1bMl0pLnRvVXBwZXJDYXNlKCk7XG4gICAgbGV0IHNlYzogTWVldGluZ1NlY3Rpb24gfCBudWxsID0gbnVsbDtcbiAgICAvLyBQcmltYXJ5OiBDU1MgY29sb3VyIGNsYXNzIFx1MjAxNCB3b3JrcyBpbiBhbnkgbGFuZ3VhZ2VcbiAgICBpZiAoY2xzLmluY2x1ZGVzKFwidGVhbC03MDBcIikpIHNlYyA9IFwidHJlYXN1cmVzXCI7XG4gICAgZWxzZSBpZiAoY2xzLmluY2x1ZGVzKFwiZ29sZC03MDBcIikpIHNlYyA9IFwibWluaXN0cnlcIjtcbiAgICBlbHNlIGlmIChjbHMuaW5jbHVkZXMoXCJtYXJvb24tNjAwXCIpKSBzZWMgPSBcImxpdmluZ1wiO1xuICAgIC8vIEZhbGxiYWNrOiBFbmdsaXNoIHNlY3Rpb24gdGV4dFxuICAgIGVsc2UgaWYgKHRleHQuaW5jbHVkZXMoXCJUUkVBU1VSRVNcIikpIHNlYyA9IFwidHJlYXN1cmVzXCI7XG4gICAgZWxzZSBpZiAodGV4dC5pbmNsdWRlcyhcIkFQUExZIFlPVVJTRUxGXCIpIHx8IHRleHQuaW5jbHVkZXMoXCJGSUVMRCBNSU5JU1RSWVwiKSkgc2VjID0gXCJtaW5pc3RyeVwiO1xuICAgIGVsc2UgaWYgKHRleHQuaW5jbHVkZXMoXCJMSVZJTkcgQVMgQ0hSSVNUSUFOU1wiKSkgc2VjID0gXCJsaXZpbmdcIjtcbiAgICBpZiAoc2VjKSBib3VuZGFyaWVzLnB1c2goeyBwb3M6IGgybS5pbmRleCwgc2VjdGlvbjogc2VjLCBsYWJlbDogY2xlYW5UZXh0KGgybVsyXSkgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBzZWN0aW9uRm9yUG9zKHBvczogbnVtYmVyKTogTWVldGluZ1NlY3Rpb24ge1xuICAgIGxldCBzZWM6IE1lZXRpbmdTZWN0aW9uID0gXCJvcGVuaW5nXCI7XG4gICAgZm9yIChjb25zdCBiIG9mIGJvdW5kYXJpZXMpIHtcbiAgICAgIGlmIChwb3MgPj0gYi5wb3MpIHNlYyA9IGIuc2VjdGlvbjtcbiAgICB9XG4gICAgcmV0dXJuIHNlYztcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMCBQYXJzZSBoMyBlbGVtZW50cyBpbnRvIHByb2dyYW1tZSBwYXJ0cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgY29uc3QgcGFydHM6IE1lZXRpbmdQYXJ0W10gPSBbXTtcbiAgbGV0IG9yZGVyID0gMDtcblxuICAvLyBDYXB0dXJlczogWzFdIGgzIGF0dHJzLCBbMl0gaDMgaW5uZXIgSFRNTCwgWzNdIHNpYmxpbmcgYm9keSBIVE1MIHVudGlsIG5leHQgaDMvaDJcbiAgY29uc3QgaDNSZSA9IC88aDMoW14+XSopPihbXFxzXFxTXSo/KTxcXC9oMz4oW1xcc1xcU10qPykoPz08aDN8PGgyfDxcXC9hcnRpY2xlfCQpL2dpO1xuICBsZXQgaDNtOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuICB3aGlsZSAoKGgzbSA9IGgzUmUuZXhlYyhodG1sKSkgIT09IG51bGwpIHtcbiAgICBjb25zdCBoM0F0dHJzICAgPSBoM21bMV07XG4gICAgY29uc3QgdGl0bGVIdG1sID0gaDNtWzJdO1xuICAgIGNvbnN0IGJvZHlIdG1sICA9IGgzbVszXSA/PyBcIlwiO1xuICAgIGNvbnN0IHRpdGxlICAgICA9IGNsZWFuVGV4dCh0aXRsZUh0bWwpO1xuICAgIGNvbnN0IGJvZHlUZXh0ICA9IGNsZWFuVGV4dChib2R5SHRtbCk7XG4gICAgY29uc3QgcG9zICAgICAgID0gaDNtLmluZGV4O1xuXG4gICAgY29uc3QgaXNTb25nID0gaDNBdHRycy5pbmNsdWRlcyhcImRjLWljb24tLW11c2ljXCIpO1xuXG4gICAgaWYgKGlzU29uZykge1xuICAgICAgY29uc3QgZHVySW5UaXRsZSA9IHBhcnNlRHVyYXRpb24odGl0bGUpO1xuXG4gICAgICBpZiAoZHVySW5UaXRsZSA9PT0gbnVsbCkge1xuICAgICAgICAvLyBNaWQtbWVldGluZyBzb25nIHNlcGFyYXRvcjogY291bnRlZCBmb3Igc2NoZWR1bGUgdGltaW5nIGJ1dCBubyBzdG9wd2F0Y2ggc2hvd25cbiAgICAgICAgcGFydHMucHVzaCh7XG4gICAgICAgICAgbGFiZWw6IHRpdGxlLFxuICAgICAgICAgIHNlY3Rpb246IHNlY3Rpb25Gb3JQb3MocG9zKSxcbiAgICAgICAgICBkdXJhdGlvblNlYzogNSAqIDYwLFxuICAgICAgICAgIG9yZGVyOiBvcmRlcisrLFxuICAgICAgICAgIGlzU2VwYXJhdG9yOiB0cnVlLFxuICAgICAgICB9KTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIE9wZW5pbmcgc29uZyBoMzogXCJTb25nIDg2IGFuZCBQcmF5ZXIgfCBPcGVuaW5nIENvbW1lbnRzICgxIG1pbi4pXCJcbiAgICAgIC8vIE9ubHkgc3VyZmFjZSB0aGUgcHJvZ3JhbW1lIGxhYmVsICh0aGUgcGlwZSBzZWdtZW50IHRoYXQgaGFzIHRoZSBkdXJhdGlvbilcbiAgICAgIGNvbnN0IGxhYmVsID0gbGFiZWxGcm9tUGlwZVNlZ21lbnQodGl0bGUpO1xuICAgICAgaWYgKCFsYWJlbCkgY29udGludWU7XG4gICAgICBwYXJ0cy5wdXNoKHsgbGFiZWwsIHNlY3Rpb246IHNlY3Rpb25Gb3JQb3MocG9zKSwgZHVyYXRpb25TZWM6IGR1ckluVGl0bGUsIG9yZGVyOiBvcmRlcisrIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gUmVndWxhciBwcm9ncmFtbWUgcGFydCBcdTIwMTQgZHVyYXRpb24gbWF5IGJlIGluIHRoZSBoMyB0aXRsZSAoY2xvc2luZyByb3cpIG9yIGluIGJvZHlcbiAgICBjb25zdCBkdXJJblRpdGxlID0gcGFyc2VEdXJhdGlvbih0aXRsZSk7XG4gICAgY29uc3QgZHVySW5Cb2R5ICA9IHBhcnNlRHVyYXRpb24oYm9keVRleHQuc2xpY2UoMCwgMjAwKSk7XG4gICAgY29uc3QgZHVyYXRpb25TZWMgPSBkdXJJblRpdGxlID8/IGR1ckluQm9keTtcbiAgICBpZiAoZHVyYXRpb25TZWMgPT09IG51bGwpIGNvbnRpbnVlO1xuXG4gICAgLy8gQ2xvc2luZyBoMzogXCJDb25jbHVkaW5nIENvbW1lbnRzICgzIG1pbi4pIHwgU29uZyBOIGFuZCBQcmF5ZXJcIlxuICAgIGlmICh0aXRsZS5pbmNsdWRlcyhcInxcIikpIHtcbiAgICAgIGNvbnN0IGxhYmVsID0gbGFiZWxGcm9tUGlwZVNlZ21lbnQodGl0bGUpO1xuICAgICAgaWYgKCFsYWJlbCkgY29udGludWU7XG4gICAgICBwYXJ0cy5wdXNoKHsgbGFiZWwsIHNlY3Rpb246IFwiY2xvc2luZ1wiLCBkdXJhdGlvblNlYywgb3JkZXI6IG9yZGVyKysgfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBOb3JtYWwgbnVtYmVyZWQgcGFydCBcdTIwMTQgc3RyaXAgZHVyYXRpb24gYW5ub3RhdGlvbiBmcm9tIGxhYmVsXG4gICAgY29uc3QgY2xlYW5MYWJlbCA9IHRpdGxlLnJlcGxhY2UoRFVSQVRJT05fUkUsIFwiXCIpLnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnRyaW0oKTtcbiAgICBwYXJ0cy5wdXNoKHsgbGFiZWw6IGNsZWFuTGFiZWwsIHNlY3Rpb246IHNlY3Rpb25Gb3JQb3MocG9zKSwgZHVyYXRpb25TZWMsIG9yZGVyOiBvcmRlcisrIH0pO1xuICB9XG5cbiAgaWYgKHBhcnRzLmxlbmd0aCA8IDUpIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IHNlY3Rpb25MYWJlbHM6IFBhcnRpYWw8UmVjb3JkPE1lZXRpbmdTZWN0aW9uLCBzdHJpbmc+PiA9IHt9O1xuICBmb3IgKGNvbnN0IGIgb2YgYm91bmRhcmllcykge1xuICAgIHNlY3Rpb25MYWJlbHNbYi5zZWN0aW9uXSA9IGIubGFiZWw7XG4gIH1cblxuICByZXR1cm4geyB3ZWVrTGFiZWwsIHllYXIsIHdlZWtOdW1iZXI6IHdlZWssIHBhcnRzLCBmZXRjaGVkQXQ6IERhdGUubm93KCksIHNlY3Rpb25MYWJlbHMgfTtcbn1cblxuLyoqXG4gKiBGb3IgcGlwZS1zZXBhcmF0ZWQgaDMgdGl0bGVzIChvcGVuaW5nIG9yIGNsb3Npbmcgcm93cyksIHJldHVybnMgdGhlIHNlZ21lbnRcbiAqIHRoYXQgY29udGFpbnMgdGhlIGR1cmF0aW9uIGFubm90YXRpb24sIHdpdGggdGhhdCBhbm5vdGF0aW9uIHN0cmlwcGVkLlxuICpcbiAqIFwiU29uZyA4NiBhbmQgUHJheWVyIHwgT3BlbmluZyBDb21tZW50cyAoMSBtaW4uKVwiICBcdTIxOTIgXCJPcGVuaW5nIENvbW1lbnRzXCJcbiAqIFwiQ2FuY2lcdTAwRjNuIDg2IHkgb3JhY2lcdTAwRjNuIHwgUGFsYWJyYXMgZGUgaW50cm9kdWNjaVx1MDBGM24gKDEgbWluLilcIiBcdTIxOTIgXCJQYWxhYnJhcyBkZSBpbnRyb2R1Y2NpXHUwMEYzblwiXG4gKiBcIkNvbmNsdWRpbmcgQ29tbWVudHMgKDMgbWluLikgfCBTb25nIDcwIGFuZCBQcmF5ZXJcIiBcdTIxOTIgXCJDb25jbHVkaW5nIENvbW1lbnRzXCJcbiAqL1xuZnVuY3Rpb24gbGFiZWxGcm9tUGlwZVNlZ21lbnQodGl0bGU6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBzZWdtZW50cyA9IHRpdGxlLnNwbGl0KFwifFwiKS5tYXAocyA9PiBzLnRyaW0oKSk7XG4gIGNvbnN0IHdpdGhEdXIgPSBzZWdtZW50cy5maW5kKHMgPT4gRFVSQVRJT05fUkUudGVzdChzKSk7XG4gIGlmICghd2l0aER1cikgcmV0dXJuIG51bGw7XG4gIHJldHVybiB3aXRoRHVyLnJlcGxhY2UoRFVSQVRJT05fUkUsIFwiXCIpLnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnRyaW0oKSB8fCBudWxsO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFBQUEsbUJBQXVCOzs7QUNvRWhCLElBQU0sbUJBQW1DO0FBQUEsRUFDOUMsV0FBVztBQUFBLEVBQ1gsa0JBQWtCO0FBQUEs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
