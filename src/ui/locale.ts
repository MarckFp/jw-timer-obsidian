// ─── UI labels per locale ──────────────────────────────────────────────────────
// Add new fields here whenever a user-visible string is added to modals/overlays.

export interface UiLabels {
  // Timer controls
  play: string;
  pause: string;
  reset: string;
  resetAll: string;
  confirm: string;
  today: string;
  advice: string;
  end: string;
  stopped: string;
  // Card overlay buttons
  editOverlay: string;
  deleteOverlay: string;
  // Modal titles & actions
  editModal: string;
  newStopwatch: string;
  saveBtn: string;
  addBtn: string;
  // Modal form fields
  fieldTitle: string;
  fieldDuration: string;
  fieldSection: string;
  fieldAdvice: string;
  placeholder: string;
}

// prettier-ignore
export const LOCALE_UI: Record<string, UiLabels> = {
  "lp-e": {
    play: "Play",        pause: "Pause",      reset: "Reset",       resetAll: "Reset All",
    confirm: "Confirm?", today: "Today",      advice: "Advice",     end: "End",           stopped: "Stopped",
    editOverlay: "Edit", deleteOverlay: "Delete",
    editModal: "Edit part",       newStopwatch: "New stopwatch",
    saveBtn: "Save",              addBtn: "Add",
    fieldTitle: "Title",          fieldDuration: "Duration (min)",
    fieldSection: "Section",      fieldAdvice: "Advice timer (1 min)",
    placeholder: "Part name…",
  },
  "lp-s": {
    play: "Iniciar",        pause: "Pausar",      reset: "Reiniciar",       resetAll: "Reiniciar todo",
    confirm: "¿Confirmar?", today: "Hoy",         advice: "Consejo",        end: "Fin",              stopped: "Parado",
    editOverlay: "Editar",  deleteOverlay: "Eliminar",
    editModal: "Editar parte",          newStopwatch: "Nuevo cronómetro",
    saveBtn: "Guardar",                 addBtn: "Añadir",
    fieldTitle: "Título",               fieldDuration: "Duración (min)",
    fieldSection: "Sección",            fieldAdvice: "Tiempo de consejo (1 min)",
    placeholder: "Nombre de la parte…",
  },
  "lp-f": {
    play: "Démarrer",       pause: "Pause",        reset: "Réinit.",         resetAll: "Tout réinit.",
    confirm: "Confirmer\u00a0?", today: "Auj.",    advice: "Conseil",        end: "Fin",              stopped: "Arrêté",
    editOverlay: "Modifier", deleteOverlay: "Supprimer",
    editModal: "Modifier la partie",    newStopwatch: "Nouveau chrono",
    saveBtn: "Enregistrer",             addBtn: "Ajouter",
    fieldTitle: "Titre",                fieldDuration: "Durée (min)",
    fieldSection: "Section",            fieldAdvice: "Chrono conseil (1 min)",
    placeholder: "Nom de la partie…",
  },
  "lp-t": {
    play: "Iniciar",        pause: "Pausar",       reset: "Reiniciar",       resetAll: "Reiniciar tudo",
    confirm: "Confirmar?",  today: "Hoje",         advice: "Conselho",       end: "Fim",              stopped: "Parado",
    editOverlay: "Editar",  deleteOverlay: "Excluir",
    editModal: "Editar parte",          newStopwatch: "Novo cronómetro",
    saveBtn: "Guardar",                 addBtn: "Adicionar",
    fieldTitle: "Título",               fieldDuration: "Duração (min)",
    fieldSection: "Seção",              fieldAdvice: "Tempo de conselho (1 min)",
    placeholder: "Nome da parte…",
  },
  "lp-x": {
    play: "Start",          pause: "Pause",        reset: "Zurücksetzen",    resetAll: "Alles zurücksetzen",
    confirm: "Bestätigen?", today: "Heute",        advice: "Rat",            end: "Ende",             stopped: "Gestoppt",
    editOverlay: "Bearbeiten", deleteOverlay: "Löschen",
    editModal: "Teil bearbeiten",       newStopwatch: "Neue Stoppuhr",
    saveBtn: "Speichern",               addBtn: "Hinzufügen",
    fieldTitle: "Titel",                fieldDuration: "Dauer (min)",
    fieldSection: "Abschnitt",          fieldAdvice: "Ratgeber-Timer (1 min)",
    placeholder: "Teilname…",
  },
  "lp-i": {
    play: "Avvia",          pause: "Pausa",        reset: "Azzera",          resetAll: "Azzera tutto",
    confirm: "Confermare?", today: "Oggi",         advice: "Consiglio",      end: "Fine",             stopped: "Fermato",
    editOverlay: "Modifica", deleteOverlay: "Elimina",
    editModal: "Modifica parte",        newStopwatch: "Nuovo cronometro",
    saveBtn: "Salva",                   addBtn: "Aggiungi",
    fieldTitle: "Titolo",               fieldDuration: "Durata (min)",
    fieldSection: "Sezione",            fieldAdvice: "Timer consiglio (1 min)",
    placeholder: "Nome parte…",
  },
  "lp-u": {
    play: "Старт",          pause: "Пауза",        reset: "Сброс",           resetAll: "Сбросить всё",
    confirm: "Подтвердить?", today: "Сегодня",     advice: "Совет",          end: "Кон.",             stopped: "Остановлено",
    editOverlay: "Изменить", deleteOverlay: "Удалить",
    editModal: "Изменить часть",        newStopwatch: "Новый секундомер",
    saveBtn: "Сохранить",               addBtn: "Добавить",
    fieldTitle: "Заголовок",            fieldDuration: "Длит. (мин)",
    fieldSection: "Раздел",             fieldAdvice: "Таймер совета (1 мин)",
    placeholder: "Название части…",
  },
  "lp-m": {
    play: "Start",          pause: "Pauză",        reset: "Resetare",        resetAll: "Resetare totală",
    confirm: "Confirmare?", today: "Azi",          advice: "Sfat",           end: "Sf.",              stopped: "Oprit",
    editOverlay: "Editare", deleteOverlay: "Ștergere",
    editModal: "Editare parte",         newStopwatch: "Cronometru nou",
    saveBtn: "Salvează",                addBtn: "Adaugă",
    fieldTitle: "Titlu",                fieldDuration: "Durată (min)",
    fieldSection: "Secțiune",           fieldAdvice: "Temporizator sfat (1 min)",
    placeholder: "Numele părții…",
  },
  "lp-bl": {
    play: "Старт",          pause: "Пауза",        reset: "Нулиране",        resetAll: "Нулиране на всичко",
    confirm: "Потвърди?",   today: "Днес",         advice: "Съвет",          end: "Край",             stopped: "Спряно",
    editOverlay: "Редактиране", deleteOverlay: "Изтриване",
    editModal: "Редактиране",           newStopwatch: "Нов хронометър",
    saveBtn: "Запазване",               addBtn: "Добавяне",
    fieldTitle: "Заглавие",             fieldDuration: "Продълж. (мин)",
    fieldSection: "Раздел",             fieldAdvice: "Таймер съвет (1 мин)",
    placeholder: "Наименование…",
  },
  "lp-o": {
    play: "Start",          pause: "Pauze",        reset: "Reset",           resetAll: "Alles resetten",
    confirm: "Bevestigen?", today: "Vandaag",      advice: "Advies",         end: "Einde",            stopped: "Gestopt",
    editOverlay: "Bewerken", deleteOverlay: "Verwijderen",
    editModal: "Onderdeel bewerken",    newStopwatch: "Nieuwe stopwatch",
    saveBtn: "Opslaan",                 addBtn: "Toevoegen",
    fieldTitle: "Titel",                fieldDuration: "Duur (min)",
    fieldSection: "Sectie",             fieldAdvice: "Advies-timer (1 min)",
    placeholder: "Naam onderdeel…",
  },
  "lp-p": {
    play: "Start",          pause: "Pauza",        reset: "Resetuj",         resetAll: "Resetuj wszystko",
    confirm: "Potwierdź?",  today: "Dziś",         advice: "Rada",           end: "Koniec",           stopped: "Zatrzymano",
    editOverlay: "Edytuj",  deleteOverlay: "Usuń",
    editModal: "Edytuj część",          newStopwatch: "Nowy stoper",
    saveBtn: "Zapisz",                  addBtn: "Dodaj",
    fieldTitle: "Tytuł",                fieldDuration: "Czas (min)",
    fieldSection: "Sekcja",             fieldAdvice: "Timer porady (1 min)",
    placeholder: "Nazwa części…",
  },
  "lp-j": {
    play: "スタート",        pause: "一時停止",      reset: "リセット",         resetAll: "全リセット",
    confirm: "確認?",       today: "今日",          advice: "助言",           end: "終了",             stopped: "停止",
    editOverlay: "編集",    deleteOverlay: "削除",
    editModal: "部分を編集",             newStopwatch: "新しいストップウォッチ",
    saveBtn: "保存",                     addBtn: "追加",
    fieldTitle: "タイトル",              fieldDuration: "時間（分）",
    fieldSection: "セクション",          fieldAdvice: "アドバイスタイマー（1分）",
    placeholder: "部分の名前…",
  },
  "lp-ko": {
    play: "시작",           pause: "일시정지",       reset: "초기화",          resetAll: "전체 초기화",
    confirm: "확인?",       today: "오늘",          advice: "조언",           end: "종료",             stopped: "중지",
    editOverlay: "편집",    deleteOverlay: "삭제",
    editModal: "부분 편집",              newStopwatch: "새 스톱워치",
    saveBtn: "저장",                     addBtn: "추가",
    fieldTitle: "제목",                  fieldDuration: "시간 (분)",
    fieldSection: "섹션",                fieldAdvice: "조언 타이머 (1분)",
    placeholder: "부분 이름…",
  },
  "lp-chs": {
    play: "开始",           pause: "暂停",          reset: "重置",            resetAll: "全部重置",
    confirm: "确认?",       today: "今天",          advice: "指导",           end: "结束",             stopped: "停止",
    editOverlay: "编辑",    deleteOverlay: "删除",
    editModal: "编辑部分",               newStopwatch: "新建秒表",
    saveBtn: "保存",                     addBtn: "添加",
    fieldTitle: "标题",                  fieldDuration: "时长（分）",
    fieldSection: "部分",                fieldAdvice: "指导计时（1分钟）",
    placeholder: "部分名称…",
  },
};

