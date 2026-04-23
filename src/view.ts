import { App, ItemView, Modal, WorkspaceLeaf } from "obsidian";
import type JwTimerPlugin from "./main";
import type { WeeklySchedule, MeetingPart } from "./types";
import type { TimerSnapshot } from "./timer-engine";
import { cacheKey, currentWeekNumber, fetchWeekSchedule } from "./scraper";

export const VIEW_TYPE_JW_TIMER = "jw-timer-sidebar";

// ─── Edit-part modal ────────────────────────────────────────────────────────────────

class EditPartModal extends Modal {
  constructor(
    app: App,
    private readonly part: MeetingPart,
    private readonly onSave: (label: string, durationSec: number) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { cls: "jw-timer-edit-title", text: "Edit part" });
    const form = contentEl.createDiv({ cls: "jw-timer-edit-form" });

    const labelRow = form.createDiv({ cls: "jw-timer-edit-row" });
    labelRow.createEl("label", { cls: "jw-timer-edit-label", text: "Title" });
    const labelInput = labelRow.createEl("input", { cls: "jw-timer-edit-input" });
    labelInput.type = "text";
    labelInput.value = this.part.label;

    const durRow = form.createDiv({ cls: "jw-timer-edit-row" });
    durRow.createEl("label", { cls: "jw-timer-edit-label", text: "Duration (minutes)" });
    const durInput = durRow.createEl("input", { cls: "jw-timer-edit-input" });
    durInput.type = "number";
    durInput.min = "1";
    durInput.max = "60";
    durInput.value = String(Math.round(this.part.durationSec / 60));

    const footer = contentEl.createDiv({ cls: "jw-timer-edit-footer" });
    const saveBtn = footer.createEl("button", { cls: "mod-cta", text: "Save" });
    saveBtn.addEventListener("click", () => {
      const newLabel = labelInput.value.trim() || this.part.label;
      const newMins = Math.max(1, parseInt(durInput.value, 10) || Math.round(this.part.durationSec / 60));
      this.onSave(newLabel, newMins * 60);
      this.close();
    });
    [labelInput, durInput].forEach((el) =>
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") saveBtn.click(); })
    );
    window.setTimeout(() => labelInput.focus(), 50);
  }

  onClose(): void { this.contentEl.empty(); }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const WARN_THRESHOLD = 0.9;

// Fallback section labels — used when scraper sectionLabels is absent (old cache)
const SECTION_FALLBACK: Record<string, string> = {
  opening:   "Opening",
  treasures: "Treasures from God's Word",
  ministry:  "Apply Yourself to the Ministry",
  living:    "Living as Christians",
  closing:   "Closing",
};

