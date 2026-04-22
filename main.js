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
    const section = sectionForPos(pos);
    const hasAdvice = section === "ministry" || section === "treasures" && h3Attrs.includes("dc-icon--bible");
    parts.push({ label: cleanLabel, section, durationSec, order: order++, ...hasAdvice ? { hasAdvice } : {} });
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
var LOCALE_UI = {
  "lp-e": { play: "Play", pause: "Pause", reset: "Reset", resetAll: "Reset All", today: "Today", advice: "Advice" },
  "lp-s": { play: "Iniciar", pause: "Pausar", reset: "Reiniciar", resetAll: "Reiniciar todo", today: "Hoy", advice: "Consejo" },
  "lp-f": { play: "D\xE9marrer", pause: "Pause", reset: "R\xE9init.", resetAll: "Tout r\xE9init.", today: "Auj.", advice: "Conseil" },
  "lp-t": { play: "Iniciar", pause: "Pausar", reset: "Reiniciar", resetAll: "Reiniciar tudo", today: "Hoje", advice: "Conselho" },
  "lp-g": { play: "Start", pause: "Pause", reset: "Zur\xFCcksetzen", resetAll: "Alles zur\xFCcksetzen", today: "Heute", advice: "Rat" },
  "lp-i": { play: "Avvia", pause: "Pausa", reset: "Azzera", resetAll: "Azzera tutto", today: "Oggi", advice: "Consiglio" },
  "lp-u": { play: "\u0421\u0442\u0430\u0440\u0442", pause: "\u041F\u0430\u0443\u0437\u0430", reset: "\u0421\u043A\u0438\u043D\u0443\u0442\u0438", resetAll: "\u0421\u043A\u0438\u043D\u0443\u0442\u0438 \u0432\u0441\u0435", today: "\u0421\u044C\u043E\u0433\u043E\u0434\u043D\u0456", advice: "\u041F\u043E\u0440\u0430\u0434\u0430" },
  "lp-d": { play: "Start", pause: "Pauze", reset: "Reset", resetAll: "Alles resetten", today: "Vandaag", advice: "Advies" },
  "lp-p": { play: "Start", pause: "Pauza", reset: "Resetuj", resetAll: "Resetuj wszystko", today: "Dzi\u015B", advice: "Rada" },
  "lp-j": { play: "\u30B9\u30BF\u30FC\u30C8", pause: "\u4E00\u6642\u505C\u6B62", reset: "\u30EA\u30BB\u30C3\u30C8", resetAll: "\u5168\u30EA\u30BB\u30C3\u30C8", today: "\u4ECA\u65E5", advice: "\u52A9\u8A00" },
  "lp-ko": { play: "\uC2DC\uC791", pause: "\uC77C\uC2DC\uC815\uC9C0", reset: "\uCD08\uAE30\uD654", resetAll: "\uC804\uCCB4 \uCD08\uAE30\uD654", today: "\uC624\uB298", advice: "\uC870\uC5B8" },
  "lp-chs": { play: "\u5F00\u59CB", pause: "\u6682\u505C", reset: "\u91CD\u7F6E", resetAll: "\u5168\u90E8\u91CD\u7F6E", today: "\u4ECA\u5929", advice: "\u6307\u5BFC" }
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
    this.adviceCards = /* @__PURE__ */ new Map();
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
    this.todayBtn = navEl.createEl("button", { cls: "jw-timer-nav-today", text: this.getLabels().today });
    this.todayBtn.setAttr("aria-label", "Jump to current week");
    this.todayBtn.style.display = "none";
    prevBtn.addEventListener("click", () => void this.navigateWeek(-1));
    nextBtn.addEventListener("click", () => void this.navigateWeek(1));
    this.todayBtn.addEventListener("click", () => void this.navigateToToday());
    const toolbar = root.createDiv({ cls: "jw-timer-toolbar" });
    this.resetAllBtn = toolbar.createEl("button", {
      cls: "jw-timer-btn jw-timer-btn-reset-all",
      text: this.getLabels().resetAll
    });
    this.resetAllBtn.addEventListener("click", () => this.handleResetAll());
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
    this.adviceCards.clear();
    this.listEl.empty();
    const labels = this.getLabels();
    this.resetAllBtn.setText(labels.resetAll);
    this.todayBtn.setText(labels.today);
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
    this.adviceCards.clear();
    this.listEl.empty();
    await this.loadScheduleForWeek(y, w);
  }
  // ─── Today helpers ──────────────────────────────────────────────────────────
  // ─── Locale helpers ──────────────────────────────────────────────────────────
  getLang() {
    return this.plugin.settings.wolLocale.split("/")[1] ?? "lp-e";
  }
  getLabels() {
    return LOCALE_UI[this.getLang()] ?? LOCALE_UI["lp-e"];
  }
  /** Virtual partOrder for advice timer — avoids clash with real part orders (≤ ~20). */
  adviceOrder(partOrder) {
    return 1e3 + partOrder;
  }
  // ─── Today helpers ────────────────────────────────────────────────────────
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
    this.adviceCards.clear();
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
    this.adviceCards.clear();
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
    const { play: playLabel, reset: resetLabel } = this.getLabels();
    const playBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-play", text: playLabel });
    playBtn.setAttr("aria-label", "Start timer");
    const resetBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-reset", text: resetLabel });
    resetBtn.setAttr("aria-label", "Reset timer");
    playBtn.addEventListener("click", () => this.handlePlayPause(part));
    resetBtn.addEventListener("click", () => this.handleReset(part));
    void endTimeEl;
    this.cards.set(part.order, { cardEl: card, elapsedEl, endTimeEl, stoppedAtEl, playBtn, resetBtn, barFillEl });
    this.updateCard(part, scheduledStartMins);
    if (part.hasAdvice) this.renderAdviceCard(parentEl, part);
  }
  // ─── Timer controls ─────────────────────────────────────────────────────────
  handlePlayPause(part) {
    const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
    if (snap.status === "running") {
      this.plugin.timerEngine.pause(this.weekKey, part.order);
      void this.plugin.persistTimers();
    } else {
      this.plugin.timerEngine.start(this.weekKey, part.order);
    }
    this.updateCardByOrder(part);
  }
  handleReset(part) {
    this.plugin.timerEngine.reset(this.weekKey, part.order);
    if (part.hasAdvice) {
      this.plugin.timerEngine.reset(this.weekKey, this.adviceOrder(part.order));
      this.updateAdviceCard(part);
    }
    this.updateCardByOrder(part);
    void this.plugin.persistTimers();
  }
  // ─── Tick & display update ───────────────────────────────────────────────────
  tick() {
    if (!this.schedule) return;
    for (const part of this.schedule.parts) {
      const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
      if (snap.status === "running") this.updateCardByOrder(part);
      if (part.hasAdvice) {
        const aSnap = this.plugin.timerEngine.get(this.weekKey, this.adviceOrder(part.order));
        if (aSnap.status === "running") this.updateAdviceCard(part);
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
    const labels = this.getLabels();
    if (status === "running") {
      refs.playBtn.setText(labels.pause);
      refs.playBtn.setAttr("aria-label", "Pause timer");
    } else {
      refs.playBtn.setText(labels.play);
      refs.playBtn.setAttr("aria-label", status === "paused" ? "Resume timer" : "Start timer");
    }
  }
  // ─── Reset All ────────────────────────────────────────────────────────────
  handleResetAll() {
    if (!this.schedule) return;
    for (const part of this.schedule.parts) {
      this.plugin.timerEngine.reset(this.weekKey, part.order);
      if (part.hasAdvice) this.plugin.timerEngine.reset(this.weekKey, this.adviceOrder(part.order));
    }
    this.renderSchedule(this.schedule);
    void this.plugin.persistTimers();
  }
  // ─── Advice card ────────────────────────────────────────────────────────────
  renderAdviceCard(parentEl, part) {
    const labels = this.getLabels();
    const card = parentEl.createDiv({ cls: "jw-timer-card jw-timer-card--advice" });
    card.setAttribute("data-state", "idle");
    card.setAttribute("data-running", "false");
    const badge = card.createDiv({ cls: "jw-timer-advice-badge" });
    badge.createSpan({ cls: "jw-timer-advice-icon", text: "\u21B3" });
    badge.createSpan({ cls: "jw-timer-advice-label", text: `${labels.advice} \xB7 1 min` });
    const barEl = card.createDiv({ cls: "jw-timer-bar" });
    const barFillEl = barEl.createDiv({ cls: "jw-timer-bar-fill" });
    const timeRow = card.createDiv({ cls: "jw-timer-time-row" });
    const endTimeEl = timeRow.createSpan();
    const stoppedAtEl = timeRow.createSpan({ cls: "jw-timer-stopped-at" });
    void endTimeEl;
    const clockRow = card.createDiv({ cls: "jw-timer-clock-row" });
    const elapsedEl = clockRow.createDiv({ cls: "jw-timer-elapsed jw-timer-elapsed--advice", text: "00:00" });
    const controls = card.createDiv({ cls: "jw-timer-controls" });
    const playBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-play", text: labels.play });
    playBtn.setAttr("aria-label", "Start advice timer");
    const resetBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-reset", text: labels.reset });
    resetBtn.setAttr("aria-label", "Reset advice timer");
    playBtn.addEventListener("click", () => this.handleAdvicePlayPause(part));
    resetBtn.addEventListener("click", () => this.handleAdviceReset(part));
    this.adviceCards.set(part.order, { cardEl: card, elapsedEl, endTimeEl, stoppedAtEl, playBtn, resetBtn, barFillEl });
    this.updateAdviceCard(part);
  }
  handleAdvicePlayPause(part) {
    const aOrder = this.adviceOrder(part.order);
    const snap = this.plugin.timerEngine.get(this.weekKey, aOrder);
    if (snap.status === "running") {
      this.plugin.timerEngine.pause(this.weekKey, aOrder);
      void this.plugin.persistTimers();
    } else {
      this.plugin.timerEngine.start(this.weekKey, aOrder);
    }
    this.updateAdviceCard(part);
  }
  handleAdviceReset(part) {
    this.plugin.timerEngine.reset(this.weekKey, this.adviceOrder(part.order));
    this.updateAdviceCard(part);
    void this.plugin.persistTimers();
  }
  updateAdviceCard(part) {
    const refs = this.adviceCards.get(part.order);
    if (!refs) return;
    const labels = this.getLabels();
    const ADVICE_SEC = 60;
    const snap = this.plugin.timerEngine.get(this.weekKey, this.adviceOrder(part.order));
    const { elapsedMs, status, stoppedAt } = snap;
    refs.elapsedEl.setText(formatMmSs(elapsedMs));
    refs.barFillEl.style.width = `${(Math.min(1, elapsedMs / (ADVICE_SEC * 1e3)) * 100).toFixed(1)}%`;
    if (status === "paused" && stoppedAt != null) {
      refs.stoppedAtEl.setText(`\xB7 ${timestampToHHMM(stoppedAt)}`);
    } else {
      refs.stoppedAtEl.setText("");
    }
    const state = colorState(elapsedMs, ADVICE_SEC, status);
    refs.cardEl.setAttribute("data-state", state);
    refs.cardEl.setAttribute("data-running", status === "running" ? "true" : "false");
    refs.playBtn.setText(status === "running" ? labels.pause : labels.play);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3R5cGVzLnRzIiwgInNyYy90aW1lci1lbmdpbmUudHMiLCAic3JjL3NldHRpbmdzLXRhYi50cyIsICJzcmMvdmlldy50cyIsICJzcmMvc2NyYXBlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBERUZBVUxUX1NFVFRJTkdTIH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB0eXBlIHsgUGx1Z2luU2V0dGluZ3MsIFBsdWdpbkRhdGEsIFdlZWtseVNjaGVkdWxlLCBUaW1lclN0YXRlIH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB7IFRpbWVyRW5naW5lIH0gZnJvbSBcIi4vdGltZXItZW5naW5lXCI7XG5pbXBvcnQgeyBKd1RpbWVyU2V0dGluZ3NUYWIgfSBmcm9tIFwiLi9zZXR0aW5ncy10YWJcIjtcbmltcG9ydCB7IEp3VGltZXJWaWV3LCBWSUVXX1RZUEVfSldfVElNRVIgfSBmcm9tIFwiLi92aWV3XCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEp3VGltZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5nczogUGx1Z2luU2V0dGluZ3MgPSB7IC4uLkRFRkFVTFRfU0VUVElOR1MgfTtcbiAgdGltZXJFbmdpbmUgPSBuZXcgVGltZXJFbmdpbmUoKTtcbiAgcHJpdmF0ZSBzY2hlZHVsZUNhY2hlOiBSZWNvcmQ8c3RyaW5nLCBXZWVrbHlTY2hlZHVsZT4gPSB7fTtcbiAgcHJpdmF0ZSBzYXZlSGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgTGlmZWN5Y2xlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLmxvYWREYXRhXygpO1xuXG4gICAgdGhpcy5yZWdpc3RlclZpZXcoVklFV19UWVBFX0pXX1RJTUVSLCAobGVhZikgPT4gbmV3IEp3VGltZXJWaWV3KGxlYWYsIHRoaXMpKTtcblxuICAgIHRoaXMuYWRkUmliYm9uSWNvbihcInRpbWVyXCIsIFwiT3BlbiBKVyBNZWV0aW5nIFRpbWVyXCIsICgpID0+IHZvaWQgdGhpcy5hY3RpdmF0ZVZpZXcoKSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwib3Blbi1qdy10aW1lclwiLFxuICAgICAgbmFtZTogXCJPcGVuIEpXIE1lZXRpbmcgVGltZXIgc2lkZWJhclwiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHZvaWQgdGhpcy5hY3RpdmF0ZVZpZXcoKSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgSndUaW1lclNldHRpbmdzVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB2b2lkIHRoaXMuYWN0aXZhdGVWaWV3KCkpO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuc2F2ZUhhbmRsZSAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnNhdmVIYW5kbGUpO1xuICAgICAgdGhpcy5zYXZlSGFuZGxlID0gbnVsbDtcbiAgICB9XG4gICAgdm9pZCB0aGlzLnBlcnNpc3RUaW1lcnMoKTtcbiAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9KV19USU1FUik7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2V0dGluZ3MgcGVyc2lzdGVuY2UgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMucGVyc2lzdERhdGEoKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgbG9hZERhdGFfKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJhdyA9IGF3YWl0IHRoaXMubG9hZERhdGEoKSBhcyBQYXJ0aWFsPFBsdWdpbkRhdGE+IHwgbnVsbDtcbiAgICBpZiAoIXJhdykgcmV0dXJuO1xuICAgIGlmIChyYXcuc2V0dGluZ3MpIHtcbiAgICAgIHRoaXMuc2V0dGluZ3MgPSB7IC4uLkRFRkFVTFRfU0VUVElOR1MsIC4uLnJhdy5zZXR0aW5ncyB9O1xuICAgIH1cbiAgICBpZiAocmF3LnNjaGVkdWxlQ2FjaGUpIHtcbiAgICAgIHRoaXMuc2NoZWR1bGVDYWNoZSA9IHJhdy5zY2hlZHVsZUNhY2hlO1xuICAgIH1cbiAgICBpZiAocmF3LnRpbWVyU3RhdGVzKSB7XG4gICAgICB0aGlzLnRpbWVyRW5naW5lLnJlc3RvcmUocmF3LnRpbWVyU3RhdGVzKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHBlcnNpc3REYXRhKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHRpbWVyU3RhdGVzOiBSZWNvcmQ8c3RyaW5nLCBUaW1lclN0YXRlPiA9IHt9O1xuICAgIGZvciAoY29uc3QgW2ssIHZdIG9mIHRoaXMudGltZXJFbmdpbmUuc25hcHNob3RBbGwoKSkge1xuICAgICAgdGltZXJTdGF0ZXNba10gPSB2O1xuICAgIH1cbiAgICBjb25zdCBkYXRhOiBQbHVnaW5EYXRhID0ge1xuICAgICAgc2V0dGluZ3M6IHRoaXMuc2V0dGluZ3MsXG4gICAgICBzY2hlZHVsZUNhY2hlOiB0aGlzLnNjaGVkdWxlQ2FjaGUsXG4gICAgICB0aW1lclN0YXRlcyxcbiAgICB9O1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEoZGF0YSk7XG4gIH1cblxuICBwcml2YXRlIHNjaGVkdWxlU2F2ZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5zYXZlSGFuZGxlICE9PSBudWxsKSB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuc2F2ZUhhbmRsZSk7XG4gICAgdGhpcy5zYXZlSGFuZGxlID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5zYXZlSGFuZGxlID0gbnVsbDtcbiAgICAgIHZvaWQgdGhpcy5wZXJzaXN0RGF0YSgpO1xuICAgIH0sIDUwMCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGltZXIgcGVyc2lzdGVuY2UgaGVscGVycyAoY2FsbGVkIGZyb20gdmlldykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgYXN5bmMgcGVyc2lzdFRpbWVycygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnBlcnNpc3REYXRhKCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2NoZWR1bGUgY2FjaGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgZ2V0Q2FjaGVkU2NoZWR1bGUoa2V5OiBzdHJpbmcpOiBXZWVrbHlTY2hlZHVsZSB8IG51bGwge1xuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMuc2NoZWR1bGVDYWNoZVtrZXldO1xuICAgIGlmICghY2FjaGVkKSByZXR1cm4gbnVsbDtcbiAgICAvLyBDYWNoZSBpcyB2YWxpZCBmb3IgMTIgaG91cnNcbiAgICBjb25zdCBzdGFsZSA9IERhdGUubm93KCkgLSBjYWNoZWQuZmV0Y2hlZEF0ID4gMTIgKiA2MCAqIDYwICogMTAwMDtcbiAgICByZXR1cm4gc3RhbGUgPyBudWxsIDogY2FjaGVkO1xuICB9XG5cbiAgY2FjaGVTY2hlZHVsZShrZXk6IHN0cmluZywgc2NoZWR1bGU6IFdlZWtseVNjaGVkdWxlKTogdm9pZCB7XG4gICAgdGhpcy5zY2hlZHVsZUNhY2hlW2tleV0gPSBzY2hlZHVsZTtcbiAgICB0aGlzLnNjaGVkdWxlU2F2ZSgpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNldHRpbmdzIGNoYW5nZSBoZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIGFzeW5jIGNsZWFyQ2FjaGVBbmRSZWZyZXNoKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2NoZWR1bGVDYWNoZSA9IHt9O1xuICAgIGF3YWl0IHRoaXMucGVyc2lzdERhdGEoKTtcbiAgICAvLyBSZWxvYWQgdGhlIG9wZW4gdmlldyBpZiBwcmVzZW50XG4gICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX0pXX1RJTUVSKVswXTtcbiAgICBpZiAobGVhZj8udmlldyBpbnN0YW5jZW9mIEp3VGltZXJWaWV3KSB7XG4gICAgICBhd2FpdCAobGVhZi52aWV3IGFzIEp3VGltZXJWaWV3KS5yZWxvYWQoKTtcbiAgICB9XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgVmlldyBhY3RpdmF0aW9uIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgYXN5bmMgYWN0aXZhdGVWaWV3KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfSldfVElNRVIpO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGgpIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGV4aXN0aW5nWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRSaWdodExlYWYoZmFsc2UpO1xuICAgIGlmICghbGVhZikgcmV0dXJuO1xuICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHsgdHlwZTogVklFV19UWVBFX0pXX1RJTUVSLCBhY3RpdmU6IHRydWUgfSk7XG4gICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XG4gIH1cbn1cbiIsICIvLyBcdTI1MDBcdTI1MDBcdTI1MDAgRG9tYWluIHR5cGVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgaW50ZXJmYWNlIE1lZXRpbmdQYXJ0IHtcbiAgLyoqIERpc3BsYXkgbGFiZWwgKGUuZy4gXCIxLiBIb3cgTXVjaCBBcmUgWW91IFdpbGxpbmcgdG8gUGF5P1wiKSAqL1xuICBsYWJlbDogc3RyaW5nO1xuICAvKiogU2VjdGlvbiB0aGlzIHBhcnQgYmVsb25ncyB0byAqL1xuICBzZWN0aW9uOiBNZWV0aW5nU2VjdGlvbjtcbiAgLyoqIEFsbG93ZWQgZHVyYXRpb24gaW4gc2Vjb25kcyAqL1xuICBkdXJhdGlvblNlYzogbnVtYmVyO1xuICAvKiogT3JkZXIgd2l0aGluIHRoZSBmdWxsIG1lZXRpbmcgcHJvZ3JhbW1lICovXG4gIG9yZGVyOiBudW1iZXI7XG4gIC8qKiBJZiB0cnVlLCB0aGlzIHBhcnQgaGFzIG5vIHN0b3B3YXRjaCBcdTIwMTQgaXRzIGR1cmF0aW9uIGlzIG9ubHkgdXNlZCBmb3Igc2NoZWR1bGUgdGltaW5nIChlLmcuIHNvbmcpICovXG4gIGlzU2VwYXJhdG9yPzogYm9vbGVhbjtcbiAgLyoqIElmIHRydWUsIGEgc2Vjb25kYXJ5IDEtbWludXRlIGluc3RydWN0b3ItYWR2aWNlIHN0b3B3YXRjaCBpcyBzaG93biBiZWxvdyB0aGlzIHBhcnQncyBjYXJkICovXG4gIGhhc0FkdmljZT86IGJvb2xlYW47XG59XG5cbmV4cG9ydCB0eXBlIE1lZXRpbmdTZWN0aW9uID1cbiAgfCBcIm9wZW5pbmdcIlxuICB8IFwidHJlYXN1cmVzXCJcbiAgfCBcIm1pbmlzdHJ5XCJcbiAgfCBcImxpdmluZ1wiXG4gIHwgXCJjbG9zaW5nXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgV2Vla2x5U2NoZWR1bGUge1xuICAvKiogSVNPIHdlZWsgbGFiZWwsIGUuZy4gXCJBcHJpbCAyMC0yNlwiICovXG4gIHdlZWtMYWJlbDogc3RyaW5nO1xuICAvKiogWWVhciAqL1xuICB5ZWFyOiBudW1iZXI7XG4gIC8qKiBJU08gd2VlayBudW1iZXIgKDEtNTMpICovXG4gIHdlZWtOdW1iZXI6IG51bWJlcjtcbiAgcGFydHM6IE1lZXRpbmdQYXJ0W107XG4gIC8qKiBXaGVuIHRoaXMgZGF0YSB3YXMgZmV0Y2hlZCAobXMgc2luY2UgZXBvY2gpICovXG4gIGZldGNoZWRBdDogbnVtYmVyO1xuICAvKiogU2NyYXBlZCBoMiBzZWN0aW9uIGhlYWRpbmdzIGluIHRoZSBwYWdlIGxhbmd1YWdlIChvcHRpb25hbCBcdTIwMTQgYWJzZW50IGluIG9sZCBjYWNoZSBlbnRyaWVzKSAqL1xuICBzZWN0aW9uTGFiZWxzPzogUGFydGlhbDxSZWNvcmQ8TWVldGluZ1NlY3Rpb24sIHN0cmluZz4+O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGltZXIgc3RhdGUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBpbnRlcmZhY2UgVGltZXJTdGF0ZSB7XG4gIHBhcnRPcmRlcjogbnVtYmVyO1xuICAvKiogQWNjdW11bGF0ZWQgZWxhcHNlZCBtcyAod2hlbiBwYXVzZWQpICovXG4gIGVsYXBzZWRNczogbnVtYmVyO1xuICBydW5uaW5nOiBib29sZWFuO1xuICAvKiogRGF0ZS5ub3coKSB3aGVuIHRoZSBsYXN0IHN0YXJ0IGhhcHBlbmVkICovXG4gIHN0YXJ0ZWRBdDogbnVtYmVyIHwgbnVsbDtcbiAgLyoqIERhdGUubm93KCkgd2hlbiB0aGUgdGltZXIgd2FzIGxhc3QgcGF1c2VkIChudWxsIGlmIG5ldmVyIHBhdXNlZCBvciBjdXJyZW50bHkgcnVubmluZykgKi9cbiAgc3RvcHBlZEF0PzogbnVtYmVyIHwgbnVsbDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFBlcnNpc3RlZCBwbHVnaW4gZGF0YSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGludGVyZmFjZSBQbHVnaW5EYXRhIHtcbiAgc2V0dGluZ3M6IFBsdWdpblNldHRpbmdzO1xuICAvKiogQ2FjaGVkIHNjaGVkdWxlLCBrZXllZCBieSBcIllZWVktV1dcIiAqL1xuICBzY2hlZHVsZUNhY2hlOiBSZWNvcmQ8c3RyaW5nLCBXZWVrbHlTY2hlZHVsZT47XG4gIC8qKiBUaW1lciBzdGF0ZXMsIGtleWVkIGJ5IFwiWVlZWS1XVzpwYXJ0T3JkZXJcIiAqL1xuICB0aW1lclN0YXRlczogUmVjb3JkPHN0cmluZywgVGltZXJTdGF0ZT47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGx1Z2luU2V0dGluZ3Mge1xuICAvKiogV09MIGxhbmd1YWdlIGxvY2FsZSwgZS5nLiBcInIxL2xwLWVcIiAoRW5nbGlzaCkgb3IgXCJyNC9scC1zXCIgKFNwYW5pc2gpICovXG4gIHdvbExvY2FsZTogc3RyaW5nO1xuICAvKiogTWVldGluZyBzdGFydCB0aW1lLCBISDpNTSAyNGggZm9ybWF0LCBlLmcuIFwiMjA6MDBcIiAqL1xuICBtZWV0aW5nU3RhcnRUaW1lOiBzdHJpbmc7XG4gIC8qKiBNaW51dGVzIGZvciBvcGVuaW5nIHNvbmcgKyBwcmF5ZXIgYmVmb3JlIGZpcnN0IHByb2dyYW1tZSBwYXJ0ICovXG4gIG9wZW5pbmdTb25nTWludXRlczogbnVtYmVyO1xufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogUGx1Z2luU2V0dGluZ3MgPSB7XG4gIHdvbExvY2FsZTogXCJyMS9scC1lXCIsXG4gIG1lZXRpbmdTdGFydFRpbWU6IFwiMjA6MDBcIixcbiAgb3BlbmluZ1NvbmdNaW51dGVzOiA1LFxufTtcbiIsICJpbXBvcnQgdHlwZSB7IFRpbWVyU3RhdGUgfSBmcm9tIFwiLi90eXBlc1wiO1xuXG5leHBvcnQgdHlwZSBUaW1lclN0YXR1cyA9IFwiaWRsZVwiIHwgXCJydW5uaW5nXCIgfCBcInBhdXNlZFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRpbWVyU25hcHNob3Qge1xuICBlbGFwc2VkTXM6IG51bWJlcjtcbiAgc3RhdHVzOiBUaW1lclN0YXR1cztcbiAgLyoqIFdhbGwtY2xvY2sgbXMgKERhdGUubm93KCkpIHdoZW4gdGhlIHRpbWVyIHdhcyBsYXN0IHBhdXNlZC4gbnVsbCB3aGVuIGlkbGUgb3IgcnVubmluZy4gKi9cbiAgc3RvcHBlZEF0OiBudW1iZXIgfCBudWxsO1xufVxuXG5leHBvcnQgY2xhc3MgVGltZXJFbmdpbmUge1xuICBwcml2YXRlIHN0YXRlcyA9IG5ldyBNYXA8c3RyaW5nLCBUaW1lclN0YXRlPigpO1xuXG4gIHByaXZhdGUga2V5KHdlZWtLZXk6IHN0cmluZywgcGFydE9yZGVyOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIHJldHVybiBgJHt3ZWVrS2V5fToke3BhcnRPcmRlcn1gO1xuICB9XG5cbiAgZ2V0KHdlZWtLZXk6IHN0cmluZywgcGFydE9yZGVyOiBudW1iZXIpOiBUaW1lclNuYXBzaG90IHtcbiAgICBjb25zdCBzdGF0ZSA9IHRoaXMuc3RhdGVzLmdldCh0aGlzLmtleSh3ZWVrS2V5LCBwYXJ0T3JkZXIpKTtcbiAgICBpZiAoIXN0YXRlKSByZXR1cm4geyBlbGFwc2VkTXM6IDAsIHN0YXR1czogXCJpZGxlXCIsIHN0b3BwZWRBdDogbnVsbCB9O1xuICAgIGNvbnN0IGVsYXBzZWQgPSBzdGF0ZS5ydW5uaW5nICYmIHN0YXRlLnN0YXJ0ZWRBdCAhPT0gbnVsbFxuICAgICAgPyBzdGF0ZS5lbGFwc2VkTXMgKyAoRGF0ZS5ub3coKSAtIHN0YXRlLnN0YXJ0ZWRBdClcbiAgICAgIDogc3RhdGUuZWxhcHNlZE1zO1xuICAgIGNvbnN0IHN0YXR1czogVGltZXJTdGF0dXMgPSBzdGF0ZS5ydW5uaW5nID8gXCJydW5uaW5nXCIgOiBzdGF0ZS5lbGFwc2VkTXMgPiAwID8gXCJwYXVzZWRcIiA6IFwiaWRsZVwiO1xuICAgIHJldHVybiB7IGVsYXBzZWRNczogZWxhcHNlZCwgc3RhdHVzLCBzdG9wcGVkQXQ6IHN0YXRlLnN0b3BwZWRBdCA/PyBudWxsIH07XG4gIH1cblxuICBzdGFydCh3ZWVrS2V5OiBzdHJpbmcsIHBhcnRPcmRlcjogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgayA9IHRoaXMua2V5KHdlZWtLZXksIHBhcnRPcmRlcik7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLnN0YXRlcy5nZXQoayk7XG4gICAgaWYgKGV4aXN0aW5nPy5ydW5uaW5nKSByZXR1cm47XG4gICAgdGhpcy5zdGF0ZXMuc2V0KGssIHtcbiAgICAgIHBhcnRPcmRlcixcbiAgICAgIGVsYXBzZWRNczogZXhpc3Rpbmc/LmVsYXBzZWRNcyA/PyAwLFxuICAgICAgcnVubmluZzogdHJ1ZSxcbiAgICAgIHN0YXJ0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9KTtcbiAgfVxuXG4gIHBhdXNlKHdlZWtLZXk6IHN0cmluZywgcGFydE9yZGVyOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBrID0gdGhpcy5rZXkod2Vla0tleSwgcGFydE9yZGVyKTtcbiAgICBjb25zdCBzdGF0ZSA9IHRoaXMuc3RhdGVzLmdldChrKTtcbiAgICBpZiAoIXN0YXRlPy5ydW5uaW5nKSByZXR1cm47XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICB0aGlzLnN0YXRlcy5zZXQoaywge1xuICAgICAgLi4uc3RhdGUsXG4gICAgICBlbGFwc2VkTXM6IHN0YXRlLmVsYXBzZWRNcyArIChub3cgLSAoc3RhdGUuc3RhcnRlZEF0ID8/IG5vdykpLFxuICAgICAgcnVubmluZzogZmFsc2UsXG4gICAgICBzdGFydGVkQXQ6IG51bGwsXG4gICAgICBzdG9wcGVkQXQ6IG5vdyxcbiAgICB9KTtcbiAgfVxuXG4gIHJlc2V0KHdlZWtLZXk6IHN0cmluZywgcGFydE9yZGVyOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLnN0YXRlcy5kZWxldGUodGhpcy5rZXkod2Vla0tleSwgcGFydE9yZGVyKSk7XG4gIH1cblxuICAvKiogU25hcHNob3QgYWxsIHN0YXRlcyBmb3IgcGVyc2lzdGVuY2UsIGZyZWV6aW5nIHJ1bm5pbmcgdGltZXJzLiAqL1xuICBzbmFwc2hvdEFsbCgpOiBNYXA8c3RyaW5nLCBUaW1lclN0YXRlPiB7XG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IE1hcDxzdHJpbmcsIFRpbWVyU3RhdGU+KCk7XG4gICAgZm9yIChjb25zdCBbaywgc3RhdGVdIG9mIHRoaXMuc3RhdGVzKSB7XG4gICAgICBpZiAoc3RhdGUucnVubmluZyAmJiBzdGF0ZS5zdGFydGVkQXQgIT09IG51bGwpIHtcbiAgICAgICAgcmVzdWx0LnNldChrLCB7XG4gICAgICAgICAgLi4uc3RhdGUsXG4gICAgICAgICAgZWxhcHNlZE1zOiBzdGF0ZS5lbGFwc2VkTXMgKyAoRGF0ZS5ub3coKSAtIHN0YXRlLnN0YXJ0ZWRBdCksXG4gICAgICAgICAgcnVubmluZzogZmFsc2UsXG4gICAgICAgICAgc3RhcnRlZEF0OiBudWxsLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdC5zZXQoaywgeyAuLi5zdGF0ZSB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKiBSZXN0b3JlIHN0YXRlcyBmcm9tIHBlcnNpc3RlZCBkYXRhIChhbGwgcGF1c2VkKS4gKi9cbiAgcmVzdG9yZShzYXZlZDogUmVjb3JkPHN0cmluZywgVGltZXJTdGF0ZT4pOiB2b2lkIHtcbiAgICB0aGlzLnN0YXRlcy5jbGVhcigpO1xuICAgIGZvciAoY29uc3QgW2ssIHN0YXRlXSBvZiBPYmplY3QuZW50cmllcyhzYXZlZCkpIHtcbiAgICAgIHRoaXMuc3RhdGVzLnNldChrLCB7IC4uLnN0YXRlLCBydW5uaW5nOiBmYWxzZSwgc3RhcnRlZEF0OiBudWxsIH0pO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgSndUaW1lclBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XG5pbXBvcnQgdHlwZSB7IFBsdWdpblNldHRpbmdzIH0gZnJvbSBcIi4vdHlwZXNcIjtcblxuLy8gQXZhaWxhYmxlIFdPTCBsb2NhbGVzOiBsYWJlbCBcdTIxOTIgbG9jYWxlIHBhdGggc2VnbWVudFxuY29uc3QgV09MX0xPQ0FMRVM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIFwiRW5nbGlzaFwiOiAgICBcInIxL2xwLWVcIixcbiAgXCJTcGFuaXNoXCI6ICAgIFwicjQvbHAtc1wiLFxuICBcIlBvcnR1Z3Vlc2VcIjogXCJyNS9scC10XCIsXG4gIFwiRnJlbmNoXCI6ICAgICBcInIzMC9scC1mXCIsXG4gIFwiSXRhbGlhblwiOiAgICBcInI2L2xwLWlcIixcbiAgXCJHZXJtYW5cIjogICAgIFwicjEwL2xwLWdcIixcbiAgXCJEdXRjaFwiOiAgICAgIFwicjEzL2xwLWRcIixcbiAgXCJKYXBhbmVzZVwiOiAgIFwicjcvbHAtalwiLFxuICBcIktvcmVhblwiOiAgICAgXCJyOC9scC1rb1wiLFxuICBcIkNoaW5lc2UgKFNpbXBsaWZpZWQpXCI6IFwicjIzL2xwLWNoc1wiLFxufTtcblxuZXhwb3J0IGNsYXNzIEp3VGltZXJTZXR0aW5nc1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSByZWFkb25seSBwbHVnaW46IEp3VGltZXJQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcblxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIkpXIE1lZXRpbmcgVGltZXIgXHUyMDE0IFNldHRpbmdzXCIgfSk7XG5cbiAgICAvLyBMYW5ndWFnZSAvIGxvY2FsZVxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJNZWV0aW5nIGxhbmd1YWdlXCIpXG4gICAgICAuc2V0RGVzYyhcIkxhbmd1YWdlIHVzZWQgdG8gZmV0Y2ggdGhlIHdlZWtseSBwcm9ncmFtbWUgZnJvbSB3b2wuancub3JnLlwiKVxuICAgICAgLmFkZERyb3Bkb3duKChkcm9wKSA9PiB7XG4gICAgICAgIGZvciAoY29uc3QgW2xhYmVsLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoV09MX0xPQ0FMRVMpKSB7XG4gICAgICAgICAgZHJvcC5hZGRPcHRpb24odmFsdWUsIGxhYmVsKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBJZiB0aGUgY3VycmVudCBsb2NhbGUgaXMgYSBrbm93biBkcm9wZG93biB2YWx1ZSwgc2VsZWN0IGl0OyBvdGhlcndpc2UgbGVhdmUgYXQgZGVmYXVsdFxuICAgICAgICBjb25zdCBrbm93blZhbHVlcyA9IE9iamVjdC52YWx1ZXMoV09MX0xPQ0FMRVMpO1xuICAgICAgICBpZiAoa25vd25WYWx1ZXMuaW5jbHVkZXModGhpcy5wbHVnaW4uc2V0dGluZ3Mud29sTG9jYWxlKSkge1xuICAgICAgICAgIGRyb3Auc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mud29sTG9jYWxlKTtcbiAgICAgICAgfVxuICAgICAgICBkcm9wLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLndvbExvY2FsZSA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIC8vIENsZWFyIHRoZSBjdXN0b20tbG9jYWxlIHRleHQgZmllbGQgc28gaXQgZG9lc25cdTIwMTl0IG1pc2xlYWRcbiAgICAgICAgICBpZiAoY3VzdG9tTG9jYWxlVGV4dCkgY3VzdG9tTG9jYWxlVGV4dC5zZXRWYWx1ZShcIlwiKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIC8vIEN1c3RvbSBsb2NhbGUgb3ZlcnJpZGVcbiAgICBsZXQgY3VzdG9tTG9jYWxlVGV4dDogaW1wb3J0KFwib2JzaWRpYW5cIikuVGV4dENvbXBvbmVudDtcbiAgICBjb25zdCBrbm93blZhbHVlcyA9IE9iamVjdC52YWx1ZXMoV09MX0xPQ0FMRVMpO1xuICAgIGNvbnN0IGN1cnJlbnRJc0N1c3RvbSA9ICFrbm93blZhbHVlcy5pbmNsdWRlcyh0aGlzLnBsdWdpbi5zZXR0aW5ncy53b2xMb2NhbGUpO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJDdXN0b20gbG9jYWxlIChhZHZhbmNlZClcIilcbiAgICAgIC5zZXREZXNjKFxuICAgICAgICAnT3ZlcnJpZGUgd2l0aCBhbnkgV09MIGxvY2FsZSBwYXRoLCBlLmcuIFwicjQvbHAtc1wiLiBMZWF2ZSBibGFuayB0byB1c2UgdGhlIGRyb3Bkb3duIHNlbGVjdGlvbi4nXG4gICAgICApXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT4ge1xuICAgICAgICBjdXN0b21Mb2NhbGVUZXh0ID0gdGV4dDtcbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcInIxL2xwLWVcIilcbiAgICAgICAgICAvLyBTaG93IHRoZSBzYXZlZCBjdXN0b20gdmFsdWUgb25seSB3aGVuIGl0IGlzblx1MjAxOXQgb25lIG9mIHRoZSBkcm9wZG93biBvcHRpb25zXG4gICAgICAgICAgLnNldFZhbHVlKGN1cnJlbnRJc0N1c3RvbSA/IHRoaXMucGx1Z2luLnNldHRpbmdzLndvbExvY2FsZSA6IFwiXCIpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcbiAgICAgICAgICAgIGlmICh0cmltbWVkKSB7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLndvbExvY2FsZSA9IHRyaW1tZWQ7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAvLyBNZWV0aW5nIHN0YXJ0IHRpbWVcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiTWVldGluZyBzdGFydCB0aW1lXCIpXG4gICAgICAuc2V0RGVzYygnMjQtaG91ciBmb3JtYXQsIGUuZy4gXCIyMDowMFwiIG9yIFwiMTg6MzBcIi4nKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+IHtcbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcIjIwOjAwXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm1lZXRpbmdTdGFydFRpbWUpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdHJpbW1lZCA9IHZhbHVlLnRyaW0oKTtcbiAgICAgICAgICAgIGlmICgvXlxcZHsxLDJ9OlxcZHsyfSQvLnRlc3QodHJpbW1lZCkpIHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MubWVldGluZ1N0YXJ0VGltZSA9IHRyaW1tZWQ7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAvLyBPcGVuaW5nIHNvbmcgZHVyYXRpb25cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiT3BlbmluZyBzb25nICsgcHJheWVyIChtaW51dGVzKVwiKVxuICAgICAgLnNldERlc2MoXCJGaXhlZCBtaW51dGVzIGJlZm9yZSB0aGUgZmlyc3QgcHJvZ3JhbW1lIHBhcnQgKHNvbmcgKyBwcmF5ZXIpLiBEZWZhdWx0OiA1LlwiKVxuICAgICAgLmFkZFNsaWRlcigoc2xpZGVyKSA9PiB7XG4gICAgICAgIHNsaWRlclxuICAgICAgICAgIC5zZXRMaW1pdHMoMSwgMTUsIDEpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5pbmdTb25nTWludXRlcylcbiAgICAgICAgICAuc2V0RHluYW1pY1Rvb2x0aXAoKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5pbmdTb25nTWludXRlcyA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIC8vIE1hbnVhbCByZWZyZXNoIGJ1dHRvblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJSZWZyZXNoIHNjaGVkdWxlXCIpXG4gICAgICAuc2V0RGVzYyhcIkNsZWFyIHRoZSBjYWNoZWQgc2NoZWR1bGUgYW5kIHJlLWZldGNoIGZyb20gd29sLmp3Lm9yZy5cIilcbiAgICAgIC5hZGRCdXR0b24oKGJ0bikgPT4ge1xuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dChcIlJlZnJlc2ggbm93XCIpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLmNsZWFyQ2FjaGVBbmRSZWZyZXNoKCk7XG4gICAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoXCJEb25lIFx1MjcxM1wiKTtcbiAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiBidG4uc2V0QnV0dG9uVGV4dChcIlJlZnJlc2ggbm93XCIpLCAyMDAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgfVxufVxuIiwgImltcG9ydCB7IEl0ZW1WaWV3LCBXb3Jrc3BhY2VMZWFmIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSBKd1RpbWVyUGx1Z2luIGZyb20gXCIuL21haW5cIjtcbmltcG9ydCB0eXBlIHsgV2Vla2x5U2NoZWR1bGUsIE1lZXRpbmdQYXJ0IH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB0eXBlIHsgVGltZXJTbmFwc2hvdCB9IGZyb20gXCIuL3RpbWVyLWVuZ2luZVwiO1xuaW1wb3J0IHsgY2FjaGVLZXksIGN1cnJlbnRXZWVrTnVtYmVyLCBmZXRjaFdlZWtTY2hlZHVsZSB9IGZyb20gXCIuL3NjcmFwZXJcIjtcblxuZXhwb3J0IGNvbnN0IFZJRVdfVFlQRV9KV19USU1FUiA9IFwianctdGltZXItc2lkZWJhclwiO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgQ29uc3RhbnRzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgV0FSTl9USFJFU0hPTEQgPSAwLjk7XG5cbi8vIEZhbGxiYWNrIHNlY3Rpb24gbGFiZWxzIFx1MjAxNCB1c2VkIHdoZW4gc2NyYXBlciBzZWN0aW9uTGFiZWxzIGlzIGFic2VudCAob2xkIGNhY2hlKVxuY29uc3QgU0VDVElPTl9GQUxMQkFDSzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgb3BlbmluZzogICBcIk9wZW5pbmdcIixcbiAgdHJlYXN1cmVzOiBcIlRyZWFzdXJlcyBmcm9tIEdvZCdzIFdvcmRcIixcbiAgbWluaXN0cnk6ICBcIkFwcGx5IFlvdXJzZWxmIHRvIHRoZSBNaW5pc3RyeVwiLFxuICBsaXZpbmc6ICAgIFwiTGl2aW5nIGFzIENocmlzdGlhbnNcIixcbiAgY2xvc2luZzogICBcIkNsb3NpbmdcIixcbn07XG5cbi8vIE9wZW5pbmcvQ2xvc2luZyBsYWJlbHMgcGVyIGxvY2FsZSBsYW5ndWFnZSBjb2RlIChXT0wgb25seSBoYXMgaDIgZm9yIHRoZSAzIG1pZGRsZSBzZWN0aW9ucylcbmNvbnN0IExPQ0FMRV9PUEVOSU5HX0NMT1NJTkc6IFJlY29yZDxzdHJpbmcsIFtzdHJpbmcsIHN0cmluZ10+ID0ge1xuICBcImxwLWVcIjogICBbXCJPcGVuaW5nXCIsICAgIFwiQ2xvc2luZ1wiXSxcbiAgXCJscC1zXCI6ICAgW1wiQXBlcnR1cmFcIiwgICBcIkNvbmNsdXNpXHUwMEYzblwiXSxcbiAgXCJscC1mXCI6ICAgW1wiT3V2ZXJ0dXJlXCIsICBcIkNvbmNsdXNpb25cIl0sXG4gIFwibHAtdFwiOiAgIFtcIkFiZXJ0dXJhXCIsICAgXCJDb25jbHVzXHUwMEUzb1wiXSxcbiAgXCJscC1nXCI6ICAgW1wiRXJcdTAwRjZmZm51bmdcIiwgIFwiQWJzY2hsdXNzXCJdLFxuICBcImxwLWlcIjogICBbXCJBcGVydHVyYVwiLCAgIFwiQ29uY2x1c2lvbmVcIl0sXG4gIFwibHAtdVwiOiAgIFtcIlx1MDQxRFx1MDQzMFx1MDQ0N1x1MDQzMFx1MDQzQlx1MDQzRVwiLCAgICAgXCJcdTA0MTdcdTA0MzBcdTA0M0FcdTA0M0JcdTA0NEVcdTA0NDdcdTA0MzVcdTA0M0RcdTA0MzhcdTA0MzVcIl0sXG4gIFwibHAtZFwiOiAgIFtcIk9wZW5pbmdcIiwgICAgXCJTbHVpdGluZ1wiXSxcbiAgXCJscC1wXCI6ICAgW1wiT3R3YXJjaWVcIiwgICBcIlpha29cdTAxNDRjemVuaWVcIl0sXG4gIFwibHAtY2hzXCI6IFtcIlx1NUYwMFx1NTczQVwiLCAgICAgICAgXCJcdTdFRDNcdTY3NUZcIl0sXG59O1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgSGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFVJIGxhYmVscyBwZXIgbG9jYWxlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5pbnRlcmZhY2UgVWlMYWJlbHMge1xuICBwbGF5OiBzdHJpbmc7XG4gIHBhdXNlOiBzdHJpbmc7XG4gIHJlc2V0OiBzdHJpbmc7XG4gIHJlc2V0QWxsOiBzdHJpbmc7XG4gIHRvZGF5OiBzdHJpbmc7XG4gIGFkdmljZTogc3RyaW5nO1xufVxuXG5jb25zdCBMT0NBTEVfVUk6IFJlY29yZDxzdHJpbmcsIFVpTGFiZWxzPiA9IHtcbiAgXCJscC1lXCI6ICAgeyBwbGF5OiBcIlBsYXlcIiwgICAgICBwYXVzZTogXCJQYXVzZVwiLCAgICAgIHJlc2V0OiBcIlJlc2V0XCIsICAgICAgICAgcmVzZXRBbGw6IFwiUmVzZXQgQWxsXCIsICAgICAgICAgICB0b2RheTogXCJUb2RheVwiLCAgICAgIGFkdmljZTogXCJBZHZpY2VcIiAgICB9LFxuICBcImxwLXNcIjogICB7IHBsYXk6IFwiSW5pY2lhclwiLCAgIHBhdXNlOiBcIlBhdXNhclwiLCAgICAgcmVzZXQ6IFwiUmVpbmljaWFyXCIsICAgICByZXNldEFsbDogXCJSZWluaWNpYXIgdG9kb1wiLCAgICAgIHRvZGF5OiBcIkhveVwiLCAgICAgICAgYWR2aWNlOiBcIkNvbnNlam9cIiAgIH0sXG4gIFwibHAtZlwiOiAgIHsgcGxheTogXCJEXFx1MDBlOW1hcnJlclwiLCAgcGF1c2U6IFwiUGF1c2VcIiwgICAgICByZXNldDogXCJSXFx1MDBlOWluaXQuXCIsICAgICAgIHJlc2V0QWxsOiBcIlRvdXQgclxcdTAwZTlpbml0LlwiLCAgICAgICAgdG9kYXk6IFwiQXVqLlwiLCAgICAgICBhZHZpY2U6IFwiQ29uc2VpbFwiICAgfSxcbiAgXCJscC10XCI6ICAgeyBwbGF5OiBcIkluaWNpYXJcIiwgICBwYXVzZTogXCJQYXVzYXJcIiwgICAgIHJlc2V0OiBcIlJlaW5pY2lhclwiLCAgICAgcmVzZXRBbGw6IFwiUmVpbmljaWFyIHR1ZG9cIiwgICAgICB0b2RheTogXCJIb2plXCIsICAgICAgIGFkdmljZTogXCJDb25zZWxob1wiICB9LFxuICBcImxwLWdcIjogICB7IHBsYXk6IFwiU3RhcnRcIiwgICAgIHBhdXNlOiBcIlBhdXNlXCIsICAgICAgcmVzZXQ6IFwiWnVyXFx1MDBmY2Nrc2V0emVuXCIsICByZXNldEFsbDogXCJBbGxlcyB6dXJcXHUwMGZjY2tzZXR6ZW5cIiwgIHRvZGF5OiBcIkhldXRlXCIsICAgICAgYWR2aWNlOiBcIlJhdFwiICAgICAgIH0sXG4gIFwibHAtaVwiOiAgIHsgcGxheTogXCJBdnZpYVwiLCAgICAgcGF1c2U6IFwiUGF1c2FcIiwgICAgICByZXNldDogXCJBenplcmFcIiwgICAgICAgIHJlc2V0QWxsOiBcIkF6emVyYSB0dXR0b1wiLCAgICAgICAgdG9kYXk6IFwiT2dnaVwiLCAgICAgICBhZHZpY2U6IFwiQ29uc2lnbGlvXCIgfSxcbiAgXCJscC11XCI6ICAgeyBwbGF5OiBcIlxcdTA0MjFcXHUwNDQyXFx1MDQzMFxcdTA0NDBcXHUwNDQyXCIsICAgICBwYXVzZTogXCJcXHUwNDFmXFx1MDQzMFxcdTA0NDNcXHUwNDM3XFx1MDQzMFwiLCAgICAgIHJlc2V0OiBcIlxcdTA0MjFcXHUwNDNhXFx1MDQzOFxcdTA0M2RcXHUwNDQzXFx1MDQ0MlxcdTA0MzhcIiwgICAgICAgcmVzZXRBbGw6IFwiXFx1MDQyMVxcdTA0M2FcXHUwNDM4XFx1MDQzZFxcdTA0NDNcXHUwNDQyXFx1MDQzOCBcXHUwNDMyXFx1MDQ0MVxcdTA0MzVcIiwgICAgICAgICB0b2RheTogXCJcXHUwNDIxXFx1MDQ0Y1xcdTA0M2VcXHUwNDMzXFx1MDQzZVxcdTA0MzRcXHUwNDNkXFx1MDQ1NlwiLCAgIGFkdmljZTogXCJcXHUwNDFmXFx1MDQzZVxcdTA0NDBcXHUwNDMwXFx1MDQzNFxcdTA0MzBcIiAgICB9LFxuICBcImxwLWRcIjogICB7IHBsYXk6IFwiU3RhcnRcIiwgICAgIHBhdXNlOiBcIlBhdXplXCIsICAgICAgcmVzZXQ6IFwiUmVzZXRcIiwgICAgICAgICByZXNldEFsbDogXCJBbGxlcyByZXNldHRlblwiLCAgICAgIHRvZGF5OiBcIlZhbmRhYWdcIiwgICAgYWR2aWNlOiBcIkFkdmllc1wiICAgIH0sXG4gIFwibHAtcFwiOiAgIHsgcGxheTogXCJTdGFydFwiLCAgICAgcGF1c2U6IFwiUGF1emFcIiwgICAgICByZXNldDogXCJSZXNldHVqXCIsICAgICAgIHJlc2V0QWxsOiBcIlJlc2V0dWogd3N6eXN0a29cIiwgICAgdG9kYXk6IFwiRHppXFx1MDE1YlwiLCAgICAgICBhZHZpY2U6IFwiUmFkYVwiICAgICAgfSxcbiAgXCJscC1qXCI6ICAgeyBwbGF5OiBcIlxcdTMwYjlcXHUzMGJmXFx1MzBmY1xcdTMwYzhcIiwgIHBhdXNlOiBcIlxcdTRlMDBcXHU2NjQyXFx1NTA1Y1xcdTZiNjJcIiwgICByZXNldDogXCJcXHUzMGVhXFx1MzBiYlxcdTMwYzNcXHUzMGM4XCIsICAgICAgIHJlc2V0QWxsOiBcIlxcdTUxNjhcXHUzMGVhXFx1MzBiYlxcdTMwYzNcXHUzMGM4XCIsICAgICAgICAgICAgdG9kYXk6IFwiXFx1NGVjYVxcdTY1ZTVcIiwgICAgICAgYWR2aWNlOiBcIlxcdTUyYTlcXHU4YTAwXCIgICAgICB9LFxuICBcImxwLWtvXCI6ICB7IHBsYXk6IFwiXFx1YzJkY1xcdWM3OTFcIiwgICAgICBwYXVzZTogXCJcXHVjNzdjXFx1YzJkY1xcdWM4MTVcXHVjOWMwXCIsICAgcmVzZXQ6IFwiXFx1Y2QwOFxcdWFlMzBcXHVkNjU0XCIsICAgICAgICByZXNldEFsbDogXCJcXHVjODA0XFx1Y2NiNCBcXHVjZDA4XFx1YWUzMFxcdWQ2NTRcIiwgICAgICAgICAgdG9kYXk6IFwiXFx1YzYyNFxcdWIyOThcIiwgICAgICAgYWR2aWNlOiBcIlxcdWM4NzBcXHVjNWI4XCIgICAgICB9LFxuICBcImxwLWNoc1wiOiB7IHBsYXk6IFwiXFx1NWYwMFxcdTU5Y2JcIiwgICAgICBwYXVzZTogXCJcXHU2NjgyXFx1NTA1Y1wiLCAgICAgICByZXNldDogXCJcXHU5MWNkXFx1N2Y2ZVwiLCAgICAgICAgICByZXNldEFsbDogXCJcXHU1MTY4XFx1OTBlOFxcdTkxY2RcXHU3ZjZlXCIsICAgICAgICAgICAgICAgdG9kYXk6IFwiXFx1NGVjYVxcdTU5MjlcIiwgICAgICAgYWR2aWNlOiBcIlxcdTYzMDdcXHU1YmZjXCIgICAgICB9LFxufTtcblxuZnVuY3Rpb24gZm9ybWF0TW1TcyhtczogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgdG90YWxTZWMgPSBNYXRoLm1heCgwLCBNYXRoLmZsb29yKG1zIC8gMTAwMCkpO1xuICBjb25zdCBtID0gTWF0aC5mbG9vcih0b3RhbFNlYyAvIDYwKTtcbiAgY29uc3QgcyA9IHRvdGFsU2VjICUgNjA7XG4gIHJldHVybiBgJHtTdHJpbmcobSkucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhzKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbn1cblxuZnVuY3Rpb24gdGltZVRvTWludXRlcyh0aW1lOiBzdHJpbmcpOiBudW1iZXIge1xuICBjb25zdCBbaGgsIG1tXSA9IHRpbWUuc3BsaXQoXCI6XCIpLm1hcChOdW1iZXIpO1xuICByZXR1cm4gKGhoID8/IDApICogNjAgKyAobW0gPz8gMCk7XG59XG5cbmZ1bmN0aW9uIG1pbnV0ZXNUb1RpbWUobWluczogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgaCA9IE1hdGguZmxvb3IobWlucyAvIDYwKSAlIDI0O1xuICBjb25zdCBtID0gbWlucyAlIDYwO1xuICByZXR1cm4gYCR7U3RyaW5nKGgpLnBhZFN0YXJ0KDIsIFwiMFwiKX06JHtTdHJpbmcobSkucGFkU3RhcnQoMiwgXCIwXCIpfWA7XG59XG5cbmZ1bmN0aW9uIHRpbWVzdGFtcFRvSEhNTShtczogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgZCA9IG5ldyBEYXRlKG1zKTtcbiAgcmV0dXJuIGAke1N0cmluZyhkLmdldEhvdXJzKCkpLnBhZFN0YXJ0KDIsIFwiMFwiKX06JHtTdHJpbmcoZC5nZXRNaW51dGVzKCkpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xufVxuXG4vKiogTnVtYmVyIG9mIElTTyB3ZWVrcyBpbiBhIHllYXIgKDUyIG9yIDUzKS4gRGVjIDI4IGlzIGFsd2F5cyBpbiB0aGUgbGFzdCBJU08gd2Vlay4gKi9cbmZ1bmN0aW9uIGlzb1dlZWtzSW5ZZWFyKHllYXI6IG51bWJlcik6IG51bWJlciB7XG4gIGNvbnN0IGQgPSBuZXcgRGF0ZShEYXRlLlVUQyh5ZWFyLCAxMSwgMjgpKTtcbiAgZC5zZXRVVENEYXRlKGQuZ2V0VVRDRGF0ZSgpICsgNCAtIChkLmdldFVUQ0RheSgpIHx8IDcpKTtcbiAgY29uc3QgeWVhclN0YXJ0ID0gbmV3IERhdGUoRGF0ZS5VVEMoZC5nZXRVVENGdWxsWWVhcigpLCAwLCAxKSk7XG4gIHJldHVybiBNYXRoLmNlaWwoKChkLmdldFRpbWUoKSAtIHllYXJTdGFydC5nZXRUaW1lKCkpIC8gODZfNDAwXzAwMCArIDEpIC8gNyk7XG59XG5cbnR5cGUgVGltZXJDb2xvclN0YXRlID0gXCJpZGxlXCIgfCBcIm9rXCIgfCBcIndhcm5cIiB8IFwib3ZlclwiO1xuXG5mdW5jdGlvbiBjb2xvclN0YXRlKGVsYXBzZWRNczogbnVtYmVyLCBkdXJhdGlvblNlYzogbnVtYmVyLCBzdGF0dXM6IFRpbWVyU25hcHNob3RbXCJzdGF0dXNcIl0pOiBUaW1lckNvbG9yU3RhdGUge1xuICBpZiAoc3RhdHVzID09PSBcImlkbGVcIikgcmV0dXJuIFwiaWRsZVwiO1xuICBjb25zdCByYXRpbyA9IGVsYXBzZWRNcyAvIChkdXJhdGlvblNlYyAqIDEwMDApO1xuICBpZiAocmF0aW8gPiAxKSByZXR1cm4gXCJvdmVyXCI7XG4gIGlmIChyYXRpbyA+PSBXQVJOX1RIUkVTSE9MRCkgcmV0dXJuIFwid2FyblwiO1xuICByZXR1cm4gXCJva1wiO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVHlwZXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmludGVyZmFjZSBDYXJkUmVmcyB7XG4gIGNhcmRFbDogSFRNTEVsZW1lbnQ7XG4gIGVsYXBzZWRFbDogSFRNTEVsZW1lbnQ7XG4gIGVuZFRpbWVFbDogSFRNTEVsZW1lbnQ7XG4gIHN0b3BwZWRBdEVsOiBIVE1MRWxlbWVudDtcbiAgcGxheUJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHJlc2V0QnRuOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgYmFyRmlsbEVsOiBIVE1MRWxlbWVudDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFZpZXcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBjbGFzcyBKd1RpbWVyVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgcHJpdmF0ZSBzY2hlZHVsZTogV2Vla2x5U2NoZWR1bGUgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSB3ZWVrS2V5ID0gXCJcIjtcbiAgcHJpdmF0ZSBjYXJkcyA9IG5ldyBNYXA8bnVtYmVyLCBDYXJkUmVmcz4oKTtcbiAgcHJpdmF0ZSBhZHZpY2VDYXJkcyA9IG5ldyBNYXA8bnVtYmVyLCBDYXJkUmVmcz4oKTtcbiAgcHJpdmF0ZSB0aWNrSGFuZGxlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBzdGF0dXNFbCE6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIG5hdkxhYmVsRWwhOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSB0b2RheUJ0biE6IEhUTUxCdXR0b25FbGVtZW50O1xuICBwcml2YXRlIHJlc2V0QWxsQnRuITogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHByaXZhdGUgbGlzdEVsITogSFRNTEVsZW1lbnQ7XG5cbiAgLy8gUGFnaW5hdGlvbiBzdGF0ZSBcdTIwMTQgaW5pdGlhbGlzZWQgdG8gY3VycmVudCB3ZWVrIGluIG9uT3BlblxuICBwcml2YXRlIHZpZXdZZWFyOiBudW1iZXIgPSBuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCk7XG4gIHByaXZhdGUgdmlld1dlZWs6IG51bWJlciA9IGN1cnJlbnRXZWVrTnVtYmVyKCk7XG5cbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZiwgcHJpdmF0ZSByZWFkb25seSBwbHVnaW46IEp3VGltZXJQbHVnaW4pIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7IHJldHVybiBWSUVXX1RZUEVfSldfVElNRVI7IH1cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHsgcmV0dXJuIFwiSlcgTWVldGluZyBUaW1lclwiOyB9XG4gIGdldEljb24oKTogc3RyaW5nIHsgcmV0dXJuIFwidGltZXJcIjsgfVxuXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCByb290ID0gdGhpcy5jb250ZW50RWw7XG4gICAgcm9vdC5lbXB0eSgpO1xuICAgIHJvb3QuYWRkQ2xhc3MoXCJqdy10aW1lci1yb290XCIpO1xuXG4gICAgLy8gXHUyNTAwXHUyNTAwIFdlZWsgbmF2aWdhdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICBjb25zdCBuYXZFbCA9IHJvb3QuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLW5hdlwiIH0pO1xuICAgIGNvbnN0IHByZXZCdG4gPSBuYXZFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJqdy10aW1lci1uYXYtYnRuXCIsIHRleHQ6IFwiXHUyNUMwXCIgfSk7XG4gICAgcHJldkJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIlByZXZpb3VzIHdlZWtcIik7XG4gICAgdGhpcy5uYXZMYWJlbEVsID0gbmF2RWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLW5hdi1sYWJlbFwiIH0pO1xuICAgIGNvbnN0IG5leHRCdG4gPSBuYXZFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJqdy10aW1lci1uYXYtYnRuXCIsIHRleHQ6IFwiXHUyNUI2XCIgfSk7XG4gICAgbmV4dEJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIk5leHQgd2Vla1wiKTtcbiAgICB0aGlzLnRvZGF5QnRuID0gbmF2RWwuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwianctdGltZXItbmF2LXRvZGF5XCIsIHRleHQ6IHRoaXMuZ2V0TGFiZWxzKCkudG9kYXkgfSk7XG4gICAgdGhpcy50b2RheUJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIkp1bXAgdG8gY3VycmVudCB3ZWVrXCIpO1xuICAgIHRoaXMudG9kYXlCdG4uc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICAgIHByZXZCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHZvaWQgdGhpcy5uYXZpZ2F0ZVdlZWsoLTEpKTtcbiAgICBuZXh0QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB2b2lkIHRoaXMubmF2aWdhdGVXZWVrKCsxKSk7XG4gICAgdGhpcy50b2RheUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdm9pZCB0aGlzLm5hdmlnYXRlVG9Ub2RheSgpKTtcblxuICAgIC8vIFx1MjUwMFx1MjUwMCBSZXNldC1hbGwgdG9vbGJhciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgICBjb25zdCB0b29sYmFyID0gcm9vdC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItdG9vbGJhclwiIH0pO1xuICAgIHRoaXMucmVzZXRBbGxCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgIGNsczogXCJqdy10aW1lci1idG4ganctdGltZXItYnRuLXJlc2V0LWFsbFwiLFxuICAgICAgdGV4dDogdGhpcy5nZXRMYWJlbHMoKS5yZXNldEFsbCxcbiAgICB9KTtcbiAgICB0aGlzLnJlc2V0QWxsQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB0aGlzLmhhbmRsZVJlc2V0QWxsKCkpO1xuXG4gICAgLy8gXHUyNTAwXHUyNTAwIFN0YXR1cyArIGxpc3QgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gICAgdGhpcy5zdGF0dXNFbCA9IHJvb3QuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLXN0YXR1c1wiIH0pO1xuICAgIHRoaXMubGlzdEVsID0gcm9vdC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItbGlzdFwiIH0pO1xuXG4gICAgdGhpcy50aWNrSGFuZGxlID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHRoaXMudGljaygpLCAyNTApO1xuXG4gICAgdGhpcy52aWV3WWVhciA9IG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKTtcbiAgICB0aGlzLnZpZXdXZWVrID0gY3VycmVudFdlZWtOdW1iZXIoKTtcbiAgICBhd2FpdCB0aGlzLmxvYWRTY2hlZHVsZUZvcldlZWsodGhpcy52aWV3WWVhciwgdGhpcy52aWV3V2Vlayk7XG4gIH1cblxuICBhc3luYyBvbkNsb3NlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLnRpY2tIYW5kbGUgIT09IG51bGwpIHtcbiAgICAgIHdpbmRvdy5jbGVhckludGVydmFsKHRoaXMudGlja0hhbmRsZSk7XG4gICAgICB0aGlzLnRpY2tIYW5kbGUgPSBudWxsO1xuICAgIH1cbiAgICBhd2FpdCB0aGlzLnBsdWdpbi5wZXJzaXN0VGltZXJzKCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgUHVibGljOiBjYWxsZWQgd2hlbiBzZXR0aW5ncyBjaGFuZ2UgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgYXN5bmMgcmVsb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2NoZWR1bGUgPSBudWxsO1xuICAgIHRoaXMuY2FyZHMuY2xlYXIoKTtcbiAgICB0aGlzLmFkdmljZUNhcmRzLmNsZWFyKCk7XG4gICAgdGhpcy5saXN0RWwuZW1wdHkoKTtcbiAgICBjb25zdCBsYWJlbHMgPSB0aGlzLmdldExhYmVscygpO1xuICAgIHRoaXMucmVzZXRBbGxCdG4uc2V0VGV4dChsYWJlbHMucmVzZXRBbGwpO1xuICAgIHRoaXMudG9kYXlCdG4uc2V0VGV4dChsYWJlbHMudG9kYXkpO1xuICAgIGF3YWl0IHRoaXMubG9hZFNjaGVkdWxlRm9yV2Vlayh0aGlzLnZpZXdZZWFyLCB0aGlzLnZpZXdXZWVrKTtcbiAgfVxuXG4gIC8vIFx1MjUwMFx1MjUwMFx1MjUwMCBXZWVrIG5hdmlnYXRpb24gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgcHJpdmF0ZSBhc3luYyBuYXZpZ2F0ZVdlZWsoZGVsdGE6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIGxldCB3ID0gdGhpcy52aWV3V2VlayArIGRlbHRhO1xuICAgIGxldCB5ID0gdGhpcy52aWV3WWVhcjtcbiAgICBpZiAodyA8IDEpIHtcbiAgICAgIHktLTtcbiAgICAgIHcgPSBpc29XZWVrc0luWWVhcih5KTtcbiAgICB9IGVsc2UgaWYgKHcgPiBpc29XZWVrc0luWWVhcih5KSkge1xuICAgICAgeSsrO1xuICAgICAgdyA9IDE7XG4gICAgfVxuICAgIHRoaXMudmlld1llYXIgPSB5O1xuICAgIHRoaXMudmlld1dlZWsgPSB3O1xuICAgIHRoaXMuc2NoZWR1bGUgPSBudWxsO1xuICAgIHRoaXMuY2FyZHMuY2xlYXIoKTtcbiAgICB0aGlzLmFkdmljZUNhcmRzLmNsZWFyKCk7XG4gICAgdGhpcy5saXN0RWwuZW1wdHkoKTtcbiAgICBhd2FpdCB0aGlzLmxvYWRTY2hlZHVsZUZvcldlZWsoeSwgdyk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgVG9kYXkgaGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgTG9jYWxlIGhlbHBlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgcHJpdmF0ZSBnZXRMYW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMucGx1Z2luLnNldHRpbmdzLndvbExvY2FsZS5zcGxpdChcIi9cIilbMV0gPz8gXCJscC1lXCI7XG4gIH1cblxuICBwcml2YXRlIGdldExhYmVscygpOiBVaUxhYmVscyB7XG4gICAgcmV0dXJuIExPQ0FMRV9VSVt0aGlzLmdldExhbmcoKV0gPz8gTE9DQUxFX1VJW1wibHAtZVwiXTtcbiAgfVxuXG4gIC8qKiBWaXJ0dWFsIHBhcnRPcmRlciBmb3IgYWR2aWNlIHRpbWVyIFx1MjAxNCBhdm9pZHMgY2xhc2ggd2l0aCByZWFsIHBhcnQgb3JkZXJzIChcdTIyNjQgfjIwKS4gKi9cbiAgcHJpdmF0ZSBhZHZpY2VPcmRlcihwYXJ0T3JkZXI6IG51bWJlcik6IG51bWJlciB7XG4gICAgcmV0dXJuIDEwMDAgKyBwYXJ0T3JkZXI7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgVG9kYXkgaGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIGlzQ3VycmVudFdlZWsoKTogYm9vbGVhbiB7XG4gICAgY29uc3QgeWVhciA9IG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKTtcbiAgICBjb25zdCB3ZWVrID0gY3VycmVudFdlZWtOdW1iZXIoKTtcbiAgICByZXR1cm4gdGhpcy52aWV3WWVhciA9PT0geWVhciAmJiB0aGlzLnZpZXdXZWVrID09PSB3ZWVrO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVUb2RheVZpc2liaWxpdHkoKTogdm9pZCB7XG4gICAgdGhpcy50b2RheUJ0bi5zdHlsZS5kaXNwbGF5ID0gdGhpcy5pc0N1cnJlbnRXZWVrKCkgPyBcIm5vbmVcIiA6IFwiXCI7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIG5hdmlnYXRlVG9Ub2RheSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnZpZXdZZWFyID0gbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpO1xuICAgIHRoaXMudmlld1dlZWsgPSBjdXJyZW50V2Vla051bWJlcigpO1xuICAgIHRoaXMuc2NoZWR1bGUgPSBudWxsO1xuICAgIHRoaXMuY2FyZHMuY2xlYXIoKTtcbiAgICB0aGlzLmFkdmljZUNhcmRzLmNsZWFyKCk7XG4gICAgdGhpcy5saXN0RWwuZW1wdHkoKTtcbiAgICBhd2FpdCB0aGlzLmxvYWRTY2hlZHVsZUZvcldlZWsodGhpcy52aWV3WWVhciwgdGhpcy52aWV3V2Vlayk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2NoZWR1bGUgbG9hZGluZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIGFzeW5jIGxvYWRTY2hlZHVsZUZvcldlZWsoeWVhcjogbnVtYmVyLCB3ZWVrOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLndlZWtLZXkgPSBjYWNoZUtleSh5ZWFyLCB3ZWVrKTtcbiAgICB0aGlzLm5hdkxhYmVsRWwuc2V0VGV4dChgJHt5ZWFyfSBcdTAwQjcgVyR7U3RyaW5nKHdlZWspLnBhZFN0YXJ0KDIsIFwiMFwiKX1gKTtcblxuICAgIGxldCBzY2hlZHVsZSA9IHRoaXMucGx1Z2luLmdldENhY2hlZFNjaGVkdWxlKHRoaXMud2Vla0tleSk7XG5cbiAgICBpZiAoIXNjaGVkdWxlKSB7XG4gICAgICB0aGlzLnNldFN0YXR1cyhcImxvYWRpbmdcIiwgXCJGZXRjaGluZyBzY2hlZHVsZSBmcm9tIHdvbC5qdy5vcmdcdTIwMjZcIik7XG4gICAgICBzY2hlZHVsZSA9IGF3YWl0IGZldGNoV2Vla1NjaGVkdWxlKHRoaXMucGx1Z2luLnNldHRpbmdzLndvbExvY2FsZSwgeWVhciwgd2Vlayk7XG4gICAgICBpZiAoc2NoZWR1bGUpIHtcbiAgICAgICAgdGhpcy5wbHVnaW4uY2FjaGVTY2hlZHVsZSh0aGlzLndlZWtLZXksIHNjaGVkdWxlKTtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFzY2hlZHVsZSkge1xuICAgICAgdGhpcy5zZXRTdGF0dXMoXCJlcnJvclwiLCBcIkNvdWxkIG5vdCBsb2FkIHNjaGVkdWxlLiBDaGVjayB5b3VyIGNvbm5lY3Rpb24gYW5kIGxhbmd1YWdlIHNldHRpbmcuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc2NoZWR1bGUgPSBzY2hlZHVsZTtcbiAgICB0aGlzLm5hdkxhYmVsRWwuc2V0VGV4dChzY2hlZHVsZS53ZWVrTGFiZWwpO1xuICAgIHRoaXMuc2V0U3RhdHVzKFwib2tcIiwgXCJcIik7XG4gICAgdGhpcy5yZW5kZXJTY2hlZHVsZShzY2hlZHVsZSk7XG4gICAgdGhpcy51cGRhdGVUb2RheVZpc2liaWxpdHkoKTtcbiAgfVxuXG4gIHByaXZhdGUgc2V0U3RhdHVzKHR5cGU6IFwib2tcIiB8IFwibG9hZGluZ1wiIHwgXCJlcnJvclwiLCB0ZXh0OiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLnN0YXR1c0VsLmVtcHR5KCk7XG4gICAgdGhpcy5zdGF0dXNFbC5jbGFzc05hbWUgPSBganctdGltZXItc3RhdHVzIGp3LXRpbWVyLXN0YXR1cy0tJHt0eXBlfWA7XG4gICAgdGhpcy5zdGF0dXNFbC5zZXRUZXh0KHRleHQpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFJlbmRlciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIHJlbmRlclNjaGVkdWxlKHNjaGVkdWxlOiBXZWVrbHlTY2hlZHVsZSk6IHZvaWQge1xuICAgIHRoaXMubGlzdEVsLmVtcHR5KCk7XG4gICAgdGhpcy5jYXJkcy5jbGVhcigpO1xuICAgIHRoaXMuYWR2aWNlQ2FyZHMuY2xlYXIoKTtcblxuICAgIGNvbnN0IHN0YXJ0TWludXRlcyA9IHRpbWVUb01pbnV0ZXModGhpcy5wbHVnaW4uc2V0dGluZ3MubWVldGluZ1N0YXJ0VGltZSk7XG4gICAgbGV0IGN1cnNvciA9IHN0YXJ0TWludXRlcyArIHRoaXMucGx1Z2luLnNldHRpbmdzLm9wZW5pbmdTb25nTWludXRlcztcblxuICAgIGNvbnN0IHNjaGVkdWxlZFN0YXJ0ID0gbmV3IE1hcDxudW1iZXIsIG51bWJlcj4oKTtcbiAgICBmb3IgKGNvbnN0IHBhcnQgb2Ygc2NoZWR1bGUucGFydHMpIHtcbiAgICAgIHNjaGVkdWxlZFN0YXJ0LnNldChwYXJ0Lm9yZGVyLCBjdXJzb3IpO1xuICAgICAgY3Vyc29yICs9IE1hdGguY2VpbChwYXJ0LmR1cmF0aW9uU2VjIC8gNjApO1xuICAgIH1cblxuICAgIC8vIE9wZW5pbmcvQ2xvc2luZyBsYWJlbHMgZnJvbSBsb2NhbGUgbWFwOyBtaWRkbGUgc2VjdGlvbnMgZnJvbSBzY3JhcGVyIChwYWdlIGxhbmd1YWdlKVxuICAgIGNvbnN0IGxhbmdLZXkgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy53b2xMb2NhbGUuc3BsaXQoXCIvXCIpWzFdID8/IFwibHAtZVwiO1xuICAgIGNvbnN0IFtvcGVuaW5nTGFiZWwsIGNsb3NpbmdMYWJlbF0gPSBMT0NBTEVfT1BFTklOR19DTE9TSU5HW2xhbmdLZXldID8/IFtcIk9wZW5pbmdcIiwgXCJDbG9zaW5nXCJdO1xuICAgIGNvbnN0IHNlY3Rpb25MYWJlbHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICAuLi5TRUNUSU9OX0ZBTExCQUNLLFxuICAgICAgLi4uKHNjaGVkdWxlLnNlY3Rpb25MYWJlbHMgPz8ge30pLFxuICAgICAgb3BlbmluZzogb3BlbmluZ0xhYmVsLFxuICAgICAgY2xvc2luZzogY2xvc2luZ0xhYmVsLFxuICAgIH07XG5cbiAgICAvLyBHcm91cCBwYXJ0cyBieSBzZWN0aW9uXG4gICAgY29uc3Qgc2VjdGlvbnMgPSBuZXcgTWFwPHN0cmluZywgTWVldGluZ1BhcnRbXT4oKTtcbiAgICBmb3IgKGNvbnN0IHBhcnQgb2Ygc2NoZWR1bGUucGFydHMpIHtcbiAgICAgIGNvbnN0IGxpc3QgPSBzZWN0aW9ucy5nZXQocGFydC5zZWN0aW9uKSA/PyBbXTtcbiAgICAgIGxpc3QucHVzaChwYXJ0KTtcbiAgICAgIHNlY3Rpb25zLnNldChwYXJ0LnNlY3Rpb24sIGxpc3QpO1xuICAgIH1cblxuICAgIGNvbnN0IHNlY3Rpb25PcmRlciA9IFtcIm9wZW5pbmdcIiwgXCJ0cmVhc3VyZXNcIiwgXCJtaW5pc3RyeVwiLCBcImxpdmluZ1wiLCBcImNsb3NpbmdcIl07XG4gICAgZm9yIChjb25zdCBzZWN0aW9uS2V5IG9mIHNlY3Rpb25PcmRlcikge1xuICAgICAgY29uc3QgcGFydHMgPSBzZWN0aW9ucy5nZXQoc2VjdGlvbktleSk7XG4gICAgICBpZiAoIXBhcnRzPy5sZW5ndGgpIGNvbnRpbnVlO1xuXG4gICAgICBjb25zdCBzZWN0aW9uRWwgPSB0aGlzLmxpc3RFbC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItc2VjdGlvblwiIH0pO1xuICAgICAgc2VjdGlvbkVsLmNyZWF0ZUVsKFwiaDNcIiwge1xuICAgICAgICBjbHM6IFwianctdGltZXItc2VjdGlvbi10aXRsZVwiLFxuICAgICAgICB0ZXh0OiBzZWN0aW9uTGFiZWxzW3NlY3Rpb25LZXldID8/IHNlY3Rpb25LZXksXG4gICAgICB9KTtcblxuICAgICAgZm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzKSB7XG4gICAgICAgIGlmIChwYXJ0LmlzU2VwYXJhdG9yKSBjb250aW51ZTtcbiAgICAgICAgdGhpcy5yZW5kZXJDYXJkKHNlY3Rpb25FbCwgcGFydCwgc2NoZWR1bGVkU3RhcnQuZ2V0KHBhcnQub3JkZXIpID8/IHN0YXJ0TWludXRlcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJDYXJkKHBhcmVudEVsOiBIVE1MRWxlbWVudCwgcGFydDogTWVldGluZ1BhcnQsIHNjaGVkdWxlZFN0YXJ0TWluczogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgY2FyZCA9IHBhcmVudEVsLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jYXJkXCIgfSk7XG4gICAgY2FyZC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXN0YXRlXCIsIFwiaWRsZVwiKTtcbiAgICBjYXJkLnNldEF0dHJpYnV0ZShcImRhdGEtcnVubmluZ1wiLCBcImZhbHNlXCIpO1xuXG4gICAgLy8gVGl0bGUgKyBhbGxvdHRlZCBtaW51dGVzXG4gICAgY29uc3QgaGVhZGVyID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItY2FyZC1oZWFkZXJcIiB9KTtcbiAgICBoZWFkZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNhcmQtdGl0bGVcIiwgdGV4dDogcGFydC5sYWJlbCB9KTtcbiAgICBoZWFkZXIuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNhcmQtYWxsb3R0ZWRcIiwgdGV4dDogYCR7TWF0aC5yb3VuZChwYXJ0LmR1cmF0aW9uU2VjIC8gNjApfSBtaW5gIH0pO1xuXG4gICAgLy8gU2NoZWR1bGVkIGVuZCB0aW1lICsgYWN0dWFsIHN0b3BwZWQtYXQgdGltZVxuICAgIGNvbnN0IGVuZFRpbWVNaW5zID0gc2NoZWR1bGVkU3RhcnRNaW5zICsgTWF0aC5jZWlsKHBhcnQuZHVyYXRpb25TZWMgLyA2MCk7XG4gICAgY29uc3QgdGltZVJvdyA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLXRpbWUtcm93XCIgfSk7XG4gICAgY29uc3QgZW5kVGltZUVsID0gdGltZVJvdy5jcmVhdGVTcGFuKHtcbiAgICAgIGNsczogXCJqdy10aW1lci1lbmQtdGltZVwiLFxuICAgICAgdGV4dDogYEVuZCAke21pbnV0ZXNUb1RpbWUoZW5kVGltZU1pbnMpfWAsXG4gICAgfSk7XG4gICAgY29uc3Qgc3RvcHBlZEF0RWwgPSB0aW1lUm93LmNyZWF0ZVNwYW4oeyBjbHM6IFwianctdGltZXItc3RvcHBlZC1hdFwiIH0pO1xuXG4gICAgLy8gUHJvZ3Jlc3MgYmFyXG4gICAgY29uc3QgYmFyRWwgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1iYXJcIiB9KTtcbiAgICBjb25zdCBiYXJGaWxsRWwgPSBiYXJFbC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItYmFyLWZpbGxcIiB9KTtcblxuICAgIC8vIExhcmdlIGVsYXBzZWQgY2xvY2tcbiAgICBjb25zdCBjbG9ja1JvdyA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNsb2NrLXJvd1wiIH0pO1xuICAgIGNvbnN0IGVsYXBzZWRFbCA9IGNsb2NrUm93LmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1lbGFwc2VkXCIsIHRleHQ6IFwiMDA6MDBcIiB9KTtcblxuICAgIC8vIENvbnRyb2xzXG4gICAgY29uc3QgY29udHJvbHMgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jb250cm9sc1wiIH0pO1xuICAgIGNvbnN0IHsgcGxheTogcGxheUxhYmVsLCByZXNldDogcmVzZXRMYWJlbCB9ID0gdGhpcy5nZXRMYWJlbHMoKTtcbiAgICBjb25zdCBwbGF5QnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwianctdGltZXItYnRuIGp3LXRpbWVyLWJ0bi1wbGF5XCIsIHRleHQ6IHBsYXlMYWJlbCB9KTtcbiAgICBwbGF5QnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiU3RhcnQgdGltZXJcIik7XG4gICAgY29uc3QgcmVzZXRCdG4gPSBjb250cm9scy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJqdy10aW1lci1idG4ganctdGltZXItYnRuLXJlc2V0XCIsIHRleHQ6IHJlc2V0TGFiZWwgfSk7XG4gICAgcmVzZXRCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJSZXNldCB0aW1lclwiKTtcblxuICAgIHBsYXlCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHRoaXMuaGFuZGxlUGxheVBhdXNlKHBhcnQpKTtcbiAgICByZXNldEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5oYW5kbGVSZXNldChwYXJ0KSk7XG5cbiAgICAvLyBTdXBwcmVzcyB1bnVzZWQtdmFyIHdhcm5pbmcgXHUyMDE0IGVuZFRpbWVFbCBjb250ZW50IGlzIHNldCBvbmNlIGFuZCBuZXZlciBjaGFuZ2VzXG4gICAgdm9pZCBlbmRUaW1lRWw7XG5cbiAgICB0aGlzLmNhcmRzLnNldChwYXJ0Lm9yZGVyLCB7IGNhcmRFbDogY2FyZCwgZWxhcHNlZEVsLCBlbmRUaW1lRWwsIHN0b3BwZWRBdEVsLCBwbGF5QnRuLCByZXNldEJ0biwgYmFyRmlsbEVsIH0pO1xuICAgIHRoaXMudXBkYXRlQ2FyZChwYXJ0LCBzY2hlZHVsZWRTdGFydE1pbnMpO1xuXG4gICAgLy8gQWR2aWNlIHN1Yi1jYXJkIGZvciBwYXJ0cyB3aXRoIGluc3RydWN0b3IgZmVlZGJhY2sgKEJpYmxlIHJlYWRpbmcgKyBtaW5pc3RyeSBwYXJ0cylcbiAgICBpZiAocGFydC5oYXNBZHZpY2UpIHRoaXMucmVuZGVyQWR2aWNlQ2FyZChwYXJlbnRFbCwgcGFydCk7XG4gIH1cblxuICAvLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGltZXIgY29udHJvbHMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbiAgcHJpdmF0ZSBoYW5kbGVQbGF5UGF1c2UocGFydDogTWVldGluZ1BhcnQpOiB2b2lkIHtcbiAgICBjb25zdCBzbmFwID0gdGhpcy5wbHVnaW4udGltZXJFbmdpbmUuZ2V0KHRoaXMud2Vla0tleSwgcGFydC5vcmRlcik7XG4gICAgaWYgKHNuYXAuc3RhdHVzID09PSBcInJ1bm5pbmdcIikge1xuICAgICAgdGhpcy5wbHVnaW4udGltZXJFbmdpbmUucGF1c2UodGhpcy53ZWVrS2V5LCBwYXJ0Lm9yZGVyKTtcbiAgICAgIHZvaWQgdGhpcy5wbHVnaW4ucGVyc2lzdFRpbWVycygpOyAvLyBwZXJzaXN0IGVsYXBzZWQgdGltZSBvbiBwYXVzZVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBsdWdpbi50aW1lckVuZ2luZS5zdGFydCh0aGlzLndlZWtLZXksIHBhcnQub3JkZXIpO1xuICAgIH1cbiAgICB0aGlzLnVwZGF0ZUNhcmRCeU9yZGVyKHBhcnQpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVSZXNldChwYXJ0OiBNZWV0aW5nUGFydCk6IHZvaWQge1xuICAgIHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLnJlc2V0KHRoaXMud2Vla0tleSwgcGFydC5vcmRlcik7XG4gICAgaWYgKHBhcnQuaGFzQWR2aWNlKSB7XG4gICAgICB0aGlzLnBsdWdpbi50aW1lckVuZ2luZS5yZXNldCh0aGlzLndlZWtLZXksIHRoaXMuYWR2aWNlT3JkZXIocGFydC5vcmRlcikpO1xuICAgICAgdGhpcy51cGRhdGVBZHZpY2VDYXJkKHBhcnQpO1xuICAgIH1cbiAgICB0aGlzLnVwZGF0ZUNhcmRCeU9yZGVyKHBhcnQpO1xuICAgIHZvaWQgdGhpcy5wbHVnaW4ucGVyc2lzdFRpbWVycygpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRpY2sgJiBkaXNwbGF5IHVwZGF0ZSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIHRpY2soKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnNjaGVkdWxlKSByZXR1cm47XG4gICAgZm9yIChjb25zdCBwYXJ0IG9mIHRoaXMuc2NoZWR1bGUucGFydHMpIHtcbiAgICAgIGNvbnN0IHNuYXAgPSB0aGlzLnBsdWdpbi50aW1lckVuZ2luZS5nZXQodGhpcy53ZWVrS2V5LCBwYXJ0Lm9yZGVyKTtcbiAgICAgIGlmIChzbmFwLnN0YXR1cyA9PT0gXCJydW5uaW5nXCIpIHRoaXMudXBkYXRlQ2FyZEJ5T3JkZXIocGFydCk7XG4gICAgICBpZiAocGFydC5oYXNBZHZpY2UpIHtcbiAgICAgICAgY29uc3QgYVNuYXAgPSB0aGlzLnBsdWdpbi50aW1lckVuZ2luZS5nZXQodGhpcy53ZWVrS2V5LCB0aGlzLmFkdmljZU9yZGVyKHBhcnQub3JkZXIpKTtcbiAgICAgICAgaWYgKGFTbmFwLnN0YXR1cyA9PT0gXCJydW5uaW5nXCIpIHRoaXMudXBkYXRlQWR2aWNlQ2FyZChwYXJ0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUNhcmRCeU9yZGVyKHBhcnQ6IE1lZXRpbmdQYXJ0KTogdm9pZCB7XG4gICAgY29uc3Qgc3RhcnRNaW51dGVzID0gdGltZVRvTWludXRlcyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5tZWV0aW5nU3RhcnRUaW1lKTtcbiAgICBsZXQgY3Vyc29yID0gc3RhcnRNaW51dGVzICsgdGhpcy5wbHVnaW4uc2V0dGluZ3Mub3BlbmluZ1NvbmdNaW51dGVzO1xuICAgIGxldCBzY2hlZHVsZWRTdGFydCA9IGN1cnNvcjtcbiAgICBmb3IgKGNvbnN0IHAgb2YgKHRoaXMuc2NoZWR1bGU/LnBhcnRzID8/IFtdKSkge1xuICAgICAgaWYgKHAub3JkZXIgPT09IHBhcnQub3JkZXIpIHsgc2NoZWR1bGVkU3RhcnQgPSBjdXJzb3I7IGJyZWFrOyB9XG4gICAgICBjdXJzb3IgKz0gTWF0aC5jZWlsKHAuZHVyYXRpb25TZWMgLyA2MCk7XG4gICAgfVxuICAgIHRoaXMudXBkYXRlQ2FyZChwYXJ0LCBzY2hlZHVsZWRTdGFydCk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUNhcmQocGFydDogTWVldGluZ1BhcnQsIHNjaGVkdWxlZFN0YXJ0TWluczogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgcmVmcyA9IHRoaXMuY2FyZHMuZ2V0KHBhcnQub3JkZXIpO1xuICAgIGlmICghcmVmcykgcmV0dXJuO1xuXG4gICAgY29uc3Qgc25hcCA9IHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLmdldCh0aGlzLndlZWtLZXksIHBhcnQub3JkZXIpO1xuICAgIGNvbnN0IHsgZWxhcHNlZE1zLCBzdGF0dXMsIHN0b3BwZWRBdCB9ID0gc25hcDtcbiAgICBjb25zdCBkdXJhdGlvbk1zID0gcGFydC5kdXJhdGlvblNlYyAqIDEwMDA7XG5cbiAgICAvLyBFbGFwc2VkIGNsb2NrXG4gICAgcmVmcy5lbGFwc2VkRWwuc2V0VGV4dChmb3JtYXRNbVNzKGVsYXBzZWRNcykpO1xuXG4gICAgLy8gUHJvZ3Jlc3MgYmFyXG4gICAgcmVmcy5iYXJGaWxsRWwuc3R5bGUud2lkdGggPSBgJHsoTWF0aC5taW4oMSwgZWxhcHNlZE1zIC8gZHVyYXRpb25NcykgKiAxMDApLnRvRml4ZWQoMSl9JWA7XG5cbiAgICAvLyBTdG9wcGVkLWF0IGluZGljYXRvciAoc2hvd24gb25seSB3aGVuIHBhdXNlZClcbiAgICBjb25zdCBlbmRUaW1lTWlucyA9IHNjaGVkdWxlZFN0YXJ0TWlucyArIE1hdGguY2VpbChwYXJ0LmR1cmF0aW9uU2VjIC8gNjApO1xuICAgIGlmIChzdGF0dXMgPT09IFwicGF1c2VkXCIgJiYgc3RvcHBlZEF0ICE9IG51bGwpIHtcbiAgICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShzdG9wcGVkQXQpO1xuICAgICAgY29uc3Qgc3RvcHBlZE1pbnMgPSBkLmdldEhvdXJzKCkgKiA2MCArIGQuZ2V0TWludXRlcygpO1xuICAgICAgY29uc3QgbGF0ZSA9IHN0b3BwZWRNaW5zID4gZW5kVGltZU1pbnM7XG4gICAgICByZWZzLnN0b3BwZWRBdEVsLnNldFRleHQoYFx1MDBCNyBTdG9wcGVkICR7dGltZXN0YW1wVG9ISE1NKHN0b3BwZWRBdCl9YCk7XG4gICAgICByZWZzLnN0b3BwZWRBdEVsLmNsYXNzTmFtZSA9IGxhdGVcbiAgICAgICAgPyBcImp3LXRpbWVyLXN0b3BwZWQtYXQganctdGltZXItc3RvcHBlZC1hdC0tbGF0ZVwiXG4gICAgICAgIDogXCJqdy10aW1lci1zdG9wcGVkLWF0XCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZnMuc3RvcHBlZEF0RWwuc2V0VGV4dChcIlwiKTtcbiAgICAgIHJlZnMuc3RvcHBlZEF0RWwuY2xhc3NOYW1lID0gXCJqdy10aW1lci1zdG9wcGVkLWF0XCI7XG4gICAgfVxuXG4gICAgLy8gQ2FyZCBjb2xvdXIgc3RhdGUgKyBydW5uaW5nIGluZGljYXRvciBmb3IgQ1NTXG4gICAgY29uc3Qgc3RhdGUgPSBjb2xvclN0YXRlKGVsYXBzZWRNcywgcGFydC5kdXJhdGlvblNlYywgc3RhdHVzKTtcbiAgICByZWZzLmNhcmRFbC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXN0YXRlXCIsIHN0YXRlKTtcbiAgICByZWZzLmNhcmRFbC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXJ1bm5pbmdcIiwgc3RhdHVzID09PSBcInJ1bm5pbmdcIiA/IFwidHJ1ZVwiIDogXCJmYWxzZVwiKTtcblxuICAgIC8vIFBsYXkvcGF1c2UgYnV0dG9uIGxhYmVsXG4gICAgY29uc3QgbGFiZWxzID0gdGhpcy5nZXRMYWJlbHMoKTtcbiAgICBpZiAoc3RhdHVzID09PSBcInJ1bm5pbmdcIikge1xuICAgICAgcmVmcy5wbGF5QnRuLnNldFRleHQobGFiZWxzLnBhdXNlKTtcbiAgICAgIHJlZnMucGxheUJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBcIlBhdXNlIHRpbWVyXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWZzLnBsYXlCdG4uc2V0VGV4dChsYWJlbHMucGxheSk7XG4gICAgICByZWZzLnBsYXlCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgc3RhdHVzID09PSBcInBhdXNlZFwiID8gXCJSZXN1bWUgdGltZXJcIiA6IFwiU3RhcnQgdGltZXJcIik7XG4gICAgfVxuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFJlc2V0IEFsbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuICBwcml2YXRlIGhhbmRsZVJlc2V0QWxsKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5zY2hlZHVsZSkgcmV0dXJuO1xuICAgIGZvciAoY29uc3QgcGFydCBvZiB0aGlzLnNjaGVkdWxlLnBhcnRzKSB7XG4gICAgICB0aGlzLnBsdWdpbi50aW1lckVuZ2luZS5yZXNldCh0aGlzLndlZWtLZXksIHBhcnQub3JkZXIpO1xuICAgICAgaWYgKHBhcnQuaGFzQWR2aWNlKSB0aGlzLnBsdWdpbi50aW1lckVuZ2luZS5yZXNldCh0aGlzLndlZWtLZXksIHRoaXMuYWR2aWNlT3JkZXIocGFydC5vcmRlcikpO1xuICAgIH1cbiAgICB0aGlzLnJlbmRlclNjaGVkdWxlKHRoaXMuc2NoZWR1bGUpO1xuICAgIHZvaWQgdGhpcy5wbHVnaW4ucGVyc2lzdFRpbWVycygpO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwXHUyNTAwIEFkdmljZSBjYXJkIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG4gIHByaXZhdGUgcmVuZGVyQWR2aWNlQ2FyZChwYXJlbnRFbDogSFRNTEVsZW1lbnQsIHBhcnQ6IE1lZXRpbmdQYXJ0KTogdm9pZCB7XG4gICAgY29uc3QgbGFiZWxzID0gdGhpcy5nZXRMYWJlbHMoKTtcbiAgICBjb25zdCBjYXJkID0gcGFyZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNhcmQganctdGltZXItY2FyZC0tYWR2aWNlXCIgfSk7XG4gICAgY2FyZC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXN0YXRlXCIsIFwiaWRsZVwiKTtcbiAgICBjYXJkLnNldEF0dHJpYnV0ZShcImRhdGEtcnVubmluZ1wiLCBcImZhbHNlXCIpO1xuXG4gICAgLy8gQmFkZ2U6IGFycm93IGljb24gKyBsYWJlbFxuICAgIGNvbnN0IGJhZGdlID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItYWR2aWNlLWJhZGdlXCIgfSk7XG4gICAgYmFkZ2UuY3JlYXRlU3Bhbih7IGNsczogXCJqdy10aW1lci1hZHZpY2UtaWNvblwiLCB0ZXh0OiBcIlx1MjFCM1wiIH0pO1xuICAgIGJhZGdlLmNyZWF0ZVNwYW4oeyBjbHM6IFwianctdGltZXItYWR2aWNlLWxhYmVsXCIsIHRleHQ6IGAke2xhYmVscy5hZHZpY2V9IFx1MDBCNyAxIG1pbmAgfSk7XG5cbiAgICAvLyBQcm9ncmVzcyBiYXJcbiAgICBjb25zdCBiYXJFbCA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWJhclwiIH0pO1xuICAgIGNvbnN0IGJhckZpbGxFbCA9IGJhckVsLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1iYXItZmlsbFwiIH0pO1xuXG4gICAgLy8gU3RvcHBlZC1hdCByb3dcbiAgICBjb25zdCB0aW1lUm93ID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItdGltZS1yb3dcIiB9KTtcbiAgICBjb25zdCBlbmRUaW1lRWwgPSB0aW1lUm93LmNyZWF0ZVNwYW4oKTtcbiAgICBjb25zdCBzdG9wcGVkQXRFbCA9IHRpbWVSb3cuY3JlYXRlU3Bhbih7IGNsczogXCJqdy10aW1lci1zdG9wcGVkLWF0XCIgfSk7XG4gICAgdm9pZCBlbmRUaW1lRWw7XG5cbiAgICAvLyBFbGFwc2VkIGNsb2NrXG4gICAgY29uc3QgY2xvY2tSb3cgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJqdy10aW1lci1jbG9jay1yb3dcIiB9KTtcbiAgICBjb25zdCBlbGFwc2VkRWwgPSBjbG9ja1Jvdy5jcmVhdGVEaXYoeyBjbHM6IFwianctdGltZXItZWxhcHNlZCBqdy10aW1lci1lbGFwc2VkLS1hZHZpY2VcIiwgdGV4dDogXCIwMDowMFwiIH0pO1xuXG4gICAgLy8gQ29udHJvbHNcbiAgICBjb25zdCBjb250cm9scyA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcImp3LXRpbWVyLWNvbnRyb2xzXCIgfSk7XG4gICAgY29uc3QgcGxheUJ0biA9IGNvbnRyb2xzLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcImp3LXRpbWVyLWJ0biBqdy10aW1lci1idG4tcGxheVwiLCB0ZXh0OiBsYWJlbHMucGxheSB9KTtcbiAgICBwbGF5QnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiU3RhcnQgYWR2aWNlIHRpbWVyXCIpO1xuICAgIGNvbnN0IHJlc2V0QnRuID0gY29udHJvbHMuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwianctdGltZXItYnRuIGp3LXRpbWVyLWJ0bi1yZXNldFwiLCB0ZXh0OiBsYWJlbHMucmVzZXQgfSk7XG4gICAgcmVzZXRCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJSZXNldCBhZHZpY2UgdGltZXJcIik7XG5cbiAgICBwbGF5QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB0aGlzLmhhbmRsZUFkdmljZVBsYXlQYXVzZShwYXJ0KSk7XG4gICAgcmVzZXRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHRoaXMuaGFuZGxlQWR2aWNlUmVzZXQocGFydCkpO1xuXG4gICAgdGhpcy5hZHZpY2VDYXJkcy5zZXQocGFydC5vcmRlciwgeyBjYXJkRWw6IGNhcmQsIGVsYXBzZWRFbCwgZW5kVGltZUVsLCBzdG9wcGVkQXRFbCwgcGxheUJ0biwgcmVzZXRCdG4sIGJhckZpbGxFbCB9KTtcbiAgICB0aGlzLnVwZGF0ZUFkdmljZUNhcmQocGFydCk7XG4gIH1cblxuICBwcml2YXRlIGhhbmRsZUFkdmljZVBsYXlQYXVzZShwYXJ0OiBNZWV0aW5nUGFydCk6IHZvaWQge1xuICAgIGNvbnN0IGFPcmRlciA9IHRoaXMuYWR2aWNlT3JkZXIocGFydC5vcmRlcik7XG4gICAgY29uc3Qgc25hcCA9IHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLmdldCh0aGlzLndlZWtLZXksIGFPcmRlcik7XG4gICAgaWYgKHNuYXAuc3RhdHVzID09PSBcInJ1bm5pbmdcIikge1xuICAgICAgdGhpcy5wbHVnaW4udGltZXJFbmdpbmUucGF1c2UodGhpcy53ZWVrS2V5LCBhT3JkZXIpO1xuICAgICAgdm9pZCB0aGlzLnBsdWdpbi5wZXJzaXN0VGltZXJzKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLnN0YXJ0KHRoaXMud2Vla0tleSwgYU9yZGVyKTtcbiAgICB9XG4gICAgdGhpcy51cGRhdGVBZHZpY2VDYXJkKHBhcnQpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVBZHZpY2VSZXNldChwYXJ0OiBNZWV0aW5nUGFydCk6IHZvaWQge1xuICAgIHRoaXMucGx1Z2luLnRpbWVyRW5naW5lLnJlc2V0KHRoaXMud2Vla0tleSwgdGhpcy5hZHZpY2VPcmRlcihwYXJ0Lm9yZGVyKSk7XG4gICAgdGhpcy51cGRhdGVBZHZpY2VDYXJkKHBhcnQpO1xuICAgIHZvaWQgdGhpcy5wbHVnaW4ucGVyc2lzdFRpbWVycygpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVBZHZpY2VDYXJkKHBhcnQ6IE1lZXRpbmdQYXJ0KTogdm9pZCB7XG4gICAgY29uc3QgcmVmcyA9IHRoaXMuYWR2aWNlQ2FyZHMuZ2V0KHBhcnQub3JkZXIpO1xuICAgIGlmICghcmVmcykgcmV0dXJuO1xuICAgIGNvbnN0IGxhYmVscyA9IHRoaXMuZ2V0TGFiZWxzKCk7XG4gICAgY29uc3QgQURWSUNFX1NFQyA9IDYwO1xuICAgIGNvbnN0IHNuYXAgPSB0aGlzLnBsdWdpbi50aW1lckVuZ2luZS5nZXQodGhpcy53ZWVrS2V5LCB0aGlzLmFkdmljZU9yZGVyKHBhcnQub3JkZXIpKTtcbiAgICBjb25zdCB7IGVsYXBzZWRNcywgc3RhdHVzLCBzdG9wcGVkQXQgfSA9IHNuYXA7XG5cbiAgICByZWZzLmVsYXBzZWRFbC5zZXRUZXh0KGZvcm1hdE1tU3MoZWxhcHNlZE1zKSk7XG4gICAgcmVmcy5iYXJGaWxsRWwuc3R5bGUud2lkdGggPSBgJHsoTWF0aC5taW4oMSwgZWxhcHNlZE1zIC8gKEFEVklDRV9TRUMgKiAxMDAwKSkgKiAxMDApLnRvRml4ZWQoMSl9JWA7XG5cbiAgICBpZiAoc3RhdHVzID09PSBcInBhdXNlZFwiICYmIHN0b3BwZWRBdCAhPSBudWxsKSB7XG4gICAgICByZWZzLnN0b3BwZWRBdEVsLnNldFRleHQoYFx1MDBCNyAke3RpbWVzdGFtcFRvSEhNTShzdG9wcGVkQXQpfWApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWZzLnN0b3BwZWRBdEVsLnNldFRleHQoXCJcIik7XG4gICAgfVxuXG4gICAgY29uc3Qgc3RhdGUgPSBjb2xvclN0YXRlKGVsYXBzZWRNcywgQURWSUNFX1NFQywgc3RhdHVzKTtcbiAgICByZWZzLmNhcmRFbC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXN0YXRlXCIsIHN0YXRlKTtcbiAgICByZWZzLmNhcmRFbC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXJ1bm5pbmdcIiwgc3RhdHVzID09PSBcInJ1bm5pbmdcIiA/IFwidHJ1ZVwiIDogXCJmYWxzZVwiKTtcblxuICAgIHJlZnMucGxheUJ0bi5zZXRUZXh0KHN0YXR1cyA9PT0gXCJydW5uaW5nXCIgPyBsYWJlbHMucGF1c2UgOiBsYWJlbHMucGxheSk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyByZXF1ZXN0VXJsIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSB7IFdlZWtseVNjaGVkdWxlLCBNZWV0aW5nUGFydCwgTWVldGluZ1NlY3Rpb24gfSBmcm9tIFwiLi90eXBlc1wiO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVVJMIGhlbHBlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGlzb1dlZWsoZGF0ZTogRGF0ZSk6IG51bWJlciB7XG4gIGNvbnN0IGQgPSBuZXcgRGF0ZShEYXRlLlVUQyhkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCkpKTtcbiAgZC5zZXRVVENEYXRlKGQuZ2V0VVRDRGF0ZSgpICsgNCAtIChkLmdldFVUQ0RheSgpIHx8IDcpKTtcbiAgY29uc3QgeWVhclN0YXJ0ID0gbmV3IERhdGUoRGF0ZS5VVEMoZC5nZXRVVENGdWxsWWVhcigpLCAwLCAxKSk7XG4gIHJldHVybiBNYXRoLmNlaWwoKChkLmdldFRpbWUoKSAtIHllYXJTdGFydC5nZXRUaW1lKCkpIC8gODZfNDAwXzAwMCArIDEpIC8gNyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyZW50V2Vla051bWJlcigpOiBudW1iZXIge1xuICByZXR1cm4gaXNvV2VlayhuZXcgRGF0ZSgpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkV29sVXJsKGxvY2FsZTogc3RyaW5nLCB5ZWFyOiBudW1iZXIsIHdlZWs6IG51bWJlcik6IHN0cmluZyB7XG4gIHJldHVybiBgaHR0cHM6Ly93b2wuancub3JnL2VuL3dvbC9tZWV0aW5ncy8ke2xvY2FsZX0vJHt5ZWFyfS8ke3dlZWt9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNhY2hlS2V5KHllYXI6IG51bWJlciwgd2VlazogbnVtYmVyKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAke3llYXJ9LSR7U3RyaW5nKHdlZWspLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRHVyYXRpb24gcGFyc2luZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuLyoqXG4gKiBNYXRjaGVzIFwiKE4gbWluLilcIiBPUiBcIihOIG1pbnMuKVwiIFx1MjAxNCBoYW5kbGVzIEVuZ2xpc2ggKFwibWluLlwiKSBhbmQgU3BhbmlzaCAoXCJtaW5zLlwiKS5cbiAqIFRoZSByZWdleCBpcyBhcHBsaWVkIGFnYWluc3QgcGxhaW4gdGV4dCBhZnRlciBzdHJpcHBpbmcgSFRNTCB0YWdzLlxuICovXG5jb25zdCBEVVJBVElPTl9SRSA9IC9cXCgoXFxkKylcXHMqbWlucz9cXC5cXCkvaTtcblxuZnVuY3Rpb24gcGFyc2VEdXJhdGlvbih0ZXh0OiBzdHJpbmcpOiBudW1iZXIgfCBudWxsIHtcbiAgY29uc3QgbSA9IERVUkFUSU9OX1JFLmV4ZWModGV4dCk7XG4gIHJldHVybiBtID8gcGFyc2VJbnQobVsxXSwgMTApICogNjAgOiBudWxsO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRmV0Y2ggXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaFdlZWtTY2hlZHVsZShcbiAgbG9jYWxlOiBzdHJpbmcsXG4gIHllYXI6IG51bWJlcixcbiAgd2VlazogbnVtYmVyXG4pOiBQcm9taXNlPFdlZWtseVNjaGVkdWxlIHwgbnVsbD4ge1xuICAvLyBTdGVwIDE6IGZldGNoIHRoZSBtZWV0aW5ncyBpbmRleCBwYWdlIHRvIGZpbmQgdGhlIE1XQiBkb2MgbGlua1xuICBjb25zdCBtZWV0aW5nc1VybCA9IGJ1aWxkV29sVXJsKGxvY2FsZSwgeWVhciwgd2Vlayk7XG4gIGxldCBtZWV0aW5nc0h0bWw6IHN0cmluZztcbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwID0gYXdhaXQgcmVxdWVzdFVybCh7XG4gICAgICB1cmw6IG1lZXRpbmdzVXJsLFxuICAgICAgaGVhZGVyczogeyBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoY29tcGF0aWJsZTsgSldUaW1lck9ic2lkaWFuLzIuMClcIiB9LFxuICAgIH0pO1xuICAgIGlmIChyZXNwLnN0YXR1cyA8IDIwMCB8fCByZXNwLnN0YXR1cyA+PSAzMDApIHJldHVybiBudWxsO1xuICAgIG1lZXRpbmdzSHRtbCA9IHJlc3AudGV4dDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBNV0IgZG9jIElEcyBhcmUgOSsgZGlnaXRzXG4gIGNvbnN0IGRvY0xpbmtSZSA9IC9ocmVmPVwiKFxcL1teXCJdK1xcL3dvbFxcL2RcXC9bXlwiIz9dKylcIi9nO1xuICBjb25zdCBkb2NMaW5rczogc3RyaW5nW10gPSBbXTtcbiAgbGV0IG06IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG4gIHdoaWxlICgobSA9IGRvY0xpbmtSZS5leGVjKG1lZXRpbmdzSHRtbCkpICE9PSBudWxsKSB7XG4gICAgaWYgKC9cXC9cXGR7OSx9JC8udGVzdChtWzFdKSkgZG9jTGlua3MucHVzaChtWzFdKTtcbiAgfVxuICBpZiAoZG9jTGlua3MubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcblxuICAvLyBTdGVwIDI6IGZldGNoIHRoZSBNV0IgYXJ0aWNsZSBwYWdlXG4gIGNvbnN0IGRvY1VybCA9IGBodHRwczovL3dvbC5qdy5vcmcke2RvY0xpbmtzWzBdfWA7XG4gIGxldCBkb2NIdG1sOiBzdHJpbmc7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzcCA9IGF3YWl0IHJlcXVlc3RVcmwoe1xuICAgICAgdXJsOiBkb2NVcmwsXG4gICAgICBoZWFkZXJzOiB7IFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChjb21wYXRpYmxlOyBKV1RpbWVyT2JzaWRpYW4vMi4wKVwiIH0sXG4gICAgfSk7XG4gICAgaWYgKHJlc3Auc3RhdHVzIDwgMjAwIHx8IHJlc3Auc3RhdHVzID49IDMwMCkgcmV0dXJuIG51bGw7XG4gICAgZG9jSHRtbCA9IHJlc3AudGV4dDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gcGFyc2VEb2NQYWdlKGRvY0h0bWwsIHllYXIsIHdlZWspO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgSFRNTCB1dGlsaXRpZXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIGNsZWFuVGV4dChodG1sOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gaHRtbFxuICAgIC5yZXBsYWNlKC88W14+XSs+L2csIFwiIFwiKVxuICAgIC5yZXBsYWNlKC8mYW1wOy9nLCBcIiZcIilcbiAgICAucmVwbGFjZSgvJmx0Oy9nLCBcIjxcIilcbiAgICAucmVwbGFjZSgvJmd0Oy9nLCBcIj5cIilcbiAgICAucmVwbGFjZSgvJnF1b3Q7L2csICdcIicpXG4gICAgLnJlcGxhY2UoLyYjMzk7L2csIFwiJ1wiKVxuICAgIC5yZXBsYWNlKC8mbmJzcDsvZywgXCIgXCIpXG4gICAgLnJlcGxhY2UoL1xccysvZywgXCIgXCIpXG4gICAgLnRyaW0oKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIERvYyBwYWdlIHBhcnNpbmcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHBhcnNlRG9jUGFnZShodG1sOiBzdHJpbmcsIHllYXI6IG51bWJlciwgd2VlazogbnVtYmVyKTogV2Vla2x5U2NoZWR1bGUgfCBudWxsIHtcbiAgLy8gV2VlayBsYWJlbCBmcm9tIGgxXG4gIGNvbnN0IGgxTWF0Y2ggPSAvPGgxW14+XSo+KFtcXHNcXFNdKj8pPFxcL2gxPi9pLmV4ZWMoaHRtbCk7XG4gIGNvbnN0IHdlZWtMYWJlbCA9IGgxTWF0Y2ggPyBjbGVhblRleHQoaDFNYXRjaFsxXSkgOiBgV2VlayAke3dlZWt9YDtcblxuICAvLyBcdTI1MDBcdTI1MDAgU2VjdGlvbiBkZXRlY3Rpb24gdmlhIENTUyBjb2xvdXIgY2xhc3NlcyAobGFuZ3VhZ2UtaW5kZXBlbmRlbnQpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICAvLyBoMiB3aXRoIGNsYXNzIGR1LWNvbG9yLS10ZWFsLTcwMCAgIFx1MjE5MiBUUkVBU1VSRVMgRlJPTSBHT0QnUyBXT1JEXG4gIC8vIGgyIHdpdGggY2xhc3MgZHUtY29sb3ItLWdvbGQtNzAwICAgXHUyMTkyIEFQUExZIFlPVVJTRUxGIFRPIFRIRSBGSUVMRCBNSU5JU1RSWVxuICAvLyBoMiB3aXRoIGNsYXNzIGR1LWNvbG9yLS1tYXJvb24tNjAwIFx1MjE5MiBMSVZJTkcgQVMgQ0hSSVNUSUFOU1xuICB0eXBlIFNlY3Rpb25Cb3VuZGFyeSA9IHsgcG9zOiBudW1iZXI7IHNlY3Rpb246IE1lZXRpbmdTZWN0aW9uOyBsYWJlbDogc3RyaW5nIH07XG4gIGNvbnN0IGJvdW5kYXJpZXM6IFNlY3Rpb25Cb3VuZGFyeVtdID0gW107XG5cbiAgY29uc3QgaDJSZSA9IC88aDIoW14+XSopPihbXFxzXFxTXSo/KTxcXC9oMj4vZ2k7XG4gIGxldCBoMm06IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG4gIHdoaWxlICgoaDJtID0gaDJSZS5leGVjKGh0bWwpKSAhPT0gbnVsbCkge1xuICAgIGNvbnN0IGNscyA9IGgybVsxXTtcbiAgICBjb25zdCB0ZXh0ID0gY2xlYW5UZXh0KGgybVsyXSkudG9VcHBlckNhc2UoKTtcbiAgICBsZXQgc2VjOiBNZWV0aW5nU2VjdGlvbiB8IG51bGwgPSBudWxsO1xuICAgIC8vIFByaW1hcnk6IENTUyBjb2xvdXIgY2xhc3MgXHUyMDE0IHdvcmtzIGluIGFueSBsYW5ndWFnZVxuICAgIGlmIChjbHMuaW5jbHVkZXMoXCJ0ZWFsLTcwMFwiKSkgc2VjID0gXCJ0cmVhc3VyZXNcIjtcbiAgICBlbHNlIGlmIChjbHMuaW5jbHVkZXMoXCJnb2xkLTcwMFwiKSkgc2VjID0gXCJtaW5pc3RyeVwiO1xuICAgIGVsc2UgaWYgKGNscy5pbmNsdWRlcyhcIm1hcm9vbi02MDBcIikpIHNlYyA9IFwibGl2aW5nXCI7XG4gICAgLy8gRmFsbGJhY2s6IEVuZ2xpc2ggc2VjdGlvbiB0ZXh0XG4gICAgZWxzZSBpZiAodGV4dC5pbmNsdWRlcyhcIlRSRUFTVVJFU1wiKSkgc2VjID0gXCJ0cmVhc3VyZXNcIjtcbiAgICBlbHNlIGlmICh0ZXh0LmluY2x1ZGVzKFwiQVBQTFkgWU9VUlNFTEZcIikgfHwgdGV4dC5pbmNsdWRlcyhcIkZJRUxEIE1JTklTVFJZXCIpKSBzZWMgPSBcIm1pbmlzdHJ5XCI7XG4gICAgZWxzZSBpZiAodGV4dC5pbmNsdWRlcyhcIkxJVklORyBBUyBDSFJJU1RJQU5TXCIpKSBzZWMgPSBcImxpdmluZ1wiO1xuICAgIGlmIChzZWMpIGJvdW5kYXJpZXMucHVzaCh7IHBvczogaDJtLmluZGV4LCBzZWN0aW9uOiBzZWMsIGxhYmVsOiBjbGVhblRleHQoaDJtWzJdKSB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNlY3Rpb25Gb3JQb3MocG9zOiBudW1iZXIpOiBNZWV0aW5nU2VjdGlvbiB7XG4gICAgbGV0IHNlYzogTWVldGluZ1NlY3Rpb24gPSBcIm9wZW5pbmdcIjtcbiAgICBmb3IgKGNvbnN0IGIgb2YgYm91bmRhcmllcykge1xuICAgICAgaWYgKHBvcyA+PSBiLnBvcykgc2VjID0gYi5zZWN0aW9uO1xuICAgIH1cbiAgICByZXR1cm4gc2VjO1xuICB9XG5cbiAgLy8gXHUyNTAwXHUyNTAwIFBhcnNlIGgzIGVsZW1lbnRzIGludG8gcHJvZ3JhbW1lIHBhcnRzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuICBjb25zdCBwYXJ0czogTWVldGluZ1BhcnRbXSA9IFtdO1xuICBsZXQgb3JkZXIgPSAwO1xuXG4gIC8vIENhcHR1cmVzOiBbMV0gaDMgYXR0cnMsIFsyXSBoMyBpbm5lciBIVE1MLCBbM10gc2libGluZyBib2R5IEhUTUwgdW50aWwgbmV4dCBoMy9oMlxuICBjb25zdCBoM1JlID0gLzxoMyhbXj5dKik+KFtcXHNcXFNdKj8pPFxcL2gzPihbXFxzXFxTXSo/KSg/PTxoM3w8aDJ8PFxcL2FydGljbGV8JCkvZ2k7XG4gIGxldCBoM206IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG4gIHdoaWxlICgoaDNtID0gaDNSZS5leGVjKGh0bWwpKSAhPT0gbnVsbCkge1xuICAgIGNvbnN0IGgzQXR0cnMgICA9IGgzbVsxXTtcbiAgICBjb25zdCB0aXRsZUh0bWwgPSBoM21bMl07XG4gICAgY29uc3QgYm9keUh0bWwgID0gaDNtWzNdID8/IFwiXCI7XG4gICAgY29uc3QgdGl0bGUgICAgID0gY2xlYW5UZXh0KHRpdGxlSHRtbCk7XG4gICAgY29uc3QgYm9keVRleHQgID0gY2xlYW5UZXh0KGJvZHlIdG1sKTtcbiAgICBjb25zdCBwb3MgICAgICAgPSBoM20uaW5kZXg7XG5cbiAgICBjb25zdCBpc1NvbmcgPSBoM0F0dHJzLmluY2x1ZGVzKFwiZGMtaWNvbi0tbXVzaWNcIik7XG5cbiAgICBpZiAoaXNTb25nKSB7XG4gICAgICBjb25zdCBkdXJJblRpdGxlID0gcGFyc2VEdXJhdGlvbih0aXRsZSk7XG5cbiAgICAgIGlmIChkdXJJblRpdGxlID09PSBudWxsKSB7XG4gICAgICAgIC8vIE1pZC1tZWV0aW5nIHNvbmcgc2VwYXJhdG9yOiBjb3VudGVkIGZvciBzY2hlZHVsZSB0aW1pbmcgYnV0IG5vIHN0b3B3YXRjaCBzaG93blxuICAgICAgICBwYXJ0cy5wdXNoKHtcbiAgICAgICAgICBsYWJlbDogdGl0bGUsXG4gICAgICAgICAgc2VjdGlvbjogc2VjdGlvbkZvclBvcyhwb3MpLFxuICAgICAgICAgIGR1cmF0aW9uU2VjOiA1ICogNjAsXG4gICAgICAgICAgb3JkZXI6IG9yZGVyKyssXG4gICAgICAgICAgaXNTZXBhcmF0b3I6IHRydWUsXG4gICAgICAgIH0pO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gT3BlbmluZyBzb25nIGgzOiBcIlNvbmcgODYgYW5kIFByYXllciB8IE9wZW5pbmcgQ29tbWVudHMgKDEgbWluLilcIlxuICAgICAgLy8gT25seSBzdXJmYWNlIHRoZSBwcm9ncmFtbWUgbGFiZWwgKHRoZSBwaXBlIHNlZ21lbnQgdGhhdCBoYXMgdGhlIGR1cmF0aW9uKVxuICAgICAgY29uc3QgbGFiZWwgPSBsYWJlbEZyb21QaXBlU2VnbWVudCh0aXRsZSk7XG4gICAgICBpZiAoIWxhYmVsKSBjb250aW51ZTtcbiAgICAgIHBhcnRzLnB1c2goeyBsYWJlbCwgc2VjdGlvbjogc2VjdGlvbkZvclBvcyhwb3MpLCBkdXJhdGlvblNlYzogZHVySW5UaXRsZSwgb3JkZXI6IG9yZGVyKysgfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBSZWd1bGFyIHByb2dyYW1tZSBwYXJ0IFx1MjAxNCBkdXJhdGlvbiBtYXkgYmUgaW4gdGhlIGgzIHRpdGxlIChjbG9zaW5nIHJvdykgb3IgaW4gYm9keVxuICAgIGNvbnN0IGR1ckluVGl0bGUgPSBwYXJzZUR1cmF0aW9uKHRpdGxlKTtcbiAgICBjb25zdCBkdXJJbkJvZHkgID0gcGFyc2VEdXJhdGlvbihib2R5VGV4dC5zbGljZSgwLCAyMDApKTtcbiAgICBjb25zdCBkdXJhdGlvblNlYyA9IGR1ckluVGl0bGUgPz8gZHVySW5Cb2R5O1xuICAgIGlmIChkdXJhdGlvblNlYyA9PT0gbnVsbCkgY29udGludWU7XG5cbiAgICAvLyBDbG9zaW5nIGgzOiBcIkNvbmNsdWRpbmcgQ29tbWVudHMgKDMgbWluLikgfCBTb25nIE4gYW5kIFByYXllclwiXG4gICAgaWYgKHRpdGxlLmluY2x1ZGVzKFwifFwiKSkge1xuICAgICAgY29uc3QgbGFiZWwgPSBsYWJlbEZyb21QaXBlU2VnbWVudCh0aXRsZSk7XG4gICAgICBpZiAoIWxhYmVsKSBjb250aW51ZTtcbiAgICAgIHBhcnRzLnB1c2goeyBsYWJlbCwgc2VjdGlvbjogXCJjbG9zaW5nXCIsIGR1cmF0aW9uU2VjLCBvcmRlcjogb3JkZXIrKyB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIE5vcm1hbCBudW1iZXJlZCBwYXJ0IFx1MjAxNCBzdHJpcCBkdXJhdGlvbiBhbm5vdGF0aW9uIGZyb20gbGFiZWxcbiAgICBjb25zdCBjbGVhbkxhYmVsID0gdGl0bGUucmVwbGFjZShEVVJBVElPTl9SRSwgXCJcIikucmVwbGFjZSgvXFxzKy9nLCBcIiBcIikudHJpbSgpO1xuICAgIGNvbnN0IHNlY3Rpb24gPSBzZWN0aW9uRm9yUG9zKHBvcyk7XG4gICAgLy8gTWluaXN0cnkgcGFydHMgYW5kIEJpYmxlIHJlYWRpbmcgKGRjLWljb24tLWJpYmxlKSBnZXQgYSAxLW1pbiBpbnN0cnVjdG9yIGFkdmljZSBzdWItdGltZXJcbiAgICBjb25zdCBoYXNBZHZpY2UgPSBzZWN0aW9uID09PSBcIm1pbmlzdHJ5XCIgfHxcbiAgICAgIChzZWN0aW9uID09PSBcInRyZWFzdXJlc1wiICYmIGgzQXR0cnMuaW5jbHVkZXMoXCJkYy1pY29uLS1iaWJsZVwiKSk7XG4gICAgcGFydHMucHVzaCh7IGxhYmVsOiBjbGVhbkxhYmVsLCBzZWN0aW9uLCBkdXJhdGlvblNlYywgb3JkZXI6IG9yZGVyKyssIC4uLihoYXNBZHZpY2UgPyB7IGhhc0FkdmljZSB9IDoge30pIH0pO1xuICB9XG5cbiAgaWYgKHBhcnRzLmxlbmd0aCA8IDUpIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IHNlY3Rpb25MYWJlbHM6IFBhcnRpYWw8UmVjb3JkPE1lZXRpbmdTZWN0aW9uLCBzdHJpbmc+PiA9IHt9O1xuICBmb3IgKGNvbnN0IGIgb2YgYm91bmRhcmllcykge1xuICAgIHNlY3Rpb25MYWJlbHNbYi5zZWN0aW9uXSA9IGIubGFiZWw7XG4gIH1cblxuICByZXR1cm4geyB3ZWVrTGFiZWwsIHllYXIsIHdlZWtOdW1iZXI6IHdlZWssIHBhcnRzLCBmZXRjaGVkQXQ6IERhdGUubm93KCksIHNlY3Rpb25MYWJlbHMgfTtcbn1cblxuLyoqXG4gKiBGb3IgcGlwZS1zZXBhcmF0ZWQgaDMgdGl0bGVzIChvcGVuaW5nIG9yIGNsb3Npbmcgcm93cyksIHJldHVybnMgdGhlIHNlZ21lbnRcbiAqIHRoYXQgY29udGFpbnMgdGhlIGR1cmF0aW9uIGFubm90YXRpb24sIHdpdGggdGhhdCBhbm5vdGF0aW9uIHN0cmlwcGVkLlxuICpcbiAqIFwiU29uZyA4NiBhbmQgUHJheWVyIHwgT3BlbmluZyBDb21tZW50cyAoMSBtaW4uKVwiICBcdTIxOTIgXCJPcGVuaW5nIENvbW1lbnRzXCJcbiAqIFwiQ2FuY2lcdTAwRjNuIDg2IHkgb3JhY2lcdTAwRjNuIHwgUGFsYWJyYXMgZGUgaW50cm9kdWNjaVx1MDBGM24gKDEgbWluLilcIiBcdTIxOTIgXCJQYWxhYnJhcyBkZSBpbnRyb2R1Y2NpXHUwMEYzblwiXG4gKiBcIkNvbmNsdWRpbmcgQ29tbWVudHMgKDMgbWluLikgfCBTb25nIDcwIGFuZCBQcmF5ZXJcIiBcdTIxOTIgXCJDb25jbHVkaW5nIENvbW1lbnRzXCJcbiAqL1xuZnVuY3Rpb24gbGFiZWxGcm9tUGlwZVNlZ21lbnQodGl0bGU6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBzZWdtZW50cyA9IHRpdGxlLnNwbGl0KFwifFwiKS5tYXAocyA9PiBzLnRyaW0oKSk7XG4gIGNvbnN0IHdpdGhEdXIgPSBzZWdtZW50cy5maW5kKHMgPT4gRFVSQVRJT05fUkUudGVzdChzKSk7XG4gIGlmICghd2l0aER1cikgcmV0dXJuIG51bGw7XG4gIHJldHVybiB3aXRoRHVyLnJlcGxhY2UoRFVSQVRJT05fUkUsIFwiXCIpLnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnRyaW0oKSB8fCBudWxsO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7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
