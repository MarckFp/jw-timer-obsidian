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
      const knownValues2 = Object.values(WOL_LOCALES);
      if (knownValues2.includes(this.plugin.settings.wolLocale)) {
        drop.setValue(this.plugin.settings.wolLocale);
      }
      drop.onChange(async (value) => {
        this.plugin.settings.wolLocale = value;
        await this.plugin.saveSettings();
        if (customLocaleText) customLocaleText.setValue("");
      });
    });
    let customLocaleText;
    const knownValues = Object.values(WOL_LOCALES);
    const currentIsCustom = !knownValues.includes(this.plugin.settings.wolLocale);
    new import_obsidian.Setting(containerEl).setName("Custom locale (advanced)").setDesc(
      'Override with any WOL locale path, e.g. "r4/lp-s". Leave blank to use the dropdown selection.'
    ).addText((text) => {
      customLocaleText = text;
      text.setPlaceholder("r1/lp-e").setValue(currentIsCustom ? this.plugin.settings.wolLocale : "").onChange(async (value) => {
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
var LOCALE_OPENING_CLOSING = {
  "lp-e": ["Opening", "Closing"],
  "lp-s": ["Apertura", "Conclusi\xF3n"],
  "lp-f": ["Ouverture", "Conclusion"],
  "lp-t": ["Abertura", "Conclus\xE3o"],
  "lp-g": ["Er\xF6ffnung", "Abschluss"],
  "lp-i": ["Apertura", "Conclusione"],
  "lp-u": ["\u041D\u0430\u0447\u0430\u043B\u043E", "\u0417\u0430\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435"],
  "lp-d": ["Opening", "Sluiting"],
  "lp-p": ["Otwarcie", "Zako\u0144czenie"],
  "lp-chs": ["\u5F00\u573A", "\u7ED3\u675F"]
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
    prevBtn.setAttr("aria-label", "Previous week");
    this.navLabelEl = navEl.createDiv({ cls: "jw-timer-nav-label" });
    const nextBtn = navEl.createEl("button", { cls: "jw-timer-nav-btn", text: "\u25B6" });
    nextBtn.setAttr("aria-label", "Next week");
    this.todayBtn = navEl.createEl("button", { cls: "jw-timer-nav-today", text: "Today" });
    this.todayBtn.setAttr("aria-label", "Jump to current week");
    this.todayBtn.style.display = "none";
    prevBtn.addEventListener("click", () => void this.navigateWeek(-1));
    nextBtn.addEventListener("click", () => void this.navigateWeek(1));
    this.todayBtn.addEventListener("click", () => void this.navigateToToday());
    const toolbar = root.createDiv({ cls: "jw-timer-toolbar" });
    const resetAllBtn = toolbar.createEl("button", {
      cls: "jw-timer-btn jw-timer-btn-reset-all",
      text: "Reset All"
    });
    resetAllBtn.addEventListener("click", () => this.handleResetAll());
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
  // ─── Today helpers ──────────────────────────────────────────────────────────
  isCurrentWeek() {
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const week = currentWeekNumber();
    return this.viewYear === year && this.viewWeek === week;
  }
  updateTodayVisibility() {
    this.todayBtn.style.display = this.isCurrentWeek() ? "none" : "";
  }
  async navigateToToday() {
    this.viewYear = (/* @__PURE__ */ new Date()).getFullYear();
    this.viewWeek = currentWeekNumber();
    this.schedule = null;
    this.cards.clear();
    this.listEl.empty();
    await this.loadScheduleForWeek(this.viewYear, this.viewWeek);
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
    this.updateTodayVisibility();
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
    const langKey = this.plugin.settings.wolLocale.split("/")[1] ?? "lp-e";
    const [openingLabel, closingLabel] = LOCALE_OPENING_CLOSING[langKey] ?? ["Opening", "Closing"];
    const sectionLabels = {
      ...SECTION_FALLBACK,
      ...schedule.sectionLabels ?? {},
      opening: openingLabel,
      closing: closingLabel
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
    const playBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-play", text: "Play" });
    playBtn.setAttr("aria-label", "Start timer");
    const resetBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-reset", text: "Reset" });
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
      refs.playBtn.setText("Pause");
      refs.playBtn.setAttr("aria-label", "Pause timer");
    } else {
      refs.playBtn.setText("Play");
      refs.playBtn.setAttr("aria-label", status === "paused" ? "Resume timer" : "Start timer");
    }
  }
  // ─── Reset All ────────────────────────────────────────────────────────────
  handleResetAll() {
    if (!this.schedule) return;
    for (const part of this.schedule.parts) {
      this.plugin.timerEngine.reset(this.weekKey, part.order);
    }
    this.renderSchedule(this.schedule);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3R5cGVzLnRzIiwgInNyYy90aW1lci1lbmdpbmUudHMiLCAic3JjL3NldHRpbmdzLXRhYi50cyIsICJzcmMvdmlldy50cyIsICJzcmMvc2NyYXBlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBERUZBVUxUX1NFVFRJTkdTIH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB0eXBlIHsgUGx1Z2luU2V0dGluZ3MsIFBsdWdpbkRhdGEsIFdlZWtseVNjaGVkdWxlLCBUaW1lclN0YXRlIH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB7IFRpbWVyRW5naW5lIH0gZnJvbSBcIi4vdGltZXItZW5naW5lXCI7XG5pbXBvcnQgeyBKd1RpbWVyU2V0dGluZ3NUYWIgfSBmcm9tIFwiLi9zZXR0aW5ncy10YWJcIjtcbmltcG9ydCB7IEp3VGltZXJWaWV3LCBWSUVXX1RZUEVfSldfVElNRVIgfSBmcm9tIFwiLi92aWV3XCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEp3VGltZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5nczogUGx1Z2luU2V0dGluZ3MgPSB7IC4uLkRFRkFVTFRfU0VUVElOR1MgfTtcbiAgdGltZXJFbmdpbmUgPSBuZXcgVGltZXJFbmdpbmUoKTtcbiAgcHJpdmF0ZSBzY2hlZHVsZUNhY2hlOiBSZWNvcmQ8c3RyaW5nLCBXZWVrbHlTY2hlZHVsZT4gPSB7fTtcbiAgcHJpdmF0ZSBzYXZlSGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgTGlmZWN5Y2xlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLmxvYWREYXRhXygpO1xuXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoVklFV19UWVBFX0pXX1RJTUVSLCAobGVhZikgPT4gbmV3IEp3VGltZXJWaWV3KGxlYWYsIHRoaXMpKTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcInRpbWVyXCIsIFwiT3BlbiBKVyBNZWV0aW5nIFRpbWVyXCIsICgpID0+IHZvaWQgdGhpcy5hY3RpdmF0ZVZpZXcoKSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwib3Blbi1qdy10aW1lclwiLFxuICAgICAgbmFtZTogXCJPcGVuIEpXIE1lZXRpbmcgVGltZXIgc2lkZWJhclwiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHZvaWQgdGhpcy5hY3RpdmF0ZVZpZXcoKSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgSndUaW1lclNldHRpbmdzVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB2b2lkIHRoaXMuYWN0aXZhdGVWaWV3KCkpO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuc2F2ZUhhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnNhdmVIYW5kbGUpO1xuICAgICAgdGhpcy5zYXZlSGFuZGxlID0gbnVsbDtcbiAgICB9XG4gICAgdm9pZCB0aGlzLnBlcnNpc3RUaW1lcnMoKTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9KV19USU1FUik7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2V0dGluZ3MgcGVyc2lzdGVuY2UgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMucGVyc2lzdERhdGEoKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZERhdGFfKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJhdyA9IGF3YWl0IHRoaXMubG9hZERhdGEoKSBhcyBQYXJ0aWFsPFBsdWdpbkRhdGE+IHwgbnVsbDtcbiAgICBpZiAoIXJhdykgcmV0dXJuO1xuICAgIGlmIChyYXcuc2V0dGluZ3MpIHtcbiAgICAgIHRoaXMuc2V0dGluZ3MgPSB7IC4uLkRFRkFVTFRfU0VUVElOR1MsIC4uLnJhdy5zZXR0aW5ncyB9O1xuICAgIH1cbiAgICBpZiAocmF3LnNjaGVkdWxlQ2FjaGUpIHtcbiAgICAgIHRoaXMuc2NoZWR1bGVDYWNoZSA9IHJhdy5zY2hlZHVsZUNhY2hlO1xuICAgIH1cbiAgICBpZiAocmF3LnRpbWVyU3RhdGVzKSB7XG4gICAgICB0aGlzLnRpbWVyRW5naW5lLnJlc3RvcmUocmF3LnRpbWVyU3RhdGVzKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHBlcnNpc3REYXRhKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHRpbWVyU3RhdGVzOiBSZWNvcmQ8c3RyaW5nLCBUaW1lclN0YXRlPiA9IHt9O1xuICAgIGZvciAoY29uc3QgW2ssIHZdIG9mIHRoaXMudGltZXJFbmdpbmUuc25hcHNob3RBbGwoKSkge1xuICAgICAgdGltZXJTdGF0ZXNba10gPSB2O1xuICAgIH1cbiAgICBjb25zdCBkYXRhOiBQbHVnaW5EYXRhID0ge1xuICAgICAgc2V0dGluZ3M6IHRoaXMuc2V0dGluZ3MsXG4gICAgICBzY2hlZHVsZUNhY2hlOiB0aGlzLnNjaGVkdWxlQ2FjaGUsXG4gICAgICB0aW1lclN0YXRlcyxcbiAgICB9O1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEoZGF0YSk7XG4gIH1cblxuICBwcml2YXRlIHNjaGVkdWxlU2F2ZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zYXZlSGFuZGxlICE9PSBudWxsKSB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuc2F2ZUhhbmRsZSk7XG4gICAgdGhpcy5zYXZlSGFuZGxlID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5zYXZlSGFuZGxlID0gbnVsbDtcbiAgICAgIHZvaWQgdGhpcy5wZXJzaXN0RGF0YSgpO1xuICAgIH0sIDUwMCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGltZXIgcGVyc2lzdGVuY2UgaGVscGVycyAoY2FsbGVkIGZyb20gdmlldykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgYXN5bmMgcGVyc2lzdFRpbWVycygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnBlcnNpc3REYXRhKCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2NoZWR1bGUgY2FjaGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgZ2V0Q2FjaGVkU2NoZWR1bGUoa2V5OiBzdHJpbmcpOiBXZWVrbHlTY2hlZHVsZSB8IG51bGwge1xuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuc2NoZWR1bGVDYWNoZVtrZXldO1xuICAgIGlmICghY2FjaGVkKSByZXR1cm4gbnVsbDtcbiAgICAvLyBDYWNoZSBpcyB2YWxpZCBmb3IgMTIgaG91cnNcbiAgICBjb25zdCBzdGFsZSA9IERhdGUubm93KCkgLSBjYWNoZWQuZmV0Y2hlZEF0ID4gMTIgKiA2MCAqIDYwICogMTAwMDtcbiAgICByZXR1cm4gc3RhbGUgPyBudWxsIDogY2FjaGVkO1xuICB9XG5cbiAgY2FjaGVTY2hlZHVsZShrZXk6IHN0cmluZywgc2NoZWR1bGU6IFdlZWtseVNjaGVkdWxlKTogdm9pZCB7XG4gICAgdGhpcy5zY2hlZHVsZUNhY2hlW2tleV0gPSBzY2hlZHVsZTtcbiAgICB0aGlzLnNjaGVkdWxlU2F2ZSgpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNldHRpbmdzIGNoYW5nZSBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGFzeW5jIGNsZWFyQ2FjaGVBbmRSZWZyZXNoKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2NoZWR1bGVDYWNoZSA9IHt9O1xuICAgIGF3YWl0IHRoaXMucGVyc2lzdERhdGEoKTtcbiAgICAvLyBSZWxvYWQgdGhlIG9wZW4gdmlldyBpZiBwcmVzZW50XG4gICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX0pXX1RJTUVSKVswXTtcbiAgICBpZiAobGVhZj8udmlldyBpbnN0YW5jZW9mIEp3VGltZXJWaWV3KSB7XG4gICAgICBhd2FpdCAobGVhZi52aWV3IGFzIEp3VGltZXJWaWV3KS5yZWxvYWQoKTtcbiAgICB9XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgVmlldyBhY3RpdmF0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgYXN5bmMgYWN0aXZhdGVWaWV3KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfSldfVElNRVIpO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGgpIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGV4aXN0aW5nWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRSaWdodExlYWYoZmFsc2UpO1xuICAgIGlmICghbGVhZikgcmV0dXJuO1xuICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHsgdHlwZTogVklFV19UWVBFX0pXX1RJTUVSLCBhY3RpdmU6IHRydWUgfSk7XG4gICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XG4gIH1cbn1cbiIsICIvLyBcdTI1MDBcdTI1MDBcdTI1MDAgRG9tYWluIHR5cGVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgaW50ZXJmYWNlIE1lZXRpbmdQYXJ0IHtcbiAgLyoqIERpc3BsYXkgbGFiZWwgKGUuZy4gXCIxLiBIb3cgTXVjaCBBcmUgWW91IFdpbGxpbmcgdG8gUGF5P1wiKSAqL1xuICBsYWJlbDogc3RyaW5nO1xuICAvKiogU2VjdGlvbiB0aGlzIHBhcnQgYmVsb25ncyB0byAqL1xuICBzZWN0aW9uOiBNZWV0aW5nU2VjdGlvbjtcbiAgLyoqIEFsbG93ZWQgZHVyYXRpb24gaW4gc2Vjb25kcyAqL1xuICBkdXJhdGlvblNlYzogbnVtYmVyO1xuICAvKiogT3JkZXIgd2l0aGluIHRoZSBmdWxsIG1lZXRpbmcgcHJvZ3JhbW1lICovXG4gIG9yZGVyOiBudW1iZXI7XG4gIC8qKiBJZiB0cnVlLCB0aGlzIHBhcnQgaGFzIG5vIHN0b3B3YXRjaCBcdTIwMTQgaXRzIGR1cmF0aW9uIGlzIG9ubHkgdXNlZCBmb3Igc2NoZWR1bGUgdGltaW5nIChlLmcuIHNvbmcpICovXG4gIGlzU2VwYXJhdG9yPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IHR5cGUgTWVldGluZ1NlY3Rpb24gPVxuICB8IFwib3BlbmluZ1wiXG4gIHwgXCJ0cmVhc3VyZXNcIlxuICB8IFwibWluaXN0cnlcIlxuICB8IFwibGl2aW5nXCJcbiAgfCBcImNsb3NpbmdcIjtcblxuZXhwb3J0IGludGVyZmFjZSBXZWVrbHlTY2hlZHVsZSB7XG4gIC8qKiBJU08gd2VlayBsYWJlbCwgZS5nLiBcIkFwcmlsIDIwLTI2XCIgKi9cbiAgd2Vla0xhYmVsOiBzdHJpbmc7XG4gIC8qKiBZZWFyICovXG4gIHllYXI6IG51bWJlcjtcbiAgLyoqIElTTyB3ZWVrIG51bWJlciAoMS01MykgKi9cbiAgd2Vla051bWJlcjogbnVtYmVyO1xuICBwYXJ0czogTWVldGluZ1BhcnRbXTtcbiAgLyoqIFdoZW4gdGhpcyBkYXRhIHdhcyBmZXRjaGVkIChtcyBzaW5jZSBlcG9jaCkgKi9cbiAgZmV0Y2hlZEF0OiBudW1iZXI7XG4gIC8qKiBTY3JhcGVkIGgyIHNlY3Rpb24gaGVhZGluZ3MgaW4gdGhlIHBhZ2UgbGFuZ3VhZ2UgKG9wdGlvbmFsIFx1MjAxNCBhYnNlbnQgaW4gb2xkIGNhY2hlIGVudHJpZXMpICovXG4gIHNlY3Rpb25MYWJlbHM/OiBQYXJ0aWFsPFJlY29yZDxNZWV0aW5nU2VjdGlvbiwgc3RyaW5nPj47XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBUaW1lciBzdGF0ZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGludGVyZmFjZSBUaW1lclN0YXRlIHtcbiAgcGFydE9yZGVyOiBudW1iZXI7XG4gIC8qKiBBY2N1bXVsYXRlZCBlbGFwc2VkIG1zICh3aGVuIHBhdXNlZCkgKi9cbiAgZWxhcHNlZE1zOiBudW1iZXI7XG4gIHJ1bm5pbmc6IGJvb2xlYW47XG4gIC8qKiBEYXRlLm5vdygpIHdoZW4gdGhlIGxhc3Qgc3RhcnQgaGFwcGVuZWQgKi9cbiAgc3RhcnRlZEF0OiBudW1iZXIgfCBudWxsO1xuICAvKiogRGF0ZS5ub3coKSB3aGVuIHRoZSB0aW1lciB3YXMgbGFzdCBwYXVzZWQgKG51bGwgaWYgbmV2ZXIgcGF1c2VkIG9yIGN1cnJlbnRseSBydW5uaW5nKSAqL1xuICBzdG9wcGVkQXQ/OiBudW1iZXIgfCBudWxsO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgUGVyc2lzdGVkIHBsdWdpbiBkYXRhIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgaW50ZXJmYWNlIFBsdWdpbkRhdGEge1xuICBzZXR0aW5nczogUGx1Z2luU2V0dGluZ3M7XG4gIC8qKiBDYWNoZWQgc2NoZWR1bGUsIGtleWVkIGJ5IFwiWVlZWS1XV1wiICovXG4gIHNjaGVkdWxlQ2FjaGU6IFJlY29yZDxzdHJpbmcsIFdlZWtseVNjaGVkdWxlPjtcbiAgLyoqIFRpbWVyIHN0YXRlcywga2V5ZWQgYnkgXCJZWVlZLVdXOnBhcnRPcmRlclwiICovXG4gIHRpbWVyU3RhdGVzOiBSZWNvcmQ8c3RyaW5nLCBUaW1lclN0YXRlPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQbHVnaW5TZXR0aW5ncyB7XG4gIC8qKiBXT0wgbGFuZ3VhZ2UgbG9jYWxlLCBlLmcuIFwicjEvbHAtZVwiIChFbmdsaXNoKSBvciBcInI0L2xwLXNcIiAoU3BhbmlzaCkgKi9cbiAgd29sTG9jYWxlOiBzdHJpbmc7XG4gIC8qKiBNZWV0aW5nIHN0YXJ0IHRpbWUsIEhIOk1NIDI0aCBmb3JtYXQsIGUuZy4gXCIyMDowMFwiICovXG4gIG1lZXRpbmdTdGFydFRpbWU6IHN0cmluZztcbiAgLyoqIE1pbnV0ZXMgZm9yIG9wZW5pbmcgc29uZyArIHByYXllciBiZWZvcmUgZmlyc3QgcHJvZ3JhbW1lIHBhcnQgKi9cbiAgb3BlbmluZ1NvbmdNaW51dGVzOiBudW1iZXI7XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBQbHVnaW5TZXR0aW5ncyA9IHtcbiAgd29sTG9jYWxlOiBcInIxL2xwLWVcIixcbiAgbWVldGluZ1N0YXJ0VGltZTogXCIyMDowMFwiLFxuICBvcGVuaW5nU29uZ01pbnV0ZXM6IDUsXG59O1xuIiwgImltcG9ydCB0eXBlIHsgVGltZXJTdGF0ZSB9IGZyb20gXCIuL3R5cGVzXCI7XG5cbmV4cG9ydCB0eXBlIFRpbWVyU3RhdHVzID0gXCJpZGxlXCIgfCBcInJ1bm5pbmdcIiB8IFwicGF1c2VkXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGltZXJTbmFwc2hvdCB7XG4gIGVsYXBzZWRNczogbnVtYmVyO1xuICBzdGF0dXM6IFRpbWVyU3RhdHVzO1xuICAvKiogV2FsbC1jbG9jayBtcyAoRGF0ZS5ub3coKSkgd2hlbiB0aGUgdGltZXIgd2FzIGxhc3QgcGF1c2VkLiBudWxsIHdoZW4gaWRsZSBvciBydW5uaW5nLiAqL1xuICBzdG9wcGVkQXQ6IG51bWJlciB8IG51bGw7XG59XG5cbmV4cG9ydCBjbGFzcyBUaW1lckVuZ2luZSB7XG4gIHByaXZhdGUgc3RhdGVzID0gbmV3IE1hcDxzdHJpbmcsIFRpbWVyU3RhdGU+KCk7XG5cbiAgcHJpdmF0ZSBrZXkod2Vla0tleTogc3RyaW5nLCBwYXJ0T3JkZXI6IG51bWJlcik6IHN0cmluZyB7XG4gICAgcmV0dXJuIGAke3dlZWtLZXl9OiR7cGFydE9yZGVyfWA7XG4gIH1cblxuICBnZXQod2Vla0tleTogc3RyaW5nLCBwYXJ0T3JkZXI6IG51bWJlcik6IFRpbWVyU25hcHNob3Qge1xuICAgIGNvbnN0IHN0YXRlID0gdGhpcy5zdGF0ZXMuZ2V0KHRoaXMua2V5KHdlZWtLZXksIHBhcnRPcmRlcikpO1xuICAgIGlmICghc3RhdGUpIHJldHVybiB7IGVsYXBzZWRNczogMCwgc3RhdHVzOiBcImlkbGVcIiwgc3RvcHBlZEF0OiBudWxsIH07XG4gICAgY29uc3QgZWxhcHNlZCA9IHN0YXRlLnJ1bm5pbmcgJiYgc3RhdGUuc3RhcnRlZEF0ICE9PSBudWxsXG4gICAgICA/IHN0YXRlLmVsYXBzZWRNcyArIChEYXRlLm5vdygpIC0gc3RhdGUuc3RhcnRlZEF0KVxuICAgICAgOiBzdGF0ZS5lbGFwc2VkTXM7XG4gICAgY29uc3Qgc3RhdHVzOiBUaW1lclN0YXR1cyA9IHN0YXRlLnJ1bm5pbmcgPyBcInJ1bm5pbmdcIiA6IHN0YXRlLmVsYXBzZWRNcyA+IDAgPyBcInBhdXNlZFwiIDogXCJpZGxlXCI7XG4gICAgcmV0dXJuIHsgZWxhcHNlZE1zOiBlbGFwc2VkLCBzdGF0dXMsIHN0b3BwZWRBdDogc3RhdGUuc3RvcHBlZEF0ID8/IG51bGwgfTtcbiAgfVxuXG4gIHN0YXJ0KHdlZWtLZXk6IHN0cmluZywgcGFydE9yZGVyOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBrID0gdGhpcy5rZXkod2Vla0tleSwgcGFydE9yZGVyKTtcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuc3RhdGVzLmdldChrKTtcbiAgICBpZiAoZXhpc3Rpbmc/LnJ1bm5pbmcpIHJldHVybjtcbiAgICB0aGlzLnN0YXRlcy5zZXQoaywge1xuICAgICAgcGFydE9yZGVyLFxuICAgICAgZWxhcHNlZE1zOiBleGlzdGluZz8uZWxhcHNlZE1zID8/IDAsXG4gICAgICBydW5uaW5nOiB0cnVlLFxuICAgICAgc3RhcnRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH0pO1xuICB9XG5cbiAgcGF1c2Uod2Vla0tleTogc3RyaW5nLCBwYXJ0T3JkZXI6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IGsgPSB0aGlzLmtleSh3ZWVrS2V5LCBwYXJ0T3JkZXIpO1xuICAgIGNvbnN0IHN0YXRlID0gdGhpcy5zdGF0ZXMuZ2V0KGspO1xuICAgIGlmICghc3RhdGU/LnJ1bm5pbmcpIHJldHVybjtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMuc3RhdGVzLnNldChrLCB7XG4gICAgICAuLi5zdGF0ZSxcbiAgICAgIGVsYXBzZWRNczogc3RhdGUuZWxhcHNlZE1zICsgKG5vdyAtIChzdGF0ZS5zdGFydGVkQXQgPz8gbm93KSksXG4gICAgICBydW5uaW5nOiBmYWxzZSxcbiAgICAgIHN0YXJ0ZWRBdDogbnVsbCxcbiAgICAgIHN0b3BwZWRBdDogbm93LFxuICAgIH0pO1xuICB9XG5cbiAgcmVzZXQod2Vla0tleTogc3RyaW5nLCBwYXJ0T3JkZXI6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuc3RhdGVzLmRlbGV0ZSh0aGlzLmtleSh3ZWVrS2V5LCBwYXJ0T3JkZXIpKTtcbiAgfVxuXG4gIC8qKiBTbmFwc2hvdCBhbGwgc3RhdGVzIGZvciBwZXJzaXN0ZW5jZSwgZnJlZXppbmcgcnVubmluZyB0aW1lcnMuICovXG4gIHNuYXBzaG90QWxsKCk6IE1hcDxzdHJpbmcsIFRpbWVyU3RhdGU+IHtcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgTWFwPHN0cmluZywgVGltZXJTdGF0ZT4oKTtcbiAgICBmb3IgKGNvbnN0IFtrLCBzdGF0ZV0gb2YgdGhpcy5zdGF0ZXMpIHtcbiAgICAgIGlmIChzdGF0ZS5ydW5uaW5nICYmIHN0YXRlLnN0YXJ0ZWRBdCAhPT0gbnVsbCkge1xuICAgICAgICByZXN1bHQuc2V0KGssIHtcbiAgICAgICAgICAuLi5zdGF0ZSxcbiAgICAgICAgICBlbGFwc2VkTXM6IHN0YXRlLmVsYXBzZWRNcyArIChEYXRlLm5vdygpIC0gc3RhdGUuc3RhcnRlZEF0KSxcbiAgICAgICAgICBydW5uaW5nOiBmYWxzZSxcbiAgICAgICAgICBzdGFydGVkQXQ6IG51bGwsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0LnNldChrLCB7IC4uLnN0YXRlIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqIFJlc3RvcmUgc3RhdGVzIGZyb20gcGVyc2lzdGVkIGRhdGEgKGFsbCBwYXVzZWQpLiAqL1xuICByZXN0b3JlKHNhdmVkOiBSZWNvcmQ8c3RyaW5nLCBUaW1lclN0YXRlPik6IHZvaWQge1xuICAgIHRoaXMuc3RhdGVzLmNsZWFyKCk7XG4gICAgZm9yIChjb25zdCBbaywgc3RhdGVdIG9mIE9iamVjdC5lbnRyaWVzKHNhdmVkKSkge1xuICAgICAgdGhpcy5zdGF0ZXMuc2V0KGssIHsgLi4uc3RhdGUsIHJ1bm5pbmc6IGZhbHNlLCBzdGFydGVkQXQ6IG51bGwgfSk7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSBKd1RpbWVyUGx1Z2luIGZyb20gXCIuL21haW5cIjtcbmltcG9ydCB0eXBlIHsgUGx1Z2luU2V0dGluZ3MgfSBmcm9tIFwiLi90eXBlc1wiO1xuXG4vLyBBdmFpbGFibGUgV09MIGxvY2FsZXM6IGxhYmVsIFx1MjE5MiBsb2NhbGUgcGF0aCBzZWdtZW50XG5jb25zdCBXT0xfTE9DQUxFUzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgXCJFbmdsaXNoXCI6ICAgIFwicjEvbHAtZVwiLFxuICBcIlNwYW5pc2hcIjogICAgXCJyNC9scC1zXCIsXG4gIFwiUG9ydHVndWVzZVwiOiBcInI1L2xwLXRcIixcbiAgXCJGcmVuY2hcIjogICAgIFwicjMwL2xwLWZcIixcbiAgXCJJdGFsaWFuXCI6ICAgIFwicjYvbHAtaVwiLFxuICBcIkdlcm1hblwiOiAgICAgXCJyMTAvbHAtZ1wiLFxuICBcIkR1dGNoXCI6ICAgICAgXCJyMTMvbHAtZFwiLFxuICBcIkphcGFuZXNlXCI6ICAgXCJyNy9scC1qXCIsXG4gIFwiS29yZWFuXCI6ICAgICBcInI4L2xwLWtvXCIsXG4gIFwiQ2hpbmVzZSAoU2ltcGxpZmllZClcIjogXCJyMjMvbHAtY2hzXCIsXG59O1xuXG5leHBvcnQgY2xhc3MgSndUaW1lclNldHRpbmdzVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHJlYWRvbmx5IHBsdWdpbjogSndUaW1lclBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiSlcgTWVldGluZyBUaW1lciBcdTIwMTQgU2V0dGluZ3NcIiB9KTtcblxuICAgIC8vIExhbmd1YWdlIC8gbG9jYWxlXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIk1lZXRpbmcgbGFuZ3VhZ2VcIilcbiAgICAgIC5zZXREZXNjKFwiTGFuZ3VhZ2UgdXNlZCB0byBmZXRjaCB0aGUgd2Vla2x5IHByb2dyYW1tZSBmcm9tIHdvbC5qdy5vcmcuXCIpXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3ApID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBbbGFiZWwsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhXT0xfTE9DQUxFUykpIHtcbiAgICAgICAgICBkcm9wLmFkZE9wdGlvbih2YWx1ZSwgbGFiZWwpO1xuICAgICAgICB9XG4gICAgICAgIC8vIElmIHRoZSBjdXJyZW50IGxvY2FsZSBpcyBhIGtub3duIGRyb3Bkb3duIHZhbHVlLCBzZWxlY3QgaXQ7IG90aGVyd2lzZSBsZWF2ZSBhdCBkZWZhdWx0XG4gICAgICAgIGNvbnN0IGtub3duVmFsdWVzID0gT2JqZWN0LnZhbHVlcyhXT0xfTE9DQUxFUyk7XG4gICAgICAgIGlmIChrbm93blZhbHVlcy5pbmNsdWRlcyh0aGlzLnBsdWdpbi5zZXR0aW5ncy53b2xMb2NhbGUpKSB7XG4gICAgICAgICAgZHJvcC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy53b2xMb2NhbGUpO1xuICAgICAgICB9XG4gICAgICAgIGRyb3Aub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mud29sTG9jYWxlID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgLy8gQ2xlYXIgdGhlIGN1c3RvbS1sb2NhbGUgdGV4dCBmaWVsZCBzbyBpdCBkb2Vzblx1MjAxOXQgbWlzbGVhZFxuICAgICAgICAgIGlmIChjdXN0b21Mb2NhbGVUZXh0KSBjdXN0b21Mb2NhbGVUZXh0LnNldFZhbHVlKFwiXCIpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgLy8gQ3VzdG9tIGxvY2FsZSBvdmVycmlkZVxuICAgIGxldCBjdXN0b21Mb2NhbGVUZXh0OiBpbXBvcnQoXCJvYnNpZGlhblwiKS5UZXh0Q29tcG9uZW50O1xuICAgIGNvbnN0IGtub3duVmFsdWVzID0gT2JqZWN0LnZhbHVlcyhXT0xfTE9DQUxFUyk7XG4gICAgY29uc3QgY3VycmVudElzQ3VzdG9tID0gIWtub3duVmFsdWVzLmluY2x1ZGVzKHRoaXMucGx1Z2luLnNldHRpbmdzLndvbExvY2FsZSk7XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkN1c3RvbSBsb2NhbGUgKGFkdmFuY2VkKVwiKVxuICAgICAgLnNldERlc2MoXG4gICAgICAgICdPdmVycmlkZSB3aXRoIGFueSBXT0wgbG9jYWxlIHBhdGgsIGUuZy4gXCJyNC9scC1zXCIuIExlYXZlIGJsYW5rIHRvIHVzZSB0aGUgZHJvcGRvd24gc2VsZWN0aW9uLidcbiAgICAgIClcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PiB7XG4gICAgICAgIGN1c3RvbUxvY2FsZVRleHQgPSB0ZXh0O1xuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwicjEvbHAtZVwiKVxuICAgICAgICAgIC8vIFNob3cgdGhlIHNhdmVkIGN1c3RvbSB2YWx1ZSBvbmx5IHdoZW4gaXQgaXNuXHUyMDE5dCBvbmUgb2YgdGhlIGRyb3Bkb3duIG9wdGlvbnNcbiAgICAgICAgICAuc2V0VmFsdWUoY3VycmVudElzQ3VzdG9tID8gdGhpcy5wbHVnaW4uc2V0dGluZ3Mud29sTG9jYWxlIDogXCJcIilcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xuICAgICAgICAgICAgaWYgKHRyaW1tZWQpIHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mud29sTG9jYWxlID0gdHJpbW1lZDtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIC8vIE1lZXRpbmcgc3RhcnQgdGltZVxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJNZWV0aW5nIHN0YXJ0IHRpbWVcIilcbiAgICAgIC5zZXREZXNjKCcyNC1ob3VyIGZvcm1hdCwgZS5nLiBcIjIwOjAwXCIgb3IgXCIxODozMFwiLicpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT4ge1xuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiMjA6MDBcIilcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubWVldGluZ1N0YXJ0VGltZSlcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpO1xuICAgICAgICAgICAgaWYgKC9eXFxkezEsMn06XFxkezJ9JC8udGVzdCh0cmltbWVkKSkge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tZWV0aW5nU3RhcnRUaW1lID0gdHJpbW1lZDtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIC8vIE9wZW5pbmcgc29uZyBkdXJhdGlvblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJPcGVuaW5nIHNvbmcgKyBwcmF5ZXIgKG1pbnV0ZXMpXCIpXG4gICAgICAuc2V0RGVzYyhcIkZpeGVkIG1pbnV0ZXMgYmVmb3JlIHRoZSBmaXJzdCBwcm9ncmFtbWUgcGFydCAoc29uZyArIHByYXllcikuIERlZmF1bHQ6IDUuXCIpXG4gICAgICAuYWRkU2xpZGVyKChzbGlkZXIpID0+IHtcbiAgICAgICAgc2xpZGVyXG4gICAgICAgICAgLnNldExpbWl0cygxLCAxNSwgMSlcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmluZ1NvbmdNaW51dGVzKVxuICAgICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmluZ1NvbmdNaW51dGVzID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgLy8gTWFudWFsIHJlZnJlc2ggYnV0dG9uXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlJlZnJlc2ggc2NoZWR1bGVcIilcbiAgICAgIC5zZXREZXNjKFwiQ2xlYXIgdGhlIGNhY2hlZCBzY2hlZHVsZSBhbmQgcmUtZmV0Y2ggZnJvbSB3b2wuancub3JnLlwiKVxuICAgICAgLmFkZEJ1dHRvbigoYnRuKSA9PiB7XG4gICAgICAgIGJ0bi5zZXRCdXR0b25UZXh0KFwiUmVmcmVzaCBub3dcIikub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uY2xlYXJDYWNoZUFuZFJlZnJlc2goKTtcbiAgICAgICAgICBidG4uc2V0QnV0dG9uVGV4dChcIkRvbmUgXHUyNzEzXCIpO1xuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IGJ0bi5zZXRCdXR0b25UZXh0KFwiUmVmcmVzaCBub3dcIiksIDIwMDApO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgSXRlbVZpZXcsIFdvcmtzcGFjZUxlYWYgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIEp3VGltZXJQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuaW1wb3J0IHR5cGUgeyBXZWVrbHlTY2hlZHVsZSwgTWVldGluZ1BhcnQgfSBmcm9tIFwiLi90eXBlc1wiO1xuaW1wb3J0IHR5cGUgeyBUaW1lclNuYXBzaG90IH0gZnJvbSBcIi4vdGltZXItZW5naW5lXCI7XG5pbXBvcnQgeyBjYWNoZUtleSwgY3VycmVudFdlZWtOdW1iZXIsIGZldGNoV2Vla1NjaGVkdWxlIH0gZnJvbSBcIi4vc2NyYXBlclwiO1xuXG5leHBvcnQgY29uc3QgVklFV19UWVBFX0pXX1RJTUVSID0gXCJqdy10aW1lci1zaWRlYmFyXCI7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBDb25zdGFudHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBXQVJOX1RIUkVTSE9MRCA9IDAuOTtcblxuLy8gRmFsbGJhY2sgc2VjdGlvbiBsYWJlbHMgXHUyMDE0IHVzZWQgd2hlbiBzY3JhcGVyIHNlY3Rpb25MYWJlbHMgaXMgYWJzZW50IChvbGQgY2FjaGUpXG5jb25zdCBTRUNUSU9OX0ZBTExCQUNLOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBvcGVuaW5nOiAgIFwiT3BlbmluZ1wiLFxuICB0cmVhc3VyZXM6IFwiVHJlYXN1cmVzIGZyb20gR29kJ3MgV29yZFwiLFxuICBtaW5pc3RyeTogIFwiQXBwbHkgWW91cnNlbGYgdG8gdGhlIE1pbmlzdHJ5XCIsXG4gIGxpdmluZzogICAgXCJMaXZpbmcgYXMgQ2hyaXN0aWFuc1wiLFxuICBjbG9zaW5nOiAgIFwiQ2xvc2luZ1wiLFxufTtcblxuLy8gT3BlbmluZy9DbG9zaW5nIGxhYmVscyBwZXIgbG9jYWxlIGxhbmd1YWdlIGNvZGUgKFdPTCBvbmx5IGhhcyBoMiBmb3IgdGhlIDMgbWlkZGxlIHNlY3Rpb25zKVxuY29uc3QgTE9DQUxFX09QRU5JTkdfQ0xPU0lORzogUmVjb3JkPHN0cmluZywgW3N0cmluZywgc3RyaW5nXT4gPSB7XG4gIFwibHAtZVwiOiAgIFtcIk9wZW5pbmdcIiwgICAgXCJDbG9zaW5nXCJdLFxuICBcImxwLXNcIjogICBbXCJBcGVydHVyYVwiLCAgIFwiQ29uY2x1c2lcdTAwRjNuXCJdLFxuICBcImxwLWZcIjogICBbXCJPdXZlcnR1cmVcIiwgIFwiQ29uY2x1c2lvblwiXSxcbiAgXCJscC10XCI6ICAgW1wiQWJlcnR1cmFcIiwgICBcIkNvbmNsdXNcdTAwRTNvXCJdLFxuICBcImxwLWdcIjogICBbXCJFclx1MDBGNmZmbnVuZ1wiLCAgXCJBYnNjaGx1c3NcIl0sXG4gIFwibHAtaVwiOiAgIFtcIkFwZXJ0dXJhXCIsICAgXCJDb25jbHVzaW9uZVwiXSxcbiAgXCJscC11XCI6ICAgW1wiXHUwNDFEXHUwNDMwXHUwNDQ3XHUwNDMwXHUwNDNCXHUwNDNFXCIsICAgICBcIlx1MDQxN1x1MDQzMFx1MDQzQVx1MDQzQlx1MDQ0RVx1MDQ0N1x1MDQzNVx1MDQzRFx1MDQzOFx1MDQzNVwiXSxcbiAgXCJscC1kXCI6ICAgW1wiT3BlbmluZ1wiLCAgICBcIlNsdWl0aW5nXCJdLFxuICBcImxwLXBcIjogICBbXCJPdHdhcmNpZVwiLCAgIFwiWmFrb1x1MDE0NGN6ZW5pZVwiXSxcbiAgXCJscC1jaHNcIjogW1wiXHU1RjAwXHU1NzNBXCIsICAgICAgICBcIlx1N0VEM1x1Njc1RlwiXSxcbn07XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBIZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBmb3JtYXRNbVNzKG1zOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCB0b3RhbFNlYyA9IE1hdGgubWF4KDAsIE1hdGguZmxvb3IobXMgLyAxMDAwKSk7XG4gIGNvbnN0IG0gPSBNYXRoLmZsb29yKHRvdGFsU2VjIC8gNjApO1xuICBjb25zdCBzID0gdG90YWxTZWMgJSA2MDtcbiAgcmV0dXJuIGAke1N0cmluZyhtKS5wYWRTdGFydCgyLCBcIjBcIil9OiR7U3RyaW5nKHMpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xufVxuXG5mdW5jdGlvbiB0aW1lVG9NaW51dGVzKHRpbWU6IHN0cmluZyk6IG51bWJlciB7XG4gIGNvbnN0IFtoaCwgbW1dID0gdGltZS5zcGxpdChcIjpcIikubWFwKE51bWJlcik7XG4gIHJldHVybiAoaGggPz8gMCkgKiA2MCArIChtbSA/PyAwKTtcbn1cblxuZnVuY3Rpb24gbWludXRlc1RvVGltZShtaW5zOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCBoID0gTWF0aC5mbG9vcihtaW5zIC8gNjApICUgMjQ7XG4gIGNvbnN0IG0gPSBtaW5zICUgNjA7XG4gIHJldHVybiBgJHtTdHJpbmcoaCkucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhtKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbn1cblxuZnVuY3Rpb24gdGltZXN0YW1wVG9ISE1NKG1zOiBudW1iZXIpOiBzdHJpbmcge1xuICBjb25zdCBkID0gbmV3IERhdGUobXMpO1xuICByZXR1cm4gYCR7U3RyaW5nKGQuZ2V0SG91cnMoKSkucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhkLmdldE1pbnV0ZXMoKSkucGFkU3RhcnQoMiwgXCIwXCIpfWA7XG59XG5cbi8qKiBOdW1iZXIgb2YgSVNPIHdlZWtzIGluIGEgeWVhciAoNTIgb3IgNTMpLiBEZWMgMjggaXMgYWx3YXlzIGluIHRoZSBsYXN0IElTTyB3ZWVrLiAqL1xuZnVuY3Rpb24gaXNvV2Vla3NJblllYXIoeWVhcjogbnVtYmVyKTogbnVtYmVyIHtcbiAgY29uc3QgZCA9IG5ldyBEYXRlKERhdGUuVVRDKHllYXIsIDExLCAyOCkpO1xuICBkLnNldFVUQ0RhdGUoZC5nZXRVVENEYXRlKCkgKyA0IC0gKGQuZ2V0VVRDRGF5KCkgfHwgNykpO1xuICBjb25zdCB5ZWFyU3RhcnQgPSBuZXcgRGF0ZShEYXRlLlVUQyhkLmdldFVUQ0Z1bGxZZWFyKCksIDAsIDEpKTtcbiAgcmV0dXJuIE1hdGguY2VpbCgoKGQuZ2V0VGltZSgpIC0geWVhclN0YXJ0LmdldFRpbWUoKSkgLyA4Nl80MDBfMDAwICsgMSkgLyA3KTtcbn1cblxudHlwZSBUaW1lckNvbG9yU3RhdGUgPSBcImlkbGVcIiB8IFwib2tcIiB8IFwid2FyblwiIHwgXCJvdmVyXCI7XG5cbmZ1bmN0aW9uIGNvbG9yU3RhdGUoZWxhcHNlZE1zOiBudW1iZXIsIGR1cmF0aW9uU2VjOiBudW1iZXIsIHN0YXR1czogVGltZXJTbmFwc2hvdFtcInN0YXR1c1wiXSk6IFRpbWVyQ29sb3JTdGF0ZSB7XG4gIGlmIChzdGF0dXMgPT09IFwiaWRsZVwiKSByZXR1cm4gXCJpZGxlXCI7XG4gIGNvbnN0IHJhdGlvID0gZWxhcHNlZE1zIC8gKGR1cmF0aW9uU2VjICogMTAwMCk7XG4gIGlmIChyYXRpbyA+IDEpIHJldHVybiBcIm92ZXJcIjtcbiAgaWYgKHJhdGlvID49IFdBUk5fVEhSRVNIT0xEKSByZXR1cm4gXCJ3YXJuXCI7XG4gIHJldHVybiBcIm9rXCI7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBUeXBlcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuaW50ZXJmYWNlIENhcmRSZWZzIHtcbiAgY2FyZEVsOiBIVE1MRWxlbWVudDtcbiAgZWxhcHNlZEVsOiBIVE1MRWxlbWVudDtcbiAgZW5kVGltZUVsOiBIVE1MRWxlbWVudDtcbiAgc3RvcHBlZEF0RWw6IEhUTUxFbGVtZW50O1xuICBwbGF5QnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgcmVzZXRCdG46IEhUTUxCdXR0b25FbGVtZW50O1xuICBiYXJGaWxsRWw6IEhUTUxFbGVtZW50O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVmlldyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGNsYXNzIEp3VGltZXJWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBwcml2YXRlIHNjaGVkdWxlOiBXZWVrbHlTY2hlZHVsZSB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHdlZWtLZXkgPSBcIlwiO1xuICBwcml2YXRlIGNhcmRzID0gbmV3IE1hcDxudW1iZXIsIENhcmRSZWZzPigpO1xuICBwcml2YXRlIHRpY2tIYW5kbGU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN0YXR1c0VsITogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgbmF2TGFiZWxFbCE6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIHRvZGF5QnRuITogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHByaXZhdGUgbGlzdEVsITogSFRNTEVsZW1lbnQ7XG5cbiAgLy8gUGFnaW5hdGlvbiBzdGF0ZSBcdTIwMTQgaW5pdGlhbGlzZWQgdG8gY3VycmVudCB3ZWVrIGluIG9uT3BlblxuICBwcml2YXRlIHZpZXdZZWFyOiBudW1iZXIgPSBuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCk7XG4gIHByaXZhdGUgdmlld1dlZWs6IG51bWJlciA9IGN1cnJlbnRXZWVrTnVtYmVyKCk7XG5cbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZiwgcHJpdmF0ZSByZWFkb25seSBwbHVnaW46IEp3VGltZXJQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7IHJldHVybiBWSUVXX1RZUEVfSldfVElNRVI7IH1cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHsgcmV0dXJuIFwiSlcgTWVldGluZyBUaW1lclwiOyB9XG4gIGdldEljb24oKTogc3RyaW5nIHsgcmV0dXJuIFwidGltZXJcIjsgfVxuXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByb290ID0gdGhpcy5jb250ZW50RWw7XG4gICAgcm9vdC5lbXB0eSgpO1xuICAgIHJvb3QuYWRkQ2xhc3MoXCJqdy10aW1lci1yb290XCIpO1xuXG4gICAgLy8gXHUyNTAwXHUyNTAwIFdlZWsgbmF2aWdhdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICBjb25zdCBuYXZFbCA9IHJvb3QuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLW5hdlwiIH0pO1xuICAgIGNvbnN0IHByZXZCdG4gPSBuYXZFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJqdy10aW1lci1uYXYtYnRuXCIsIHRleHQ6IFwiXHUyNUMwXCIgfSk7XG4gICAgcHJldkJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIlByZXZpb3VzIHdlZWtcIik7XG4gICAgdGhpcy5uYXZMYWJlbEVsID0gbmF2RWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLW5hdi1sYWJlbFwiIH0pO1xuICAgIGNvbnN0IG5leHRCdG4gPSBuYXZFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJqdy10aW1lci1uYXYtYnRuXCIsIHRleHQ6IFwiXHUyNUI2XCIgfSk7XG4gICAgbmV4dEJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIk5leHQgd2Vla1wiKTtcbiAgICB0aGlzLnRvZGF5QnRuID0gbmF2RWwuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwianctdGltZXItbmF2LXRvZGF5XCIsIHRleHQ6IFwiVG9kYXlcIiB9KTtcbiAgICB0aGlzLnRvZGF5QnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiSnVtcCB0byBjdXJyZW50IHdlZWtcIik7XG4gICAgdGhpcy50b2RheUJ0bi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgcHJldkJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdm9pZCB0aGlzLm5hdmlnYXRlV2VlaygtMSkpO1xuICAgIG5leHRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHZvaWQgdGhpcy5uYXZpZ2F0ZVdlZWsoKzEpKTtcbiAgICB0aGlzLnRvZGF5QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB2b2lkIHRoaXMubmF2aWdhdGVUb1RvZGF5KCkpO1xuXG4gICAgLy8gXHUyNTAwXHUyNTAwIFJlc2V0LWFsbCB0b29sYmFyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAgIGNvbnN0IHRvb2xiYXIgPSByb290LmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci10b29sYmFyXCIgfSk7XG4gICAgY29uc3QgcmVzZXRBbGxCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgIGNsczogXCJqdy10aW1lci1idG4ganctdGltZXItYnRuLXJlc2V0LWFsbFwiLFxuICAgICAgdGV4dDogXCJSZXNldCBBbGxcIixcbiAgICB9KTtcbiAgICByZXNldEFsbEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5oYW5kbGVSZXNldEFsbCgpKTtcblxuICAgIC8vIFx1MjUwMFx1MjUwMCBTdGF0dXMgKyBsaXN0IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAgIHRoaXMuc3RhdHVzRWwgPSByb290LmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1zdGF0dXNcIiB9KTtcbiAgICB0aGlzLmxpc3RFbCA9IHJvb3QuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWxpc3RcIiB9KTtcblxuICAgIHRoaXMudGlja0hhbmRsZSA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnRpY2soKSwgMjUwKTtcblxuICAgIHRoaXMudmlld1llYXIgPSBuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCk7XG4gICAgdGhpcy52aWV3V2VlayA9IGN1cnJlbnRXZWVrTnVtYmVyKCk7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2NoZWR1bGVGb3JXZWVrKHRoaXMudmlld1llYXIsIHRoaXMudmlld1dlZWspO1xuICB9XG5cbiAgYXN5bmMgb25DbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy50aWNrSGFuZGxlICE9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLnRpY2tIYW5kbGUpO1xuICAgICAgdGhpcy50aWNrSGFuZGxlID0gbnVsbDtcbiAgICB9XG4gICAgYXdhaXQgdGhpcy5wbHVnaW4ucGVyc2lzdFRpbWVycygpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFB1YmxpYzogY2FsbGVkIHdoZW4gc2V0dGluZ3MgY2hhbmdlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGFzeW5jIHJlbG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnNjaGVkdWxlID0gbnVsbDtcbiAgICB0aGlzLmNhcmRzLmNsZWFyKCk7XG4gICAgdGhpcy5saXN0RWwuZW1wdHkoKTtcbiAgICBhd2FpdCB0aGlzLmxvYWRTY2hlZHVsZUZvcldlZWsodGhpcy52aWV3WWVhciwgdGhpcy52aWV3V2Vlayk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgV2VlayBuYXZpZ2F0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgYXN5bmMgbmF2aWdhdGVXZWVrKGRlbHRhOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBsZXQgdyA9IHRoaXMudmlld1dlZWsgKyBkZWx0YTtcbiAgICBsZXQgeSA9IHRoaXMudmlld1llYXI7XG4gICAgaWYgKHcgPCAxKSB7XG4gICAgICB5LS07XG4gICAgICB3ID0gaXNvV2Vla3NJblllYXIoeSk7XG4gICAgfSBlbHNlIGlmICh3ID4gaXNvV2Vla3NJblllYXIoeSkpIHtcbiAgICAgIHkrKztcbiAgICAgIHcgPSAxO1xuICAgIH1cbiAgICB0aGlzLnZpZXdZZWFyID0geTtcbiAgICB0aGlzLnZpZXdXZWVrID0gdztcbiAgICB0aGlzLnNjaGVkdWxlID0gbnVsbDtcbiAgICB0aGlzLmNhcmRzLmNsZWFyKCk7XG4gICAgdGhpcy5saXN0RWwuZW1wdHkoKTtcbiAgICBhd2FpdCB0aGlzLmxvYWRTY2hlZHVsZUZvcldlZWsoeSwgdyk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgVG9kYXkgaGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIGlzQ3VycmVudFdlZWsoKTogYm9vbGVhbiB7XG4gICAgY29uc3QgeWVhciA9IG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKTtcbiAgICBjb25zdCB3ZWVrID0gY3VycmVudFdlZWtOdW1iZXIoKTtcbiAgICByZXR1cm4gdGhpcy52aWV3WWVhciA9PT0geWVhciAmJiB0aGlzLnZpZXdXZWVrID09PSB3ZWVrO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVUb2RheVZpc2liaWxpdHkoKTogdm9pZCB7XG4gICAgdGhpcy50b2RheUJ0bi5zdHlsZS5kaXNwbGF5ID0gdGhpcy5pc0N1cnJlbnRXZWVrKCkgPyBcIm5vbmVcIiA6IFwiXCI7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIG5hdmlnYXRlVG9Ub2RheSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnZpZXdZZWFyID0gbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpO1xuICAgIHRoaXMudmlld1dlZWsgPSBjdXJyZW50V2Vla051bWJlcigpO1xuICAgIHRoaXMuc2NoZWR1bGUgPSBudWxsO1xuICAgIHRoaXMuY2FyZHMuY2xlYXIoKTtcbiAgICB0aGlzLmxpc3RFbC5lbXB0eSgpO1xuICAgIGF3YWl0IHRoaXMubG9hZFNjaGVkdWxlRm9yV2Vlayh0aGlzLnZpZXdZZWFyLCB0aGlzLnZpZXdXZWVrKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBTY2hlZHVsZSBsb2FkaW5nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZFNjaGVkdWxlRm9yV2Vlayh5ZWFyOiBudW1iZXIsIHdlZWs6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMud2Vla0tleSA9IGNhY2hlS2V5KHllYXIsIHdlZWspO1xuICAgIHRoaXMubmF2TGFiZWxFbC5zZXRUZXh0KGAke3llYXJ9IFx1MDBCNyBXJHtTdHJpbmcod2VlaykucGFkU3RhcnQoMiwgXCIwXCIpfWApO1xuXG4gICAgbGV0IHNjaGVkdWxlID0gdGhpcy5wbHVnaW4uZ2V0Q2FjaGVkU2NoZWR1bGUodGhpcy53ZWVrS2V5KTtcblxuICAgIGlmICghc2NoZWR1bGUpIHtcbiAgICAgIHRoaXMuc2V0U3RhdHVzKFwibG9hZGluZ1wiLCBcIkZldGNoaW5nIHNjaGVkdWxlIGZyb20gd29sLmp3Lm9yZ1x1MjAyNlwiKTtcbiAgICAgIHNjaGVkdWxlID0gYXdhaXQgZmV0Y2hXZWVrU2NoZWR1bGUodGhpcy5wbHVnaW4uc2V0dGluZ3Mud29sTG9jYWxlLCB5ZWFyLCB3ZWVrKTtcbiAgICAgIGlmIChzY2hlZHVsZSkge1xuICAgICAgICB0aGlzLnBsdWdpbi5jYWNoZVNjaGVkdWxlKHRoaXMud2Vla0tleSwgc2NoZWR1bGUpO1xuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXNjaGVkdWxlKSB7XG4gICAgICB0aGlzLnNldFN0YXR1cyhcImVycm9yXCIsIFwiQ291bGQgbm90IGxvYWQgc2NoZWR1bGUuIENoZWNrIHlvdXIgY29ubmVjdGlvbiBhbmQgbGFuZ3VhZ2Ugc2V0dGluZy5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zY2hlZHVsZSA9IHNjaGVkdWxlO1xuICAgIHRoaXMubmF2TGFiZWxFbC5zZXRUZXh0KHNjaGVkdWxlLndlZWtMYWJlbCk7XG4gICAgdGhpcy5zZXRTdGF0dXMoXCJva1wiLCBcIlwiKTtcbiAgICB0aGlzLnJlbmRlclNjaGVkdWxlKHNjaGVkdWxlKTtcbiAgICB0aGlzLnVwZGF0ZVRvZGF5VmlzaWJpbGl0eSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBzZXRTdGF0dXModHlwZTogXCJva1wiIHwgXCJsb2FkaW5nXCIgfCBcImVycm9yXCIsIHRleHQ6IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuc3RhdHVzRWwuZW1wdHkoKTtcbiAgICB0aGlzLnN0YXR1c0VsLmNsYXNzTmFtZSA9IGBqdy10aW1lci1zdGF0dXMganctdGltZXItc3RhdHVzLS0ke3R5cGV9YDtcbiAgICB0aGlzLnN0YXR1c0VsLnNldFRleHQodGV4dCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgUmVuZGVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgcmVuZGVyU2NoZWR1bGUoc2NoZWR1bGU6IFdlZWtseVNjaGVkdWxlKTogdm9pZCB7XG4gICAgdGhpcy5saXN0RWwuZW1wdHkoKTtcbiAgICB0aGlzLmNhcmRzLmNsZWFyKCk7XG5cbiAgICBjb25zdCBzdGFydE1pbnV0ZXMgPSB0aW1lVG9NaW51dGVzKHRoaXMucGx1Z2luLnNldHRpbmdzLm1lZXRpbmdTdGFydFRpbWUpO1xuICAgIGxldCBjdXJzb3IgPSBzdGFydE1pbnV0ZXMgKyB0aGlzLnBsdWdpbi5zZXR0aW5ncy5vcGVuaW5nU29uZ01pbnV0ZXM7XG5cbiAgICBjb25zdCBzY2hlZHVsZWRTdGFydCA9IG5ldyBNYXA8bnVtYmVyLCBudW1iZXI+KCk7XG4gICAgZm9yIChjb25zdCBwYXJ0IG9mIHNjaGVkdWxlLnBhcnRzKSB7XG4gICAgICBzY2hlZHVsZWRTdGFydC5zZXQocGFydC5vcmRlciwgY3Vyc29yKTtcbiAgICAgIGN1cnNvciArPSBNYXRoLmNlaWwocGFydC5kdXJhdGlvblNlYyAvIDYwKTtcbiAgICB9XG5cbiAgICAvLyBPcGVuaW5nL0Nsb3NpbmcgbGFiZWxzIGZyb20gbG9jYWxlIG1hcDsgbWlkZGxlIHNlY3Rpb25zIGZyb20gc2NyYXBlciAocGFnZSBsYW5ndWFnZSlcbiAgICBjb25zdCBsYW5nS2V5ID0gdGhpcy5wbHVnaW4uc2V0dGluZ3Mud29sTG9jYWxlLnNwbGl0KFwiL1wiKVsxXSA/PyBcImxwLWVcIjtcbiAgICBjb25zdCBbb3BlbmluZ0xhYmVsLCBjbG9zaW5nTGFiZWxdID0gTE9DQUxFX09QRU5JTkdfQ0xPU0lOR1tsYW5nS2V5XSA/PyBbXCJPcGVuaW5nXCIsIFwiQ2xvc2luZ1wiXTtcbiAgICBjb25zdCBzZWN0aW9uTGFiZWxzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgLi4uU0VDVElPTl9GQUxMQkFDSyxcbiAgICAgIC4uLihzY2hlZHVsZS5zZWN0aW9uTGFiZWxzID8/IHt9KSxcbiAgICAgIG9wZW5pbmc6IG9wZW5pbmdMYWJlbCxcbiAgICAgIGNsb3Npbmc6IGNsb3NpbmdMYWJlbCxcbiAgICB9O1xuXG4gICAgLy8gR3JvdXAgcGFydHMgYnkgc2VjdGlvblxuICAgIGNvbnN0IHNlY3Rpb25zID0gbmV3IE1hcDxzdHJpbmcsIE1lZXRpbmdQYXJ0W10+KCk7XG4gICAgZm9yIChjb25zdCBwYXJ0IG9mIHNjaGVkdWxlLnBhcnRzKSB7XG4gICAgICBjb25zdCBsaXN0ID0gc2VjdGlvbnMuZ2V0KHBhcnQuc2VjdGlvbikgPz8gW107XG4gICAgICBsaXN0LnB1c2gocGFydCk7XG4gICAgICBzZWN0aW9ucy5zZXQocGFydC5zZWN0aW9uLCBsaXN0KTtcbiAgICB9XG5cbiAgICBjb25zdCBzZWN0aW9uT3JkZXIgPSBbXCJvcGVuaW5nXCIsIFwidHJlYXN1cmVzXCIsIFwibWluaXN0cnlcIiwgXCJsaXZpbmdcIiwgXCJjbG9zaW5nXCJdO1xuICAgIGZvciAoY29uc3Qgc2VjdGlvbktleSBvZiBzZWN0aW9uT3JkZXIpIHtcbiAgICAgIGNvbnN0IHBhcnRzID0gc2VjdGlvbnMuZ2V0KHNlY3Rpb25LZXkpO1xuICAgICAgaWYgKCFwYXJ0cz8ubGVuZ3RoKSBjb250aW51ZTtcblxuICAgICAgY29uc3Qgc2VjdGlvbkVsID0gdGhpcy5saXN0RWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLXNlY3Rpb25cIiB9KTtcbiAgICAgIHNlY3Rpb25FbC5jcmVhdGVFbChcImgzXCIsIHtcbiAgICAgICAgY2xzOiBcImp3LXRpbWVyLXNlY3Rpb24tdGl0bGVcIixcbiAgICAgICAgdGV4dDogc2VjdGlvbkxhYmVsc1tzZWN0aW9uS2V5XSA/PyBzZWN0aW9uS2V5LFxuICAgICAgfSk7XG5cbiAgICAgIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuICAgICAgICBpZiAocGFydC5pc1NlcGFyYXRvcikgY29udGludWU7XG4gICAgICAgIHRoaXMucmVuZGVyQ2FyZChzZWN0aW9uRWwsIHBhcnQsIHNjaGVkdWxlZFN0YXJ0LmdldChwYXJ0Lm9yZGVyKSA/PyBzdGFydE1pbnV0ZXMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyQ2FyZChwYXJlbnRFbDogSFRNTEVsZW1lbnQsIHBhcnQ6IE1lZXRpbmdQYXJ0LCBzY2hlZHVsZWRTdGFydE1pbnM6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IGNhcmQgPSBwYXJlbnRFbC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2FyZFwiIH0pO1xuICAgIGNhcmQuc2V0QXR0cmlidXRlKFwiZGF0YS1zdGF0ZVwiLCBcImlkbGVcIik7XG4gICAgY2FyZC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXJ1bm5pbmdcIiwgXCJmYWxzZVwiKTtcblxuICAgIC8vIFRpdGxlICsgYWxsb3R0ZWQgbWludXRlc1xuICAgIGNvbnN0IGhlYWRlciA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNhcmQtaGVhZGVyXCIgfSk7XG4gICAgaGVhZGVyLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jYXJkLXRpdGxlXCIsIHRleHQ6IHBhcnQubGFiZWwgfSk7XG4gICAgaGVhZGVyLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jYXJkLWFsbG90dGVkXCIsIHRleHQ6IGAke01hdGgucm91bmQocGFydC5kdXJhdGlvblNlYyAvIDYwKX0gbWluYCB9KTtcblxuICAgIC8vIFNjaGVkdWxlZCBlbmQgdGltZSArIGFjdHVhbCBzdG9wcGVkLWF0IHRpbWVcbiAgICBjb25zdCBlbmRUaW1lTWlucyA9IHNjaGVkdWxlZFN0YXJ0TWlucyArIE1hdGguY2VpbChwYXJ0LmR1cmF0aW9uU2VjIC8gNjApO1xuICAgIGNvbnN0IHRpbWVSb3cgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci10aW1lLXJvd1wiIH0pO1xuICAgIGNvbnN0IGVuZFRpbWVFbCA9IHRpbWVSb3cuY3JlYXRlU3Bhbih7XG4gICAgICBjbHM6IFwianctdGltZXItZW5kLXRpbWVcIixcbiAgICAgIHRleHQ6IGBFbmQgJHttaW51dGVzVG9UaW1lKGVuZFRpbWVNaW5zKX1gLFxuICAgIH0pO1xuICAgIGNvbnN0IHN0b3BwZWRBdEVsID0gdGltZVJvdy5jcmVhdGVTcGFuKHsgY2xzOiBcImp3LXRpbWVyLXN0b3BwZWQtYXRcIiB9KTtcblxuICAgIC8vIFByb2dyZXNzIGJhclxuICAgIGNvbnN0IGJhckVsID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItYmFyXCIgfSk7XG4gICAgY29uc3QgYmFyRmlsbEVsID0gYmFyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWJhci1maWxsXCIgfSk7XG5cbiAgICAvLyBMYXJnZSBlbGFwc2VkIGNsb2NrXG4gICAgY29uc3QgY2xvY2tSb3cgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jbG9jay1yb3dcIiB9KTtcbiAgICBjb25zdCBlbGFwc2VkRWwgPSBjbG9ja1Jvdy5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItZWxhcHNlZFwiLCB0ZXh0OiBcIjAwOjAwXCIgfSk7XG5cbiAgICAvLyBDb250cm9sc1xuICAgIGNvbnN0IGNvbnRyb2xzID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY29udHJvbHNcIiB9KTtcbiAgICBjb25zdCBwbGF5QnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwianctdGltZXItYnRuIGp3LXRpbWVyLWJ0bi1wbGF5XCIsIHRleHQ6IFwiUGxheVwiIH0pO1xuICAgIHBsYXlCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJTdGFydCB0aW1lclwiKTtcbiAgICBjb25zdCByZXNldEJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImp3LXRpbWVyLWJ0biBqdy10aW1lci1idG4tcmVzZXRcIiwgdGV4dDogXCJSZXNldFwiIH0pO1xuICAgIHJlc2V0QnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiUmVzZXQgdGltZXJcIik7XG5cbiAgICBwbGF5QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB0aGlzLmhhbmRsZVBsYXlQYXVzZShwYXJ0KSk7XG4gICAgcmVzZXRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHRoaXMuaGFuZGxlUmVzZXQocGFydCkpO1xuXG4gICAgLy8gU3VwcHJlc3MgdW51c2VkLXZhciB3YXJuaW5nIFx1MjAxNCBlbmRUaW1lRWwgY29udGVudCBpcyBzZXQgb25jZSBhbmQgbmV2ZXIgY2hhbmdlc1xuICAgIHZvaWQgZW5kVGltZUVsO1xuXG4gICAgdGhpcy5jYXJkcy5zZXQocGFydC5vcmRlciwgeyBjYXJkRWw6IGNhcmQsIGVsYXBzZWRFbCwgZW5kVGltZUVsLCBzdG9wcGVkQXRFbCwgcGxheUJ0biwgcmVzZXRCdG4sIGJhckZpbGxFbCB9KTtcbiAgICB0aGlzLnVwZGF0ZUNhcmQocGFydCwgc2NoZWR1bGVkU3RhcnRNaW5zKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBUaW1lciBjb250cm9scyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIGhhbmRsZVBsYXlQYXVzZShwYXJ0OiBNZWV0aW5nUGFydCk6IHZvaWQge1xuICAgIGNvbnN0IHNuYXAgPSB0aGlzLnBsdWdpbi50aW1lckVuZ2luZS5nZXQodGhpcy53ZWVrS2V5LCBwYXJ0Lm9yZGVyKTtcbiAgICBpZiAoc25hcC5zdGF0dXMgPT09IFwicnVubmluZ1wiKSB7XG4gICAgICB0aGlzLnBsdWdpbi50aW1lckVuZ2luZS5wYXVzZSh0aGlzLndlZWtLZXksIHBhcnQub3JkZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBsdWdpbi50aW1lckVuZ2luZS5zdGFydCh0aGlzLndlZWtLZXksIHBhcnQub3JkZXIpO1xuICAgIH1cbiAgICB0aGlzLnVwZGF0ZUNhcmRCeU9yZGVyKHBhcnQpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVSZXNldChwYXJ0OiBNZWV0aW5nUGFydCk6IHZvaWQge1xuICAgIHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLnJlc2V0KHRoaXMud2Vla0tleSwgcGFydC5vcmRlcik7XG4gICAgdGhpcy51cGRhdGVDYXJkQnlPcmRlcihwYXJ0KTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBUaWNrICYgZGlzcGxheSB1cGRhdGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgcHJpdmF0ZSB0aWNrKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5zY2hlZHVsZSkgcmV0dXJuO1xuICAgIGZvciAoY29uc3QgcGFydCBvZiB0aGlzLnNjaGVkdWxlLnBhcnRzKSB7XG4gICAgICBjb25zdCBzbmFwID0gdGhpcy5wbHVnaW4udGltZXJFbmdpbmUuZ2V0KHRoaXMud2Vla0tleSwgcGFydC5vcmRlcik7XG4gICAgICBpZiAoc25hcC5zdGF0dXMgPT09IFwicnVubmluZ1wiKSB7XG4gICAgICAgIHRoaXMudXBkYXRlQ2FyZEJ5T3JkZXIocGFydCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVDYXJkQnlPcmRlcihwYXJ0OiBNZWV0aW5nUGFydCk6IHZvaWQge1xuICAgIGNvbnN0IHN0YXJ0TWludXRlcyA9IHRpbWVUb01pbnV0ZXModGhpcy5wbHVnaW4uc2V0dGluZ3MubWVldGluZ1N0YXJ0VGltZSk7XG4gICAgbGV0IGN1cnNvciA9IHN0YXJ0TWludXRlcyArIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5pbmdTb25nTWludXRlcztcbiAgICBsZXQgc2NoZWR1bGVkU3RhcnQgPSBjdXJzb3I7XG4gICAgZm9yIChjb25zdCBwIG9mICh0aGlzLnNjaGVkdWxlPy5wYXJ0cyA/PyBbXSkpIHtcbiAgICAgIGlmIChwLm9yZGVyID09PSBwYXJ0Lm9yZGVyKSB7IHNjaGVkdWxlZFN0YXJ0ID0gY3Vyc29yOyBicmVhazsgfVxuICAgICAgY3Vyc29yICs9IE1hdGguY2VpbChwLmR1cmF0aW9uU2VjIC8gNjApO1xuICAgIH1cbiAgICB0aGlzLnVwZGF0ZUNhcmQocGFydCwgc2NoZWR1bGVkU3RhcnQpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVDYXJkKHBhcnQ6IE1lZXRpbmdQYXJ0LCBzY2hlZHVsZWRTdGFydE1pbnM6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IHJlZnMgPSB0aGlzLmNhcmRzLmdldChwYXJ0Lm9yZGVyKTtcbiAgICBpZiAoIXJlZnMpIHJldHVybjtcblxuICAgIGNvbnN0IHNuYXAgPSB0aGlzLnBsdWdpbi50aW1lckVuZ2luZS5nZXQodGhpcy53ZWVrS2V5LCBwYXJ0Lm9yZGVyKTtcbiAgICBjb25zdCB7IGVsYXBzZWRNcywgc3RhdHVzLCBzdG9wcGVkQXQgfSA9IHNuYXA7XG4gICAgY29uc3QgZHVyYXRpb25NcyA9IHBhcnQuZHVyYXRpb25TZWMgKiAxMDAwO1xuXG4gICAgLy8gRWxhcHNlZCBjbG9ja1xuICAgIHJlZnMuZWxhcHNlZEVsLnNldFRleHQoZm9ybWF0TW1TcyhlbGFwc2VkTXMpKTtcblxuICAgIC8vIFByb2dyZXNzIGJhclxuICAgIHJlZnMuYmFyRmlsbEVsLnN0eWxlLndpZHRoID0gYCR7KE1hdGgubWluKDEsIGVsYXBzZWRNcyAvIGR1cmF0aW9uTXMpICogMTAwKS50b0ZpeGVkKDEpfSVgO1xuXG4gICAgLy8gU3RvcHBlZC1hdCBpbmRpY2F0b3IgKHNob3duIG9ubHkgd2hlbiBwYXVzZWQpXG4gICAgY29uc3QgZW5kVGltZU1pbnMgPSBzY2hlZHVsZWRTdGFydE1pbnMgKyBNYXRoLmNlaWwocGFydC5kdXJhdGlvblNlYyAvIDYwKTtcbiAgICBpZiAoc3RhdHVzID09PSBcInBhdXNlZFwiICYmIHN0b3BwZWRBdCAhPSBudWxsKSB7XG4gICAgICBjb25zdCBkID0gbmV3IERhdGUoc3RvcHBlZEF0KTtcbiAgICAgIGNvbnN0IHN0b3BwZWRNaW5zID0gZC5nZXRIb3VycygpICogNjAgKyBkLmdldE1pbnV0ZXMoKTtcbiAgICAgIGNvbnN0IGxhdGUgPSBzdG9wcGVkTWlucyA+IGVuZFRpbWVNaW5zO1xuICAgICAgcmVmcy5zdG9wcGVkQXRFbC5zZXRUZXh0KGBcdTAwQjcgU3RvcHBlZCAke3RpbWVzdGFtcFRvSEhNTShzdG9wcGVkQXQpfWApO1xuICAgICAgcmVmcy5zdG9wcGVkQXRFbC5jbGFzc05hbWUgPSBsYXRlXG4gICAgICAgID8gXCJqdy10aW1lci1zdG9wcGVkLWF0IGp3LXRpbWVyLXN0b3BwZWQtYXQtLWxhdGVcIlxuICAgICAgICA6IFwianctdGltZXItc3RvcHBlZC1hdFwiO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWZzLnN0b3BwZWRBdEVsLnNldFRleHQoXCJcIik7XG4gICAgICByZWZzLnN0b3BwZWRBdEVsLmNsYXNzTmFtZSA9IFwianctdGltZXItc3RvcHBlZC1hdFwiO1xuICAgIH1cblxuICAgIC8vIENhcmQgY29sb3VyIHN0YXRlICsgcnVubmluZyBpbmRpY2F0b3IgZm9yIENTU1xuICAgIGNvbnN0IHN0YXRlID0gY29sb3JTdGF0ZShlbGFwc2VkTXMsIHBhcnQuZHVyYXRpb25TZWMsIHN0YXR1cyk7XG4gICAgcmVmcy5jYXJkRWwuc2V0QXR0cmlidXRlKFwiZGF0YS1zdGF0ZVwiLCBzdGF0ZSk7XG4gICAgcmVmcy5jYXJkRWwuc2V0QXR0cmlidXRlKFwiZGF0YS1ydW5uaW5nXCIsIHN0YXR1cyA9PT0gXCJydW5uaW5nXCIgPyBcInRydWVcIiA6IFwiZmFsc2VcIik7XG5cbiAgICAvLyBQbGF5L3BhdXNlIGJ1dHRvbiBsYWJlbFxuICAgIGlmIChzdGF0dXMgPT09IFwicnVubmluZ1wiKSB7XG4gICAgICByZWZzLnBsYXlCdG4uc2V0VGV4dChcIlBhdXNlXCIpO1xuICAgICAgcmVmcy5wbGF5QnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiUGF1c2UgdGltZXJcIik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZnMucGxheUJ0bi5zZXRUZXh0KFwiUGxheVwiKTtcbiAgICAgIHJlZnMucGxheUJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBzdGF0dXMgPT09IFwicGF1c2VkXCIgPyBcIlJlc3VtZSB0aW1lclwiIDogXCJTdGFydCB0aW1lclwiKTtcbiAgICB9XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgUmVzZXQgQWxsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgaGFuZGxlUmVzZXRBbGwoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnNjaGVkdWxlKSByZXR1cm47XG4gICAgZm9yIChjb25zdCBwYXJ0IG9mIHRoaXMuc2NoZWR1bGUucGFydHMpIHtcbiAgICAgIHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLnJlc2V0KHRoaXMud2Vla0tleSwgcGFydC5vcmRlcik7XG4gICAgfVxuICAgIHRoaXMucmVuZGVyU2NoZWR1bGUodGhpcy5zY2hlZHVsZSk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyByZXF1ZXN0VXJsIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSB7IFdlZWtseVNjaGVkdWxlLCBNZWV0aW5nUGFydCwgTWVldGluZ1NlY3Rpb24gfSBmcm9tIFwiLi90eXBlc1wiO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVVJMIGhlbHBlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGlzb1dlZWsoZGF0ZTogRGF0ZSk6IG51bWJlciB7XG4gIGNvbnN0IGQgPSBuZXcgRGF0ZShEYXRlLlVUQyhkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCkpKTtcbiAgZC5zZXRVVENEYXRlKGQuZ2V0VVRDRGF0ZSgpICsgNCAtIChkLmdldFVUQ0RheSgpIHx8IDcpKTtcbiAgY29uc3QgeWVhclN0YXJ0ID0gbmV3IERhdGUoRGF0ZS5VVEMoZC5nZXRVVENGdWxsWWVhcigpLCAwLCAxKSk7XG4gIHJldHVybiBNYXRoLmNlaWwoKChkLmdldFRpbWUoKSAtIHllYXJTdGFydC5nZXRUaW1lKCkpIC8gODZfNDAwXzAwMCArIDEpIC8gNyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyZW50V2Vla051bWJlcigpOiBudW1iZXIge1xuICByZXR1cm4gaXNvV2VlayhuZXcgRGF0ZSgpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkV29sVXJsKGxvY2FsZTogc3RyaW5nLCB5ZWFyOiBudW1iZXIsIHdlZWs6IG51bWJlcik6IHN0cmluZyB7XG4gIHJldHVybiBgaHR0cHM6Ly93b2wuancub3JnL2VuL3dvbC9tZWV0aW5ncy8ke2xvY2FsZX0vJHt5ZWFyfS8ke3dlZWt9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNhY2hlS2V5KHllYXI6IG51bWJlciwgd2VlazogbnVtYmVyKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAke3llYXJ9LSR7U3RyaW5nKHdlZWspLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRHVyYXRpb24gcGFyc2luZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqXG4gKiBNYXRjaGVzIFwiKE4gbWluLilcIiBPUiBcIihOIG1pbnMuKVwiIFx1MjAxNCBoYW5kbGVzIEVuZ2xpc2ggKFwibWluLlwiKSBhbmQgU3BhbmlzaCAoXCJtaW5zLlwiKS5cbiAqIFRoZSByZWdleCBpcyBhcHBsaWVkIGFnYWluc3QgcGxhaW4gdGV4dCBhZnRlciBzdHJpcHBpbmcgSFRNTCB0YWdzLlxuICovXG5jb25zdCBEVVJBVElPTl9SRSA9IC9cXCgoXFxkKylcXHMqbWlucz9cXC5cXCkvaTtcblxuZnVuY3Rpb24gcGFyc2VEdXJhdGlvbih0ZXh0OiBzdHJpbmcpOiBudW1iZXIgfCBudWxsIHtcbiAgY29uc3QgbSA9IERVUkFUSU9OX1JFLmV4ZWModGV4dCk7XG4gIHJldHVybiBtID8gcGFyc2VJbnQobVsxXSwgMTApICogNjAgOiBudWxsO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRmV0Y2ggXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaFdlZWtTY2hlZHVsZShcbiAgbG9jYWxlOiBzdHJpbmcsXG4gIHllYXI6IG51bWJlcixcbiAgd2VlazogbnVtYmVyXG4pOiBQcm9taXNlPFdlZWtseVNjaGVkdWxlIHwgbnVsbD4ge1xuICAvLyBTdGVwIDE6IGZldGNoIHRoZSBtZWV0aW5ncyBpbmRleCBwYWdlIHRvIGZpbmQgdGhlIE1XQiBkb2MgbGlua1xuICBjb25zdCBtZWV0aW5nc1VybCA9IGJ1aWxkV29sVXJsKGxvY2FsZSwgeWVhciwgd2Vlayk7XG4gIGxldCBtZWV0aW5nc0h0bWw6IHN0cmluZztcbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwID0gYXdhaXQgcmVxdWVzdFVybCh7XG4gICAgICB1cmw6IG1lZXRpbmdzVXJsLFxuICAgICAgaGVhZGVyczogeyBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgSldUaW1lck9ic2lkaWFuLzIuMClcIiB9LFxuICAgIH0pO1xuICAgIGlmIChyZXNwLnN0YXR1cyA8IDIwMCB8fCByZXNwLnN0YXR1cyA+PSAzMDApIHJldHVybiBudWxsO1xuICAgIG1lZXRpbmdzSHRtbCA9IHJlc3AudGV4dDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBNV0IgZG9jIElEcyBhcmUgOSsgZGlnaXRzXG4gIGNvbnN0IGRvY0xpbmtSZSA9IC9ocmVmPVwiKFxcL1teXCJdK1xcL3dvbFxcL2RcXC9bXlwiIz9dKylcIi9nO1xuICBjb25zdCBkb2NMaW5rczogc3RyaW5nW10gPSBbXTtcbiAgbGV0IG06IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG4gIHdoaWxlICgobSA9IGRvY0xpbmtSZS5leGVjKG1lZXRpbmdzSHRtbCkpICE9PSBudWxsKSB7XG4gICAgaWYgKC9cXC9cXGR7OSx9JC8udGVzdChtWzFdKSkgZG9jTGlua3MucHVzaChtWzFdKTtcbiAgfVxuICBpZiAoZG9jTGlua3MubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcblxuICAvLyBTdGVwIDI6IGZldGNoIHRoZSBNV0IgYXJ0aWNsZSBwYWdlXG4gIGNvbnN0IGRvY1VybCA9IGBodHRwczovL3dvbC5qdy5vcmcke2RvY0xpbmtzWzBdfWA7XG4gIGxldCBkb2NIdG1sOiBzdHJpbmc7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzcCA9IGF3YWl0IHJlcXVlc3RVcmwoe1xuICAgICAgdXJsOiBkb2NVcmwsXG4gICAgICBoZWFkZXJzOiB7IFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBKV1RpbWVyT2JzaWRpYW4vMi4wKVwiIH0sXG4gICAgfSk7XG4gICAgaWYgKHJlc3Auc3RhdHVzIDwgMjAwIHx8IHJlc3Auc3RhdHVzID49IDMwMCkgcmV0dXJuIG51bGw7XG4gICAgZG9jSHRtbCA9IHJlc3AudGV4dDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gcGFyc2VEb2NQYWdlKGRvY0h0bWwsIHllYXIsIHdlZWspO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgSFRNTCB1dGlsaXRpZXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGNsZWFuVGV4dChodG1sOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gaHRtbFxuICAgIC5yZXBsYWNlKC88W14+XSs+L2csIFwiIFwiKVxuICAgIC5yZXBsYWNlKC8mYW1wOy9nLCBcIiZcIilcbiAgICAucmVwbGFjZSgvJmx0Oy9nLCBcIjxcIilcbiAgICAucmVwbGFjZSgvJmd0Oy9nLCBcIj5cIilcbiAgICAucmVwbGFjZSgvJnF1b3Q7L2csICdcIicpXG4gICAgLnJlcGxhY2UoLyYjMzk7L2csIFwiJ1wiKVxuICAgIC5yZXBsYWNlKC8mbmJzcDsvZywgXCIgXCIpXG4gICAgLnJlcGxhY2UoL1xccysvZywgXCIgXCIpXG4gICAgLnRyaW0oKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIERvYyBwYWdlIHBhcnNpbmcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHBhcnNlRG9jUGFnZShodG1sOiBzdHJpbmcsIHllYXI6IG51bWJlciwgd2VlazogbnVtYmVyKTogV2Vla2x5U2NoZWR1bGUgfCBudWxsIHtcbiAgLy8gV2VlayBsYWJlbCBmcm9tIGgxXG4gIGNvbnN0IGgxTWF0Y2ggPSAvPGgxW14+XSo+KFtcXHNcXFNdKj8pPFxcL2gxPi9pLmV4ZWMoaHRtbCk7XG4gIGNvbnN0IHdlZWtMYWJlbCA9IGgxTWF0Y2ggPyBjbGVhblRleHQoaDFNYXRjaFsxXSkgOiBgV2VlayAke3dlZWt9YDtcblxuICAvLyBcdTI1MDBcdTI1MDAgU2VjdGlvbiBkZXRlY3Rpb24gdmlhIENTUyBjb2xvdXIgY2xhc3NlcyAobGFuZ3VhZ2UtaW5kZXBlbmRlbnQpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAvLyBoMiB3aXRoIGNsYXNzIGR1LWNvbG9yLS10ZWFsLTcwMCAgIFx1MjE5MiBUUkVBU1VSRVMgRlJPTSBHT0QnUyBXT1JEXG4gIC8vIGgyIHdpdGggY2xhc3MgZHUtY29sb3ItLWdvbGQtNzAwICAgXHUyMTkyIEFQUExZIFlPVVJTRUxGIFRPIFRIRSBGSUVMRCBNSU5JU1RSWVxuICAvLyBoMiB3aXRoIGNsYXNzIGR1LWNvbG9yLS1tYXJvb24tNjAwIFx1MjE5MiBMSVZJTkcgQVMgQ0hSSVNUSUFOU1xuICB0eXBlIFNlY3Rpb25Cb3VuZGFyeSA9IHsgcG9zOiBudW1iZXI7IHNlY3Rpb246IE1lZXRpbmdTZWN0aW9uOyBsYWJlbDogc3RyaW5nIH07XG4gIGNvbnN0IGJvdW5kYXJpZXM6IFNlY3Rpb25Cb3VuZGFyeVtdID0gW107XG5cbiAgY29uc3QgaDJSZSA9IC88aDIoW14+XSopPihbXFxzXFxTXSo/KTxcXC9oMj4vZ2k7XG4gIGxldCBoMm06IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG4gIHdoaWxlICgoaDJtID0gaDJSZS5leGVjKGh0bWwpKSAhPT0gbnVsbCkge1xuICAgIGNvbnN0IGNscyA9IGgybVsxXTtcbiAgICBjb25zdCB0ZXh0ID0gY2xlYW5UZXh0KGgybVsyXSkudG9VcHBlckNhc2UoKTtcbiAgICBsZXQgc2VjOiBNZWV0aW5nU2VjdGlvbiB8IG51bGwgPSBudWxsO1xuICAgIC8vIFByaW1hcnk6IENTUyBjb2xvdXIgY2xhc3MgXHUyMDE0IHdvcmtzIGluIGFueSBsYW5ndWFnZVxuICAgIGlmIChjbHMuaW5jbHVkZXMoXCJ0ZWFsLTcwMFwiKSkgc2VjID0gXCJ0cmVhc3VyZXNcIjtcbiAgICBlbHNlIGlmIChjbHMuaW5jbHVkZXMoXCJnb2xkLTcwMFwiKSkgc2VjID0gXCJtaW5pc3RyeVwiO1xuICAgIGVsc2UgaWYgKGNscy5pbmNsdWRlcyhcIm1hcm9vbi02MDBcIikpIHNlYyA9IFwibGl2aW5nXCI7XG4gICAgLy8gRmFsbGJhY2s6IEVuZ2xpc2ggc2VjdGlvbiB0ZXh0XG4gICAgZWxzZSBpZiAodGV4dC5pbmNsdWRlcyhcIlRSRUFTVVJFU1wiKSkgc2VjID0gXCJ0cmVhc3VyZXNcIjtcbiAgICBlbHNlIGlmICh0ZXh0LmluY2x1ZGVzKFwiQVBQTFkgWU9VUlNFTEZcIikgfHwgdGV4dC5pbmNsdWRlcyhcIkZJRUxEIE1JTklTVFJZXCIpKSBzZWMgPSBcIm1pbmlzdHJ5XCI7XG4gICAgZWxzZSBpZiAodGV4dC5pbmNsdWRlcyhcIkxJVklORyBBUyBDSFJJU1RJQU5TXCIpKSBzZWMgPSBcImxpdmluZ1wiO1xuICAgIGlmIChzZWMpIGJvdW5kYXJpZXMucHVzaCh7IHBvczogaDJtLmluZGV4LCBzZWN0aW9uOiBzZWMsIGxhYmVsOiBjbGVhblRleHQoaDJtWzJdKSB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNlY3Rpb25Gb3JQb3MocG9zOiBudW1iZXIpOiBNZWV0aW5nU2VjdGlvbiB7XG4gICAgbGV0IHNlYzogTWVldGluZ1NlY3Rpb24gPSBcIm9wZW5pbmdcIjtcbiAgICBmb3IgKGNvbnN0IGIgb2YgYm91bmRhcmllcykge1xuICAgICAgaWYgKHBvcyA+PSBiLnBvcykgc2VjID0gYi5zZWN0aW9uO1xuICAgIH1cbiAgICByZXR1cm4gc2VjO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFBhcnNlIGgzIGVsZW1lbnRzIGludG8gcHJvZ3JhbW1lIHBhcnRzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBwYXJ0czogTWVldGluZ1BhcnRbXSA9IFtdO1xuICBsZXQgb3JkZXIgPSAwO1xuXG4gIC8vIENhcHR1cmVzOiBbMV0gaDMgYXR0cnMsIFsyXSBoMyBpbm5lciBIVE1MLCBbM10gc2libGluZyBib2R5IEhUTUwgdW50aWwgbmV4dCBoMy9oMlxuICBjb25zdCBoM1JlID0gLzxoMyhbXj5dKik+KFtcXHNcXFNdKj8pPFxcL2gzPihbXFxzXFxTXSo/KSg/PTxoM3w8aDJ8PFxcL2FydGljbGV8JCkvZ2k7XG4gIGxldCBoM206IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG4gIHdoaWxlICgoaDNtID0gaDNSZS5leGVjKGh0bWwpKSAhPT0gbnVsbCkge1xuICAgIGNvbnN0IGgzQXR0cnMgICA9IGgzbVsxXTtcbiAgICBjb25zdCB0aXRsZUh0bWwgPSBoM21bMl07XG4gICAgY29uc3QgYm9keUh0bWwgID0gaDNtWzNdID8/IFwiXCI7XG4gICAgY29uc3QgdGl0bGUgICAgID0gY2xlYW5UZXh0KHRpdGxlSHRtbCk7XG4gICAgY29uc3QgYm9keVRleHQgID0gY2xlYW5UZXh0KGJvZHlIdG1sKTtcbiAgICBjb25zdCBwb3MgICAgICAgPSBoM20uaW5kZXg7XG5cbiAgICBjb25zdCBpc1NvbmcgPSBoM0F0dHJzLmluY2x1ZGVzKFwiZGMtaWNvbi0tbXVzaWNcIik7XG5cbiAgICBpZiAoaXNTb25nKSB7XG4gICAgICBjb25zdCBkdXJJblRpdGxlID0gcGFyc2VEdXJhdGlvbih0aXRsZSk7XG5cbiAgICAgIGlmIChkdXJJblRpdGxlID09PSBudWxsKSB7XG4gICAgICAgIC8vIE1pZC1tZWV0aW5nIHNvbmcgc2VwYXJhdG9yOiBjb3VudGVkIGZvciBzY2hlZHVsZSB0aW1pbmcgYnV0IG5vIHN0b3B3YXRjaCBzaG93blxuICAgICAgICBwYXJ0cy5wdXNoKHtcbiAgICAgICAgICBsYWJlbDogdGl0bGUsXG4gICAgICAgICAgc2VjdGlvbjogc2VjdGlvbkZvclBvcyhwb3MpLFxuICAgICAgICAgIGR1cmF0aW9uU2VjOiA1ICogNjAsXG4gICAgICAgICAgb3JkZXI6IG9yZGVyKyssXG4gICAgICAgICAgaXNTZXBhcmF0b3I6IHRydWUsXG4gICAgICAgIH0pO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gT3BlbmluZyBzb25nIGgzOiBcIlNvbmcgODYgYW5kIFByYXllciB8IE9wZW5pbmcgQ29tbWVudHMgKDEgbWluLilcIlxuICAgICAgLy8gT25seSBzdXJmYWNlIHRoZSBwcm9ncmFtbWUgbGFiZWwgKHRoZSBwaXBlIHNlZ21lbnQgdGhhdCBoYXMgdGhlIGR1cmF0aW9uKVxuICAgICAgY29uc3QgbGFiZWwgPSBsYWJlbEZyb21QaXBlU2VnbWVudCh0aXRsZSk7XG4gICAgICBpZiAoIWxhYmVsKSBjb250aW51ZTtcbiAgICAgIHBhcnRzLnB1c2goeyBsYWJlbCwgc2VjdGlvbjogc2VjdGlvbkZvclBvcyhwb3MpLCBkdXJhdGlvblNlYzogZHVySW5UaXRsZSwgb3JkZXI6IG9yZGVyKysgfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBSZWd1bGFyIHByb2dyYW1tZSBwYXJ0IFx1MjAxNCBkdXJhdGlvbiBtYXkgYmUgaW4gdGhlIGgzIHRpdGxlIChjbG9zaW5nIHJvdykgb3IgaW4gYm9keVxuICAgIGNvbnN0IGR1ckluVGl0bGUgPSBwYXJzZUR1cmF0aW9uKHRpdGxlKTtcbiAgICBjb25zdCBkdXJJbkJvZHkgID0gcGFyc2VEdXJhdGlvbihib2R5VGV4dC5zbGljZSgwLCAyMDApKTtcbiAgICBjb25zdCBkdXJhdGlvblNlYyA9IGR1ckluVGl0bGUgPz8gZHVySW5Cb2R5O1xuICAgIGlmIChkdXJhdGlvblNlYyA9PT0gbnVsbCkgY29udGludWU7XG5cbiAgICAvLyBDbG9zaW5nIGgzOiBcIkNvbmNsdWRpbmcgQ29tbWVudHMgKDMgbWluLikgfCBTb25nIE4gYW5kIFByYXllclwiXG4gICAgaWYgKHRpdGxlLmluY2x1ZGVzKFwifFwiKSkge1xuICAgICAgY29uc3QgbGFiZWwgPSBsYWJlbEZyb21QaXBlU2VnbWVudCh0aXRsZSk7XG4gICAgICBpZiAoIWxhYmVsKSBjb250aW51ZTtcbiAgICAgIHBhcnRzLnB1c2goeyBsYWJlbCwgc2VjdGlvbjogXCJjbG9zaW5nXCIsIGR1cmF0aW9uU2VjLCBvcmRlcjogb3JkZXIrKyB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIE5vcm1hbCBudW1iZXJlZCBwYXJ0IFx1MjAxNCBzdHJpcCBkdXJhdGlvbiBhbm5vdGF0aW9uIGZyb20gbGFiZWxcbiAgICBjb25zdCBjbGVhbkxhYmVsID0gdGl0bGUucmVwbGFjZShEVVJBVElPTl9SRSwgXCJcIikucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xuICAgIHBhcnRzLnB1c2goeyBsYWJlbDogY2xlYW5MYWJlbCwgc2VjdGlvbjogc2VjdGlvbkZvclBvcyhwb3MpLCBkdXJhdGlvblNlYywgb3JkZXI6IG9yZGVyKysgfSk7XG4gIH1cblxuICBpZiAocGFydHMubGVuZ3RoIDwgNSkgcmV0dXJuIG51bGw7XG5cbiAgY29uc3Qgc2VjdGlvbkxhYmVsczogUGFydGlhbDxSZWNvcmQ8TWVldGluZ1NlY3Rpb24sIHN0cmluZz4+ID0ge307XG4gIGZvciAoY29uc3QgYiBvZiBib3VuZGFyaWVzKSB7XG4gICAgc2VjdGlvbkxhYmVsc1tiLnNlY3Rpb25dID0gYi5sYWJlbDtcbiAgfVxuXG4gIHJldHVybiB7IHdlZWtMYWJlbCwgeWVhciwgd2Vla051bWJlcjogd2VlaywgcGFydHMsIGZldGNoZWRBdDogRGF0ZS5ub3coKSwgc2VjdGlvbkxhYmVscyB9O1xufVxuXG4vKipcbiAqIEZvciBwaXBlLXNlcGFyYXRlZCBoMyB0aXRsZXMgKG9wZW5pbmcgb3IgY2xvc2luZyByb3dzKSwgcmV0dXJucyB0aGUgc2VnbWVudFxuICogdGhhdCBjb250YWlucyB0aGUgZHVyYXRpb24gYW5ub3RhdGlvbiwgd2l0aCB0aGF0IGFubm90YXRpb24gc3RyaXBwZWQuXG4gKlxuICogXCJTb25nIDg2IGFuZCBQcmF5ZXIgfCBPcGVuaW5nIENvbW1lbnRzICgxIG1pbi4pXCIgIFx1MjE5MiBcIk9wZW5pbmcgQ29tbWVudHNcIlxuICogXCJDYW5jaVx1MDBGM24gODYgeSBvcmFjaVx1MDBGM24gfCBQYWxhYnJhcyBkZSBpbnRyb2R1Y2NpXHUwMEYzbiAoMSBtaW4uKVwiIFx1MjE5MiBcIlBhbGFicmFzIGRlIGludHJvZHVjY2lcdTAwRjNuXCJcbiAqIFwiQ29uY2x1ZGluZyBDb21tZW50cyAoMyBtaW4uKSB8IFNvbmcgNzAgYW5kIFByYXllclwiIFx1MjE5MiBcIkNvbmNsdWRpbmcgQ29tbWVudHNcIlxuICovXG5mdW5jdGlvbiBsYWJlbEZyb21QaXBlU2VnbWVudCh0aXRsZTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gIGNvbnN0IHNlZ21lbnRzID0gdGl0bGUuc3BsaXQoXCJ8XCIpLm1hcChzID0+IHMudHJpbSgpKTtcbiAgY29uc3Qgd2l0aER1ciA9IHNlZ21lbnRzLmZpbmQocyA9PiBEVVJBVElPTl9SRS50ZXN0KHMpKTtcbiAgaWYgKCF3aXRoRHVyKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIHdpdGhEdXIucmVwbGFjZShEVVJBVElPTl9SRSwgXCJcIikucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpIHx8IG51bGw7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxtQkFBdUI7OztBQ29FaEIsSUFBTSxtQkFBbUM7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