// Opening/Closing labels per locale language code (WOL only has h2 for the 3 middle sections)
const LOCALE_OPENING_CLOSING: Record<string, [string, string]> = {
  "lp-e":   ["Opening",    "Closing"],
  "lp-s":   ["Apertura",   "Conclusión"],
  "lp-f":   ["Ouverture",  "Conclusion"],
  "lp-t":   ["Abertura",   "Conclusão"],
  "lp-g":   ["Eröffnung",  "Abschluss"],
  "lp-i":   ["Apertura",   "Conclusione"],
  "lp-u":   ["Начало",           "Заключение"],
  "lp-m":   ["Deschidere",       "Încheiere"],
  "lp-bl":  ["Встъпителна част", "Заключителна част"],
  "lp-o":   ["Opening",          "Sluiting"],
  "lp-x":   ["Eröffnung",  "Abschluss"],
  "lp-p":   ["Otwarcie",   "Zakończenie"],
  "lp-j":   ["開会の言葉", "閉会の言葉"],
  "lp-ko":  ["소개말",     "맺음말"],
  "lp-chs": ["开场",        "结束"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── UI labels per locale ──────────────────────────────────────────────────

interface UiLabels {
  play: string;
  pause: string;
  reset: string;
  resetAll: string;
  confirm: string;
  today: string;
  advice: string;
  end: string;
  stopped: string;
}

const LOCALE_UI: Record<string, UiLabels> = {
  "lp-e":   { play: "Play",      pause: "Pause",      reset: "Reset",         resetAll: "Reset All",           confirm: "Confirm?",          today: "Today",      advice: "Advice",    end: "End",        stopped: "Stopped"   },
  "lp-s":   { play: "Iniciar",   pause: "Pausar",     reset: "Reiniciar",     resetAll: "Reiniciar todo",      confirm: "¿Confirmar?",       today: "Hoy",        advice: "Consejo",   end: "Fin",        stopped: "Parado"    },
  "lp-f":   { play: "D\u00e9marrer",  pause: "Pause",      reset: "R\u00e9init.",       resetAll: "Tout r\u00e9init.",        confirm: "Confirmer\u00a0?",      today: "Auj.",       advice: "Conseil",   end: "Fin",        stopped: "Arrêté"   },
  "lp-t":   { play: "Iniciar",   pause: "Pausar",     reset: "Reiniciar",     resetAll: "Reiniciar tudo",      confirm: "Confirmar?",        today: "Hoje",       advice: "Conselho",  end: "Fim",        stopped: "Parado"    },
  "lp-x":   { play: "Start",     pause: "Pause",      reset: "Zur\u00fccksetzen",  resetAll: "Alles zur\u00fccksetzen",  confirm: "Best\u00e4tigen?",      today: "Heute",      advice: "Rat",       end: "Ende",       stopped: "Gestoppt"  },
  "lp-i":   { play: "Avvia",     pause: "Pausa",      reset: "Azzera",        resetAll: "Azzera tutto",        confirm: "Confermare?",       today: "Oggi",       advice: "Consiglio", end: "Fine",       stopped: "Fermato"   },
  "lp-u":   { play: "Старт",  pause: "Пауза",  reset: "Сброс",      resetAll: "Сбросить всё",       confirm: "Подтвердить?",      today: "Сегодня", advice: "Совет",  end: "Кон.",  stopped: "Остановлено"     },
  "lp-m":   { play: "Start",  pause: "Pauză",  reset: "Resetare",   resetAll: "Resetare totală",    confirm: "Confirmare?",       today: "Azi",     advice: "Sfat",   end: "Sf.",   stopped: "Oprit"           },
  "lp-bl":  { play: "Старт",  pause: "Пауза",  reset: "Нулиране",   resetAll: "Нулиране на всичко", confirm: "Потвърди?",         today: "Днес",    advice: "Съвет",  end: "Край",  stopped: "Спряно"          },
  "lp-o":   { play: "Start",  pause: "Pauze",  reset: "Reset",      resetAll: "Alles resetten",     confirm: "Bevestigen?",       today: "Vandaag", advice: "Advies", end: "Einde", stopped: "Gestopt"         },
  "lp-p":   { play: "Start",     pause: "Pauza",      reset: "Resetuj",       resetAll: "Resetuj wszystko",    confirm: "Potwierdź?",        today: "Dzi\u015b",       advice: "Rada",       end: "Koniec",     stopped: "Zatrzymano" },
  "lp-j":   { play: "\u30b9\u30bf\u30fc\u30c8",  pause: "\u4e00\u6642\u505c\u6b62",   reset: "\u30ea\u30bb\u30c3\u30c8",       resetAll: "\u5168\u30ea\u30bb\u30c3\u30c8",            confirm: "確認?",              today: "\u4eca\u65e5",       advice: "\u52a9\u8a00",      end: "終了",       stopped: "停止"      },
  "lp-ko":  { play: "\uc2dc\uc791",      pause: "\uc77c\uc2dc\uc815\uc9c0",   reset: "\ucd08\uae30\ud654",        resetAll: "\uc804\uccb4 \ucd08\uae30\ud654",          confirm: "확인?",              today: "\uc624\ub298",       advice: "\uc870\uc5b8",      end: "종료",       stopped: "중지"      },
  "lp-chs": { play: "\u5f00\u59cb",      pause: "\u6682\u505c",       reset: "\u91cd\u7f6e",          resetAll: "\u5168\u90e8\u91cd\u7f6e",               confirm: "确认?",              today: "\u4eca\u5929",       advice: "\u6307\u5bfc",      end: "结束",       stopped: "停止"      },
};

function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timestampToHHMM(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Number of ISO weeks in a year (52 or 53). Dec 28 is always in the last ISO week. */
function isoWeeksInYear(year: number): number {
  const d = new Date(Date.UTC(year, 11, 28));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** Returns a short, language-agnostic staleness label + severity for a fetch timestamp. */
interface StaleLabels {
  justNow: string;
  /** "{time}" is replaced with HH:MM */
  todayAt: string;
  yesterday: string;
  /** "{n}" is replaced with the number of days */
  daysAgo: string;
}

const LOCALE_STALE: Record<string, StaleLabels> = {
  "lp-e":   { justNow: "Fetched just now",         todayAt: "Fetched today at {time}",       yesterday: "Fetched yesterday",         daysAgo: "Fetched {n} days ago"          },
  "lp-s":   { justNow: "Obtenido hace un momento", todayAt: "Obtenido hoy a las {time}",     yesterday: "Obtenido ayer",             daysAgo: "Obtenido hace {n} d\u00edas"  },
  "lp-f":   { justNow: "Obtenu \u00e0 l'instant",  todayAt: "Obtenu aujourd'hui \u00e0 {time}", yesterday: "Obtenu hier",             daysAgo: "Obtenu il y a {n} jours"      },
  "lp-t":   { justNow: "Obtido h\u00e1 pouco",     todayAt: "Obtido hoje \u00e0s {time}",     yesterday: "Obtido ontem",              daysAgo: "Obtido h\u00e1 {n} dias"      },
  "lp-x":   { justNow: "Gerade abgerufen",         todayAt: "Heute um {time} abgerufen",     yesterday: "Gestern abgerufen",         daysAgo: "Vor {n} Tagen abgerufen"      },
  "lp-i":   { justNow: "Ottenuto poco fa",         todayAt: "Ottenuto oggi alle {time}",     yesterday: "Ottenuto ieri",             daysAgo: "Ottenuto {n} giorni fa"       },
  "lp-u":   { justNow: "\u041f\u043e\u043b\u0443\u0447\u0435\u043d\u043e \u0442\u043e\u043b\u044c\u043a\u043e \u0447\u0442\u043e", todayAt: "\u041f\u043e\u043b\u0443\u0447\u0435\u043d\u043e \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u0432 {time}", yesterday: "\u041f\u043e\u043b\u0443\u0447\u0435\u043d\u043e \u0432\u0447\u0435\u0440\u0430", daysAgo: "\u041f\u043e\u043b\u0443\u0447\u0435\u043d\u043e {n} \u0434\u043d\u0435\u0439 \u043d\u0430\u0437\u0430\u0434" },
  "lp-m":   { justNow: "Actualizat acum",          todayAt: "Actualizat azi la {time}",      yesterday: "Actualizat ieri",           daysAgo: "Actualizat acum {n} zile"     },
  "lp-bl":  { justNow: "\u0418\u0437\u0442\u0435\u0433\u043b\u0435\u043d\u043e \u043f\u0440\u0435\u0434\u0438 \u043c\u0430\u043b\u043a\u043e", todayAt: "\u0418\u0437\u0442\u0435\u0433\u043b\u0435\u043d\u043e \u0434\u043d\u0435\u0441 \u0432 {time}", yesterday: "\u0418\u0437\u0442\u0435\u0433\u043b\u0435\u043d\u043e \u0432\u0447\u0435\u0440\u0430", daysAgo: "\u0418\u0437\u0442\u0435\u0433\u043b\u0435\u043d\u043e \u043f\u0440\u0435\u0434\u0438 {n} \u0434\u043d\u0438" },
  "lp-o":   { justNow: "Zojuist opgehaald",        todayAt: "Vandaag om {time} opgehaald",   yesterday: "Gisteren opgehaald",        daysAgo: "{n} dagen geleden opgehaald"  },
  "lp-p":   { justNow: "Pobrano przed chwil\u0105", todayAt: "Pobrano dzi\u015b o {time}",   yesterday: "Pobrano wczoraj",           daysAgo: "Pobrano {n} dni temu"         },
  "lp-j":   { justNow: "\u305f\u3063\u305f\u4eca\u53d6\u5f97", todayAt: "\u4eca\u65e5\u306e{time}\u306b\u53d6\u5f97", yesterday: "\u6628\u65e5\u53d6\u5f97", daysAgo: "{n}\u65e5\u524d\u306b\u53d6\u5f97" },
  "lp-ko":  { justNow: "\ubc29\uae08 \uac00\uc838\uc634", todayAt: "\uc624\ub298 {time}\uc5d0 \uac00\uc838\uc634", yesterday: "\uc5b4\uc81c \uac00\uc838\uc634", daysAgo: "{n}\uc77c \uc804\uc5d0 \uac00\uc838\uc634" },
  "lp-chs": { justNow: "\u521a\u521a\u83b7\u53d6",  todayAt: "\u4eca\u5929{time}\u83b7\u53d6", yesterday: "\u6628\u5929\u83b7\u53d6",  daysAgo: "{n}\u5929\u524d\u83b7\u53d6"  },
};

/** Returns a localised staleness label + severity for a fetch timestamp. */
function formatFetchedAt(fetchedAt: number, lang: string): { text: string; level: "fresh" | "stale" | "old" } {
  const ageH = (Date.now() - fetchedAt) / 3_600_000;
  const sl = LOCALE_STALE[lang] ?? LOCALE_STALE["lp-e"];
  let text: string;
  if (ageH < 1) {
    text = sl.justNow;
  } else if (ageH < 24) {
    const d = new Date(fetchedAt);
    const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    text = sl.todayAt.replace("{time}", hhmm);
  } else {
    const days = Math.floor(ageH / 24);
    text = days === 1 ? sl.yesterday : sl.daysAgo.replace("{n}", String(days));
  }
  const level: "fresh" | "stale" | "old" = ageH < 24 ? "fresh" : ageH < 72 ? "stale" : "old";
  return { text, level };
}

type TimerColorState = "idle" | "ok" | "warn" | "over";

function colorState(elapsedMs: number, durationSec: number, status: TimerSnapshot["status"]): TimerColorState {
  if (status === "idle") return "idle";
  const ratio = elapsedMs / (durationSec * 1000);
  if (ratio > 1) return "over";
  if (ratio >= WARN_THRESHOLD) return "warn";
  return "ok";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardRefs {
  cardEl: HTMLElement;
  elapsedEl: HTMLElement;
  endTimeEl: HTMLElement;
  stoppedAtEl: HTMLElement;
  deltaEl: HTMLElement;
  playBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  barFillEl: HTMLElement;
}

// ─── View ─────────────────────────────────────────────────────────────────────

export class JwTimerView extends ItemView {
  private schedule: WeeklySchedule | null = null;
  private weekKey = "";
  private cards = new Map<number, CardRefs>();
  private adviceCards = new Map<number, CardRefs>();
  private tickHandle: number | null = null;
  private statusEl!: HTMLElement;
  private navLabelEl!: HTMLElement;
  private todayBtn!: HTMLButtonElement;
  private resetAllBtn!: HTMLButtonElement;
  private listEl!: HTMLElement;
  /** Tracks buttons in the pending-confirm state, with their revert timeout id */
  private pendingResets = new Map<HTMLButtonElement, number>();
  private staleEl!: HTMLElement;
  private staleTextEl!: HTMLElement;
  private meetingBarContainerEl!: HTMLElement;
  private meetingBarFillEl!: HTMLElement;
  private meetingBarLabelEl!: HTMLElement;
  private totalTimedMs = 0;
  /** Tracks partOrders that have already fired an overtime alert this session */
  private firedAlerts = new Set<number>();
  /** Currently visible card overlay, if any */
  private activeOverlay: HTMLElement | null = null;

  // Pagination state — initialised to current week in onOpen
  private viewYear: number = new Date().getFullYear();
  private viewWeek: number = currentWeekNumber();

  constructor(leaf: WorkspaceLeaf, private readonly plugin: JwTimerPlugin) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_JW_TIMER; }
  getDisplayText(): string { return "JW Meeting Timer"; }
  getIcon(): string { return "timer"; }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.empty();
    root.addClass("jw-timer-root");

    // ── Week navigation ──────────────────────────────────────────────────────
    const navEl = root.createDiv({ cls: "jw-timer-nav" });
    const prevBtn = navEl.createEl("button", { cls: "jw-timer-nav-btn", text: "◀" });
    prevBtn.setAttr("aria-label", "Previous week");
    this.navLabelEl = navEl.createDiv({ cls: "jw-timer-nav-label" });
    const nextBtn = navEl.createEl("button", { cls: "jw-timer-nav-btn", text: "▶" });
    nextBtn.setAttr("aria-label", "Next week");
    this.todayBtn = navEl.createEl("button", { cls: "jw-timer-nav-today", text: this.getLabels().today });
    this.todayBtn.setAttr("aria-label", "Jump to current week");
    this.todayBtn.style.display = "none";
    prevBtn.addEventListener("click", () => void this.navigateWeek(-1));
    nextBtn.addEventListener("click", () => void this.navigateWeek(+1));
    this.todayBtn.addEventListener("click", () => void this.navigateToToday());
    // ── Staleness indicator ──────────────────────────────────────────────
    this.staleEl = root.createDiv({ cls: "jw-timer-stale" });
    const staleRefreshBtn = this.staleEl.createEl("button", {
      cls: "jw-timer-stale-refresh",
      text: "↻",
    });
    staleRefreshBtn.setAttr("aria-label", "Re-fetch schedule from wol.jw.org");
    staleRefreshBtn.addEventListener("click", () => void this.refetchSchedule());
    this.staleTextEl = this.staleEl.createSpan();
    this.staleEl.style.display = "none";
    // ── Reset-all toolbar ────────────────────────────────────────────────────
    const toolbar = root.createDiv({ cls: "jw-timer-toolbar" });
    this.resetAllBtn = toolbar.createEl("button", {
      cls: "jw-timer-btn jw-timer-btn-reset-all",
      text: this.getLabels().resetAll,
    });
    this.resetAllBtn.addEventListener("click", () => this.armReset(this.resetAllBtn, () => this.handleResetAll()));

    // ── Status + list ────────────────────────────────────────────────────────
    this.statusEl = root.createDiv({ cls: "jw-timer-status" });
    // ── Meeting progress bar ───────────────────────────────────────────
    this.meetingBarContainerEl = root.createDiv({ cls: "jw-timer-meeting-bar-container" });
    this.meetingBarContainerEl.style.display = "none";
    const mBarTrack = this.meetingBarContainerEl.createDiv({ cls: "jw-timer-meeting-bar" });
    this.meetingBarFillEl = mBarTrack.createDiv({ cls: "jw-timer-meeting-bar-fill" });
    this.meetingBarLabelEl = this.meetingBarContainerEl.createDiv({ cls: "jw-timer-meeting-bar-label" });
    this.listEl = root.createDiv({ cls: "jw-timer-list" });
    // Dismiss any open card overlay when tapping outside it
    this.listEl.addEventListener("pointerdown", (e) => {
      if (this.activeOverlay && !(e.target as HTMLElement).closest(".jw-timer-card-overlay")) {
        this.activeOverlay.removeClass("jw-timer-card-overlay--visible");
        this.activeOverlay = null;
      }
    });

    this.tickHandle = window.setInterval(() => this.tick(), 250);

    this.viewYear = new Date().getFullYear();
    this.viewWeek = currentWeekNumber();
    await this.loadScheduleForWeek(this.viewYear, this.viewWeek);
  }

  async onClose(): Promise<void> {
    if (this.tickHandle !== null) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    await this.plugin.persistTimers();
  }

  // ─── Public: called when settings change ────────────────────────────────────

  async reload(): Promise<void> {
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

  private async navigateWeek(delta: number): Promise<void> {
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

  private getLang(): string {
    return this.plugin.settings.wolLocale.split("/")[1] ?? "lp-e";
  }

  private getLabels(): UiLabels {
    return LOCALE_UI[this.getLang()] ?? LOCALE_UI["lp-e"];
  }

  private getEffectivePart(part: MeetingPart): MeetingPart {
    const override = this.plugin.getPartOverride(`${this.weekKey}:${part.order}`);
    if (!override) return part;
    return {
      ...part,
      ...(override.label !== undefined ? { label: override.label } : {}),
      ...(override.durationSec !== undefined ? { durationSec: override.durationSec } : {}),
    };
  }

  private isPartDeleted(part: MeetingPart): boolean {
    return this.plugin.getPartOverride(`${this.weekKey}:${part.order}`)?.deleted === true;
  }

  /** Virtual partOrder for advice timer — avoids clash with real part orders (≤ ~20). */
  private adviceOrder(partOrder: number): number {
    return 1000 + partOrder;
  }

  // ─── Today helpers ────────────────────────────────────────────────────────

  private isCurrentWeek(): boolean {
    const year = new Date().getFullYear();
    const week = currentWeekNumber();
    return this.viewYear === year && this.viewWeek === week;
  }

  private updateTodayVisibility(): void {
    this.todayBtn.style.display = this.isCurrentWeek() ? "none" : "";
  }

  private async navigateToToday(): Promise<void> {
    this.viewYear = new Date().getFullYear();
    this.viewWeek = currentWeekNumber();
    this.schedule = null;
    this.cards.clear();
    this.adviceCards.clear();
    this.listEl.empty();
    await this.loadScheduleForWeek(this.viewYear, this.viewWeek);
  }

  // ─── Schedule loading ─────────────────────────────────────────────────────────

  private async loadScheduleForWeek(year: number, week: number): Promise<void> {
    this.weekKey = cacheKey(year, week);
    this.navLabelEl.setText(`${year} · W${String(week).padStart(2, "0")}`);    this.staleEl.style.display = "none";
    this.meetingBarContainerEl.style.display = "none";
    let schedule = this.plugin.getCachedSchedule(this.weekKey);

    if (!schedule) {
      this.setStatus("loading", "Fetching schedule from wol.jw.org…");
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
    const { text: staleText, level: staleLevel } = formatFetchedAt(schedule.fetchedAt, this.getLang());
    this.staleTextEl.setText(staleText);
    this.staleEl.className = `jw-timer-stale jw-timer-stale--${staleLevel}`;
    this.staleEl.style.display = "";
    this.renderSchedule(schedule);
    this.updateMeetingBar();
    this.updateTodayVisibility();
  }

  private setStatus(type: "ok" | "loading" | "error", text: string): void {
    this.statusEl.empty();
    this.statusEl.className = `jw-timer-status jw-timer-status--${type}`;
    this.statusEl.setText(text);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  private renderSchedule(schedule: WeeklySchedule): void {
    this.listEl.empty();
    this.cards.clear();
    this.adviceCards.clear();
    this.firedAlerts.clear();

    // Compute total timed content duration (non-separator parts + advice slots)
    this.totalTimedMs = 0;
    for (const p of schedule.parts) {
      if (!p.isSeparator) this.totalTimedMs += p.durationSec * 1000;
      if (p.hasAdvice && this.plugin.settings.showAdvice) this.totalTimedMs += 60_000;
    }
    this.meetingBarContainerEl.style.display = "";

    const startMinutes = timeToMinutes(this.plugin.settings.meetingStartTime);
    let cursor = startMinutes + this.plugin.settings.openingSongMinutes;

    const scheduledStart = new Map<number, number>();
    for (const part of schedule.parts) {
      scheduledStart.set(part.order, cursor);
      // Include the 1-minute advice slot in the schedule so subsequent parts
      // (and the final "End" time) reflect the real meeting duration.
      cursor += Math.ceil(part.durationSec / 60) + (part.hasAdvice ? 1 : 0);
    }

    // Opening/Closing labels from locale map; middle sections from scraper (page language)
    const langKey = this.plugin.settings.wolLocale.split("/")[1] ?? "lp-e";
    const [openingLabel, closingLabel] = LOCALE_OPENING_CLOSING[langKey] ?? ["Opening", "Closing"];
    const sectionLabels: Record<string, string> = {
      ...SECTION_FALLBACK,
      ...(schedule.sectionLabels ?? {}),
      opening: openingLabel,
      closing: closingLabel,
    };

    // Group parts by section
    const sections = new Map<string, MeetingPart[]>();
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
      sectionEl.setAttribute("data-section", sectionKey);
      sectionEl.createEl("h3", {
        cls: "jw-timer-section-title",
        text: sectionLabels[sectionKey] ?? sectionKey,
      });

      for (const part of parts) {
        if (part.isSeparator) continue;
        if (this.isPartDeleted(part)) continue;
        this.renderCard(sectionEl, this.getEffectivePart(part), scheduledStart.get(part.order) ?? startMinutes);
      }
    }
  }

  private renderCard(parentEl: HTMLElement, part: MeetingPart, scheduledStartMins: number): void {
    const card = parentEl.createDiv({ cls: "jw-timer-card" });
    card.setAttribute("data-state", "idle");
    card.setAttribute("data-running", "false");

    // Title + allotted minutes
    const header = card.createDiv({ cls: "jw-timer-card-header" });
    header.createDiv({ cls: "jw-timer-card-title", text: part.label });
    header.createDiv({ cls: "jw-timer-card-allotted", text: `${Math.round(part.durationSec / 60)} min` });

    // Scheduled end time + actual stopped-at time
    const endTimeMins = scheduledStartMins + Math.ceil(part.durationSec / 60);
    const timeRow = card.createDiv({ cls: "jw-timer-time-row" });
    const endTimeEl = timeRow.createSpan({
      cls: "jw-timer-end-time",
      text: `${this.getLabels().end} ${minutesToTime(endTimeMins)}`,
    });
    const stoppedAtEl = timeRow.createSpan({ cls: "jw-timer-stopped-at" });
    const deltaEl = timeRow.createSpan({ cls: "jw-timer-delta" });
    deltaEl.style.display = "none";

    // Progress bar
    const barEl = card.createDiv({ cls: "jw-timer-bar" });
    const barFillEl = barEl.createDiv({ cls: "jw-timer-bar-fill" });

    // Large elapsed clock
    const clockRow = card.createDiv({ cls: "jw-timer-clock-row" });
    const elapsedEl = clockRow.createDiv({ cls: "jw-timer-elapsed", text: "00:00" });

    // Controls
    const controls = card.createDiv({ cls: "jw-timer-controls" });
    const { play: playLabel, reset: resetLabel } = this.getLabels();
    const playBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-play", text: playLabel });
    playBtn.setAttr("aria-label", "Start timer");
    const resetBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-reset", text: resetLabel });
    resetBtn.setAttr("aria-label", "Reset timer");

    playBtn.addEventListener("click", () => this.handlePlayPause(part));
    resetBtn.addEventListener("click", () => this.armReset(resetBtn, () => this.handleReset(part)));

    // Suppress unused-var warning — endTimeEl content is set once and never changes
    void endTimeEl;

    this.cards.set(part.order, { cardEl: card, elapsedEl, endTimeEl, stoppedAtEl, deltaEl, playBtn, resetBtn, barFillEl });
    this.updateCard(part, scheduledStartMins);

    // Advice sub-card for parts with instructor feedback (Bible reading + ministry parts)
    if (part.hasAdvice && this.plugin.settings.showAdvice) this.renderAdviceCard(parentEl, part);

    // ─── Long-press overlay ────────────────────────────────────────────────────────
    const overlay = card.createDiv({ cls: "jw-timer-card-overlay" });
    const editBtn = overlay.createEl("button", {
      cls: "jw-timer-overlay-btn jw-timer-overlay-btn--edit",
      text: "\u270F\uFE0F Edit",
    });
    const deleteBtn = overlay.createEl("button", {
      cls: "jw-timer-overlay-btn jw-timer-overlay-btn--delete",
      text: "\uD83D\uDDD1\uFE0F Delete",
    });

    let longPressTimer: number | null = null;
    let pressStartX = 0;
    let pressStartY = 0;
    const cancelPress = () => {
      if (longPressTimer !== null) {
        window.clearTimeout(longPressTimer);
        longPressTimer = null;
        card.style.touchAction = "";
        card.removeClass("jw-timer-card--pressing");
      }
    };
    card.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest("button, .jw-timer-card-overlay")) return;
      pressStartX = e.clientX;
      pressStartY = e.clientY;
      // Prevent browser scroll-gesture from firing pointercancel on mobile
      card.style.touchAction = "none";
      card.addClass("jw-timer-card--pressing");
      longPressTimer = window.setTimeout(() => {
        longPressTimer = null;
        card.style.touchAction = "";
        card.removeClass("jw-timer-card--pressing");
        // Close any other open overlay first
        if (this.activeOverlay && this.activeOverlay !== overlay) {
          this.activeOverlay.removeClass("jw-timer-card-overlay--visible");
        }
        this.activeOverlay = overlay;
        overlay.addClass("jw-timer-card-overlay--visible");
      }, 600);
    });
    card.addEventListener("pointerup", cancelPress);
    card.addEventListener("pointermove", (e) => {
      if (longPressTimer === null) return;
      const dx = e.clientX - pressStartX;
      const dy = e.clientY - pressStartY;
      // Allow up to 10 px of finger jitter before treating it as a cancel
      if (dx * dx + dy * dy > 100) cancelPress();
    });
    card.addEventListener("pointercancel", cancelPress);
    card.addEventListener("contextmenu", (e) => e.preventDefault());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.removeClass("jw-timer-card-overlay--visible");
        if (this.activeOverlay === overlay) this.activeOverlay = null;
      }
    });
    editBtn.addEventListener("click", () => {
      overlay.removeClass("jw-timer-card-overlay--visible");
      if (this.activeOverlay === overlay) this.activeOverlay = null;
      new EditPartModal(this.app, part, (newLabel, newDurationSec) => {
        this.plugin.setPartOverride(`${this.weekKey}:${part.order}`, { label: newLabel, durationSec: newDurationSec });
        void this.plugin.persistTimers();
        this.renderSchedule(this.schedule!);
        this.updateMeetingBar();
      }).open();
    });
    deleteBtn.addEventListener("click", () => {
      overlay.removeClass("jw-timer-card-overlay--visible");
      if (this.activeOverlay === overlay) this.activeOverlay = null;
      this.plugin.setPartOverride(`${this.weekKey}:${part.order}`, { deleted: true });
      void this.plugin.persistTimers();
      this.renderSchedule(this.schedule!);
      this.updateMeetingBar();
    });
  }

  // ─── Re-fetch schedule ────────────────────────────────────────────────────

  private async refetchSchedule(): Promise<void> {
    this.plugin.evictCachedSchedule(this.weekKey);
    this.plugin.clearPartOverrides(this.weekKey);
    this.staleEl.style.display = "none";
    this.meetingBarContainerEl.style.display = "none";
    this.schedule = null;
    this.cards.clear();
    this.adviceCards.clear();
    this.listEl.empty();
    await this.loadScheduleForWeek(this.viewYear, this.viewWeek);
  }

  // ─── Two-click reset guard ────────────────────────────────────────────────

  /**
   * Arms a button for a two-click confirm flow.
   * First click: button turns into "Confirm?" with a red style; if no second click
   * within 3 s the button reverts. Second click: executes `onConfirm`.
   */
  private armReset(btn: HTMLButtonElement, onConfirm: () => void): void {
    if (this.pendingResets.has(btn)) {
      // Second click — execute immediately
      const tid = this.pendingResets.get(btn)!;
      window.clearTimeout(tid);
      this.pendingResets.delete(btn);
      btn.removeClass("jw-timer-btn--confirm");
      // Restore label before executing (handleResetAll re-renders the list, individual
      // handleReset does not, so both paths need this here)
      btn.setText(btn === this.resetAllBtn ? this.getLabels().resetAll : this.getLabels().reset);
      onConfirm();
      return;
    }
    // First click — arm
    const labels = this.getLabels();
    btn.setText(labels.confirm);
    btn.addClass("jw-timer-btn--confirm");
    const tid = window.setTimeout(() => {
      this.pendingResets.delete(btn);
      btn.removeClass("jw-timer-btn--confirm");
      // Restore original label based on whether this is reset-all or a card reset
      if (btn === this.resetAllBtn) {
        btn.setText(this.getLabels().resetAll);
      } else {
        btn.setText(this.getLabels().reset);
      }
    }, 3000);
    this.pendingResets.set(btn, tid);
  }

  // ─── Timer controls ─────────────────────────────────────────────────────────

  private handlePlayPause(part: MeetingPart): void {
    const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
    if (snap.status === "running") {
      this.plugin.timerEngine.pause(this.weekKey, part.order);
      void this.plugin.persistTimers(); // persist elapsed time on pause
    } else {
      this.plugin.timerEngine.start(this.weekKey, part.order);
    }
    this.updateCardByOrder(part);
    this.updateMeetingBar();
  }

  private handleReset(part: MeetingPart): void {
    this.plugin.timerEngine.reset(this.weekKey, part.order);
    this.firedAlerts.delete(part.order);
    if (part.hasAdvice) {
      this.plugin.timerEngine.reset(this.weekKey, this.adviceOrder(part.order));
      this.firedAlerts.delete(this.adviceOrder(part.order));
      this.updateAdviceCard(part);
    }
    this.updateCardByOrder(part);
    this.updateMeetingBar();
    void this.plugin.persistTimers();
  }

  // ─── Tick & display update ───────────────────────────────────────────────────

  private tick(): void {
    if (!this.schedule) return;
    let anyRunning = false;
    for (const part of this.schedule.parts) {
      const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
      if (snap.status === "running") {
        this.updateCardByOrder(part);
        anyRunning = true;
        if (snap.elapsedMs >= part.durationSec * 1000) this.fireAlert(part.order);
      }
      if (part.hasAdvice) {
        const aSnap = this.plugin.timerEngine.get(this.weekKey, this.adviceOrder(part.order));
        if (aSnap.status === "running") {
          this.updateAdviceCard(part);
          anyRunning = true;
          if (aSnap.elapsedMs >= 60_000) this.fireAlert(this.adviceOrder(part.order));
        }
      }
    }
    if (anyRunning) this.updateMeetingBar();
  }

  /** Fire a one-shot overtime alert (sound and/or vibration) for the given slot. */
  private fireAlert(slotOrder: number): void {
    if (this.firedAlerts.has(slotOrder)) return;
    this.firedAlerts.add(slotOrder);
    const { alertSound, alertSoundSec, alertVibrate, alertVibrateSec } = this.plugin.settings;
    if (alertSound) this.playBeep(alertSoundSec);
    if (alertVibrate && "vibrate" in navigator) {
      try {
        navigator.vibrate(alertVibrateSec * 1000);
      } catch { /* unsupported */ }
    }
  }

  /** Synthesise a repeating beep using the Web Audio API for the given duration. */
  private playBeep(durationSec: number): void {
    try {
      const ctx = new AudioContext();
      // Each beep cycle: 0.18s tone + 0.07s silence = 0.25s per cycle
      const cycleLen = 0.25;
      const toneLen = 0.18;
      const cycles = Math.max(1, Math.round(durationSec / cycleLen));
      for (let i = 0; i < cycles; i++) {
        const startSec = ctx.currentTime + i * cycleLen;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.4, startSec);
        gain.gain.exponentialRampToValueAtTime(0.001, startSec + toneLen);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startSec);
        osc.stop(startSec + toneLen);
      }
      window.setTimeout(() => ctx.close(), durationSec * 1000 + 300);
    } catch {
      // AudioContext unavailable — silently ignore
    }
  }

  private updateMeetingBar(): void {
    if (!this.schedule || this.totalTimedMs === 0) return;
    let elapsedMs = 0;
    for (const part of this.schedule.parts) {
      if (!part.isSeparator) {
        elapsedMs += this.plugin.timerEngine.get(this.weekKey, part.order).elapsedMs;
      }
      if (part.hasAdvice) {
        elapsedMs += this.plugin.timerEngine.get(this.weekKey, this.adviceOrder(part.order)).elapsedMs;
      }
    }
    const ratio = Math.min(1, elapsedMs / this.totalTimedMs);
    this.meetingBarFillEl.style.width = `${(ratio * 100).toFixed(1)}%`;
    this.meetingBarLabelEl.setText(`${formatMmSs(elapsedMs)} / ${formatMmSs(this.totalTimedMs)}`);
  }

  private updateCardByOrder(part: MeetingPart): void {
    const startMinutes = timeToMinutes(this.plugin.settings.meetingStartTime);
    let cursor = startMinutes + this.plugin.settings.openingSongMinutes;
    let scheduledStart = cursor;
    for (const p of (this.schedule?.parts ?? [])) {
      if (p.order === part.order) { scheduledStart = cursor; break; }
      cursor += Math.ceil(p.durationSec / 60) + (p.hasAdvice ? 1 : 0);
    }
    this.updateCard(this.getEffectivePart(part), scheduledStart);
  }

  private updateCard(part: MeetingPart, scheduledStartMins: number): void {
    const refs = this.cards.get(part.order);
    if (!refs) return;

    const snap = this.plugin.timerEngine.get(this.weekKey, part.order);
    const { elapsedMs, status, stoppedAt } = snap;
    const durationMs = part.durationSec * 1000;

    // Elapsed clock
    refs.elapsedEl.setText(formatMmSs(elapsedMs));

    // Progress bar
    refs.barFillEl.style.width = `${(Math.min(1, elapsedMs / durationMs) * 100).toFixed(1)}%`;

    // Play/pause button label (needed below too)
    const labels = this.getLabels();

    // Stopped-at indicator + delta badge (shown only when paused)
    const endTimeMins = scheduledStartMins + Math.ceil(part.durationSec / 60);
    if (status === "paused" && stoppedAt != null) {
      const d = new Date(stoppedAt);
      const stoppedMins = d.getHours() * 60 + d.getMinutes();
      const deltaMin = stoppedMins - endTimeMins;
      const late = deltaMin > 0;
      refs.stoppedAtEl.setText(`\u00b7 ${labels.stopped} ${timestampToHHMM(stoppedAt)}`);
      refs.stoppedAtEl.className = "jw-timer-stopped-at";
      const absMins = Math.abs(deltaMin);
      const fmtDelta = (n: number): string => {
        if (n < 60) return `${n}min`;
        const h = Math.floor(n / 60);
        const m = n % 60;
        return m === 0 ? `${h}h` : `${h}h\u00a0${m}min`;
      };
      if (deltaMin === 0) {
        refs.deltaEl.setText("\u2714");
        refs.deltaEl.className = "jw-timer-delta jw-timer-delta--early";
        refs.deltaEl.style.display = "";
      } else {
        const sign = late ? "+" : "\u2212";
        refs.deltaEl.setText(`${sign}${fmtDelta(absMins)}`);
        refs.deltaEl.className = `jw-timer-delta jw-timer-delta--${late ? "late" : "early"}`;
        refs.deltaEl.style.display = "";
      }
    } else {
      refs.stoppedAtEl.setText("");
      refs.stoppedAtEl.className = "jw-timer-stopped-at";
      refs.deltaEl.style.display = "none";
    }

    // Card colour state + running indicator for CSS
    const state = colorState(elapsedMs, part.durationSec, status);
    refs.cardEl.setAttribute("data-state", state);
    refs.cardEl.setAttribute("data-running", status === "running" ? "true" : "false");

    // Play/pause button label
    if (status === "running") {
      refs.playBtn.setText(labels.pause);
      refs.playBtn.setAttr("aria-label", "Pause timer");
    } else {
      refs.playBtn.setText(labels.play);
      refs.playBtn.setAttr("aria-label", status === "paused" ? "Resume timer" : "Start timer");
    }
  }

  // ─── Reset All ────────────────────────────────────────────────────────────

  private handleResetAll(): void {
    if (!this.schedule) return;
    // Cancel any pending confirm states on individual reset buttons
    for (const [btn, tid] of this.pendingResets) {
      window.clearTimeout(tid);
      btn.removeClass("jw-timer-btn--confirm");
    }
    this.pendingResets.clear();
    this.plugin.clearPartOverrides(this.weekKey);
    for (const part of this.schedule.parts) {
      this.plugin.timerEngine.reset(this.weekKey, part.order);
      if (part.hasAdvice) this.plugin.timerEngine.reset(this.weekKey, this.adviceOrder(part.order));
    }
    this.renderSchedule(this.schedule);
    void this.plugin.persistTimers();
  }

  // ─── Advice card ────────────────────────────────────────────────────────────

  private renderAdviceCard(parentEl: HTMLElement, part: MeetingPart): void {
    const labels = this.getLabels();
    const card = parentEl.createDiv({ cls: "jw-timer-card jw-timer-card--advice" });
    card.setAttribute("data-state", "idle");
    card.setAttribute("data-running", "false");

    // Badge: arrow icon + label
    const badge = card.createDiv({ cls: "jw-timer-advice-badge" });
    badge.createSpan({ cls: "jw-timer-advice-icon", text: "↳" });
    badge.createSpan({ cls: "jw-timer-advice-label", text: `${labels.advice} · 1 min` });

    // Progress bar
    const barEl = card.createDiv({ cls: "jw-timer-bar" });
    const barFillEl = barEl.createDiv({ cls: "jw-timer-bar-fill" });

    // Stopped-at row
    const timeRow = card.createDiv({ cls: "jw-timer-time-row" });
    const endTimeEl = timeRow.createSpan();
    const stoppedAtEl = timeRow.createSpan({ cls: "jw-timer-stopped-at" });
    void endTimeEl;

    // Elapsed clock
    const clockRow = card.createDiv({ cls: "jw-timer-clock-row" });
    const elapsedEl = clockRow.createDiv({ cls: "jw-timer-elapsed jw-timer-elapsed--advice", text: "00:00" });

    // Controls
    const controls = card.createDiv({ cls: "jw-timer-controls" });
    const playBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-play", text: labels.play });
    playBtn.setAttr("aria-label", "Start advice timer");
    const resetBtn = controls.createEl("button", { cls: "jw-timer-btn jw-timer-btn-reset", text: labels.reset });
    resetBtn.setAttr("aria-label", "Reset advice timer");

    playBtn.addEventListener("click", () => this.handleAdvicePlayPause(part));
    resetBtn.addEventListener("click", () => this.armReset(resetBtn, () => this.handleAdviceReset(part)));

    this.adviceCards.set(part.order, { cardEl: card, elapsedEl, endTimeEl, stoppedAtEl, playBtn, resetBtn, barFillEl });
    this.updateAdviceCard(part);
  }

  private handleAdvicePlayPause(part: MeetingPart): void {
    const aOrder = this.adviceOrder(part.order);
    const snap = this.plugin.timerEngine.get(this.weekKey, aOrder);
    if (snap.status === "running") {
      this.plugin.timerEngine.pause(this.weekKey, aOrder);
      void this.plugin.persistTimers();
    } else {
      this.plugin.timerEngine.start(this.weekKey, aOrder);
    }
    this.updateAdviceCard(part);
    this.updateMeetingBar();
  }

  private handleAdviceReset(part: MeetingPart): void {
    this.plugin.timerEngine.reset(this.weekKey, this.adviceOrder(part.order));
    this.updateAdviceCard(part);
    this.updateMeetingBar();
    void this.plugin.persistTimers();
  }

  private updateAdviceCard(part: MeetingPart): void {
    const refs = this.adviceCards.get(part.order);
    if (!refs) return;
    const labels = this.getLabels();
    const ADVICE_SEC = 60;
    const snap = this.plugin.timerEngine.get(this.weekKey, this.adviceOrder(part.order));
    const { elapsedMs, status, stoppedAt } = snap;

    refs.elapsedEl.setText(formatMmSs(elapsedMs));
    refs.barFillEl.style.width = `${(Math.min(1, elapsedMs / (ADVICE_SEC * 1000)) * 100).toFixed(1)}%`;

    if (status === "paused" && stoppedAt != null) {
      refs.stoppedAtEl.setText(`· ${timestampToHHMM(stoppedAt)}`);
    } else {
      refs.stoppedAtEl.setText("");
    }

    const state = colorState(elapsedMs, ADVICE_SEC, status);
    refs.cardEl.setAttribute("data-state", state);
    refs.cardEl.setAttribute("data-running", status === "running" ? "true" : "false");

    refs.playBtn.setText(status === "running" ? labels.pause : labels.play);
  }
}