// ─── Opening/Closing section labels ───────────────────────────────────────────
// WOL only has h2 for the 3 middle sections; these fill in opening/closing.

export const LOCALE_OPENING_CLOSING: Record<string, [string, string]> = {
  "lp-e":   ["Opening",           "Closing"],
  "lp-s":   ["Apertura",          "Conclusión"],
  "lp-f":   ["Ouverture",         "Conclusion"],
  "lp-t":   ["Abertura",          "Conclusão"],
  "lp-g":   ["Eröffnung",         "Abschluss"],
  "lp-i":   ["Apertura",          "Conclusione"],
  "lp-u":   ["Начало",            "Заключение"],
  "lp-m":   ["Deschidere",        "Încheiere"],
  "lp-bl":  ["Встъпителна част",  "Заключителна част"],
  "lp-o":   ["Opening",           "Sluiting"],
  "lp-x":   ["Eröffnung",         "Abschluss"],
  "lp-p":   ["Otwarcie",          "Zakończenie"],
  "lp-j":   ["開会の言葉",          "閉会の言葉"],
  "lp-ko":  ["소개말",              "맺음말"],
  "lp-chs": ["开场",               "结束"],
};

// ─── Fallback section labels ────────────────────────────────────────────────
// Used when scraper sectionLabels is absent (old cache entries).

export const SECTION_FALLBACK: Record<string, string> = {
  opening:   "Opening",
  treasures: "Treasures from God's Word",
  ministry:  "Apply Yourself to the Ministry",
  living:    "Living as Christians",
  closing:   "Closing",
};

// ─── Staleness labels ─────────────────────────────────────────────────────────

export interface StaleLabels {
  justNow: string;
  /** "{time}" is replaced with HH:MM */
  todayAt: string;
  yesterday: string;
  /** "{n}" is replaced with the number of days */
  daysAgo: string;
}

// prettier-ignore
export const LOCALE_STALE: Record<string, StaleLabels> = {
  "lp-e":   { justNow: "Fetched just now",           todayAt: "Fetched today at {time}",          yesterday: "Fetched yesterday",          daysAgo: "Fetched {n} days ago"          },
  "lp-s":   { justNow: "Obtenido hace un momento",   todayAt: "Obtenido hoy a las {time}",        yesterday: "Obtenido ayer",              daysAgo: "Obtenido hace {n} días"        },
  "lp-f":   { justNow: "Obtenu à l'instant",         todayAt: "Obtenu aujourd'hui à {time}",      yesterday: "Obtenu hier",                daysAgo: "Obtenu il y a {n} jours"       },
  "lp-t":   { justNow: "Obtido há pouco",            todayAt: "Obtido hoje às {time}",            yesterday: "Obtido ontem",               daysAgo: "Obtido há {n} dias"            },
  "lp-x":   { justNow: "Gerade abgerufen",           todayAt: "Heute um {time} abgerufen",        yesterday: "Gestern abgerufen",          daysAgo: "Vor {n} Tagen abgerufen"       },
  "lp-i":   { justNow: "Ottenuto poco fa",           todayAt: "Ottenuto oggi alle {time}",        yesterday: "Ottenuto ieri",              daysAgo: "Ottenuto {n} giorni fa"        },
  "lp-u":   { justNow: "Получено только что",        todayAt: "Получено сегодня в {time}",        yesterday: "Получено вчера",             daysAgo: "Получено {n} дней назад"       },
  "lp-m":   { justNow: "Actualizat acum",            todayAt: "Actualizat azi la {time}",         yesterday: "Actualizat ieri",            daysAgo: "Actualizat acum {n} zile"      },
  "lp-bl":  { justNow: "Изтеглено преди малко",      todayAt: "Изтеглено днес в {time}",          yesterday: "Изтеглено вчера",            daysAgo: "Изтеглено преди {n} дни"       },
  "lp-o":   { justNow: "Zojuist opgehaald",          todayAt: "Vandaag om {time} opgehaald",      yesterday: "Gisteren opgehaald",         daysAgo: "{n} dagen geleden opgehaald"   },
  "lp-p":   { justNow: "Pobrano przed chwilą",       todayAt: "Pobrano dziś o {time}",            yesterday: "Pobrano wczoraj",            daysAgo: "Pobrano {n} dni temu"          },
  "lp-j":   { justNow: "たった今取得",                 todayAt: "今日の{time}に取得",                 yesterday: "昨日取得",                    daysAgo: "{n}日前に取得"                  },
  "lp-ko":  { justNow: "방금 가져옴",                  todayAt: "오늘 {time}에 가져옴",               yesterday: "어제 가져옴",                  daysAgo: "{n}일 전에 가져옴"               },
  "lp-chs": { justNow: "刚刚获取",                    todayAt: "今天{time}获取",                    yesterday: "昨天获取",                    daysAgo: "{n}天前获取"                    },
};

/** Returns a localised staleness label + severity for a fetch timestamp. */
export function formatFetchedAt(fetchedAt: number, lang: string): { text: string; level: "fresh" | "stale" | "old" } {
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
