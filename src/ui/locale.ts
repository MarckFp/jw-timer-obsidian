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
  // Export actions
  shareBtn: string;
  copyOk: string;
  notePlaceholder: string;
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
    shareBtn: "Share",  copyOk: "Copied!",  notePlaceholder: "Note…",
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
    shareBtn: "Compartir",  copyOk: "¡Copiado!",  notePlaceholder: "Nota…",
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
    shareBtn: "Partager",  copyOk: "Copié !",  notePlaceholder: "Note…",
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
    shareBtn: "Partilhar",  copyOk: "Copiado!",  notePlaceholder: "Nota…",
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
    shareBtn: "Teilen",  copyOk: "Kopiert!",  notePlaceholder: "Notiz…",
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
    shareBtn: "Condividi",  copyOk: "Copiato!",  notePlaceholder: "Nota…",
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
    shareBtn: "Поделиться",  copyOk: "Скопировано!",  notePlaceholder: "Заметка…",
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
    shareBtn: "Distribuie",  copyOk: "Copiat!",  notePlaceholder: "Notă…",
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
    shareBtn: "Сподели се",  copyOk: "Копирано!",  notePlaceholder: "Бележка…",
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
    shareBtn: "Delen",  copyOk: "Gekopieerd!",  notePlaceholder: "Notitie…",
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
    shareBtn: "Udostępnij",  copyOk: "Skopiowano!",  notePlaceholder: "Notatka…",
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
    shareBtn: "共有",  copyOk: "コピーしました",  notePlaceholder: "メモ…",
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
    shareBtn: "공유",  copyOk: "복사됨!",  notePlaceholder: "메모…",
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
    shareBtn: "分享",  copyOk: "已复制!",  notePlaceholder: "备注…",
  },
  "lp-a": {
    play: "تشغيل",      pause: "إيقاف مؤقت",  reset: "إعادة تعيين",    resetAll: "إعادة تعيين الكل",
    confirm: "تأكيد؟",  today: "اليوم",   advice: "النصيحة",   end: "النهاية",   stopped: "متوقف",
    editOverlay: "تعديل",  deleteOverlay: "حذف",
    editModal: "تعديل الجزء",           newStopwatch: "ساعة إيقاف جديدة",
    saveBtn: "حفظ",                   addBtn: "إضافة",
    fieldTitle: "العنوان",          fieldDuration: "المدة (دقيقة)",
    fieldSection: "القسم",              fieldAdvice: "مؤقت النصيحة (دقيقة)",
    placeholder: "اسم الجزء…",
    shareBtn: "مشاركة",  copyOk: "تم النسخ!",  notePlaceholder: "ملاحظة…",
  },
  "lp-z": {
    play: "Starta",         pause: "Paus",          reset: "Nollställ",      resetAll: "Nollställ alla",
    confirm: "Bekräfta?",  today: "Idag",      advice: "Råd",           end: "Slut",            stopped: "Stoppad",
    editOverlay: "Redigera", deleteOverlay: "Ta bort",
    editModal: "Redigera del",          newStopwatch: "Ny tidtagare",
    saveBtn: "Spara",                   addBtn: "Lägg till",
    fieldTitle: "Titel",                fieldDuration: "Tid (min)",
    fieldSection: "Avsnitt",            fieldAdvice: "Råd-timer (1 min)",
    placeholder: "Delens namn…",
    shareBtn: "Dela",  copyOk: "Kopierat!",  notePlaceholder: "Anteckning…",
  },
  "lp-tk": {
    play: "Başlat",       pause: "Duraklat",    reset: "Sıfırla",    resetAll: "Tümünü sıfırla",
    confirm: "Onayla?",     today: "Bugün",    advice: "Tavsiye",        end: "Bitiş",          stopped: "Durdu",
    editOverlay: "Düzenle", deleteOverlay: "Sil",
    editModal: "Bölümü düzenle",       newStopwatch: "Yeni kronometre",
    saveBtn: "Kaydet",                  addBtn: "Ekle",
    fieldTitle: "Başlık",              fieldDuration: "Süre (dk)",
    fieldSection: "Bölüm",             fieldAdvice: "Tavsiye zamanlayıcı (1 dk)",
    placeholder: "Bölüm adı…",
    shareBtn: "Paylaş",  copyOk: "Kopyalıktı!",  notePlaceholder: "Not…",
  },
};

// ─── Opening/Closing section labels ───────────────────────────────────────────
// WOL only has h2 for the 3 middle sections; these fill in opening/closing.

export const LOCALE_OPENING_CLOSING: Record<string, [string, string]> = {
  "lp-e": ["Opening", "Closing"],
  "lp-s": ["Apertura", "Conclusión"],
  "lp-f": ["Ouverture", "Conclusion"],
  "lp-t": ["Abertura", "Conclusão"],
  "lp-g": ["Eröffnung", "Abschluss"],
  "lp-i": ["Apertura", "Conclusione"],
  "lp-u": ["Начало", "Заключение"],
  "lp-m": ["Deschidere", "Încheiere"],
  "lp-bl": ["Встъпителна част", "Заключителна част"],
  "lp-o": ["Opening", "Sluiting"],
  "lp-x": ["Eröffnung", "Abschluss"],
  "lp-p": ["Otwarcie", "Zakończenie"],
  "lp-j": ["開会の言葉", "閉会の言葉"],
  "lp-ko": ["소개말", "맺음말"],
  "lp-chs": ["开场", "结束"],
  "lp-a": ["الافتتاح", "الاختتام"],
  "lp-z": ["Öppning", "Avslutning"],
  "lp-tk": ["Açılış", "Kapanış"],
};

// ─── Fallback section labels ────────────────────────────────────────────────
// Used when scraper sectionLabels is absent (old cache entries).

export const SECTION_FALLBACK: Record<string, string> = {
  opening: "Opening",
  treasures: "Treasures from God's Word",
  ministry: "Apply Yourself to the Ministry",
  living: "Living as Christians",
  closing: "Closing",
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
  "lp-a":  { justNow: "تم الجلب الآن",         todayAt: "تم الجلب اليوم في {time}",   yesterday: "تم الجلب أمس",         daysAgo: "تم الجلب منذ {n} أيام"       },
  "lp-z":  { justNow: "Hämtad precis nu",        todayAt: "Hämtad idag kl. {time}",     yesterday: "Hämtad igår",          daysAgo: "Hämtad för {n} dagar sedan"   },
  "lp-tk": { justNow: "Az önce alındı",           todayAt: "Bugün {time}'de alındı",     yesterday: "Dün alındı",           daysAgo: "{n} gün önce alındı"          },
  "lp-chs": { justNow: "刚刚获取",                    todayAt: "今天{time}获取",                    yesterday: "昨天获取",                    daysAgo: "{n}天前获取"                    },
};

/** Returns a localised staleness label + severity for a fetch timestamp. */
export function formatFetchedAt(
  fetchedAt: number,
  lang: string,
): { text: string; level: "fresh" | "stale" | "old" } {
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
  const level: "fresh" | "stale" | "old" =
    ageH < 24 ? "fresh" : ageH < 72 ? "stale" : "old";
  return { text, level };
}

// ─── Settings-tab labels ──────────────────────────────────────────────────────
// All user-visible strings shown inside the plugin settings panel.

export interface SettingsLabels {
  pageTitle: string;
  // Language section
  langName: string;
  langDesc: string;
  customLocaleName: string;
  customLocaleDesc: string;
  // Schedule section
  startTimeName: string;
  startTimeDesc: string;
  openingSongName: string;
  openingSongDesc: string;
  // Display section
  displayHeading: string;
  showAdviceName: string;
  showAdviceDesc: string;
  autoNextPartName: string;
  autoNextPartDesc: string;
  // Alerts section
  alertsHeading: string;
  soundAlertName: string;
  soundAlertDesc: string;
  soundDurName: string;
  soundDurDesc: string;
  vibrateAlertName: string;
  vibrateAlertDesc: string;
  vibrateDurName: string;
  vibrateDurDesc: string;
}

// prettier-ignore
export const LOCALE_SETTINGS: Record<string, SettingsLabels> = {
  "lp-e": {
    pageTitle: "JW Meeting Timer — Settings",
    langName: "Meeting language",
    langDesc: "Language used to fetch the weekly programme from wol.jw.org.",
    customLocaleName: "Custom locale (advanced)",
    customLocaleDesc: 'Override with any WOL locale path, e.g. “r4/lp-s”. Leave blank to use the dropdown.',
    startTimeName: "Meeting start time",
    startTimeDesc: '24-hour format, e.g. “20:00” or “18:30”.',
    openingSongName: "Opening song + prayer (minutes)",
    openingSongDesc: "Fixed minutes before the first programme part (song + prayer). Default: 5.",
    displayHeading: "Display",
    showAdviceName: "Show advice timers",
    showAdviceDesc: "Show the 1-minute instructor advice sub-card below applicable parts.",
    autoNextPartName: "Auto-start next part",
    autoNextPartDesc: "When you pause a part, automatically start the next part in the same section.",
    alertsHeading: "Alerts",
    soundAlertName: "Sound alert at overtime",
    soundAlertDesc: "Play a repeating beep when a timer reaches its allotted duration.",
    soundDurName: "Sound alert duration (seconds)",
    soundDurDesc: "How long the beep plays. Default: 1 s.",
    vibrateAlertName: "Vibration alert at overtime",
    vibrateAlertDesc: "Vibrate the device when a timer reaches its allotted duration. Mobile only.",
    vibrateDurName: "Vibration alert duration (seconds)",
    vibrateDurDesc: "How long the device vibrates. Mobile only. Default: 2 s.",
  },
  "lp-s": {
    pageTitle: "JW Meeting Timer — Configuración",
    langName: "Idioma de la reunión",
    langDesc: "Idioma para obtener el programa semanal de wol.jw.org.",
    customLocaleName: "Configuración regional personalizada (avanzado)",
    customLocaleDesc: "Usar cualquier ruta de configuración de WOL, p. ej. «r4/lp-s». Dejar vacío para usar el menú.",
    startTimeName: "Hora de inicio de la reunión",
    startTimeDesc: "Formato de 24 horas, p. ej. “20:00” o “18:30”.",
    openingSongName: "Canción inicial + oración (minutos)",
    openingSongDesc: "Minutos fijos antes de la primera parte del programa (canción + oración). Predeterminado: 5.",
    displayHeading: "Visualización",
    showAdviceName: "Mostrar temporizadores de consejo",
    showAdviceDesc: "Mostrar la subtarjeta de consejo de 1 minuto debajo de las partes aplicables.",
    autoNextPartName: "Iniciar automáticamente la siguiente parte",
    autoNextPartDesc: "Al pausar una parte, se inicia automáticamente la siguiente dentro de la misma sección.",
    alertsHeading: "Alertas",
    soundAlertName: "Alerta de sonido al sobrepasar el tiempo",
    soundAlertDesc: "Reproducir un pitido repetido cuando un temporizador alcanza su duración asignada.",
    soundDurName: "Duración de la alerta de sonido (segundos)",
    soundDurDesc: "Duración del pitido. Predeterminado: 1 s.",
    vibrateAlertName: "Alerta de vibración al sobrepasar el tiempo",
    vibrateAlertDesc: "Vibrar el dispositivo cuando un temporizador alcanza su duración asignada. Solo para móviles.",
    vibrateDurName: "Duración de la alerta de vibración (segundos)",
    vibrateDurDesc: "Duración de la vibración. Solo para móviles. Predeterminado: 2 s.",
  },
  "lp-f": {
    pageTitle: "JW Meeting Timer — Paramètres",
    langName: "Langue de la réunion",
    langDesc: "Langue utilisée pour récupérer le programme hebdomadaire depuis wol.jw.org.",
    customLocaleName: "Paramètre régional personnalisé (avancé)",
    customLocaleDesc: "Utiliser n’importe quel chemin de paramètre WOL, ex. «r4/lp-s». Laisser vide pour utiliser le menu.",
    startTimeName: "Heure de début de la réunion",
    startTimeDesc: "Format 24 h, ex. “20:00” ou “18:30”.",
    openingSongName: "Cantique + prière d’ouverture (minutes)",
    openingSongDesc: "Minutes fixes avant la première partie du programme (cantique + prière). Défaut : 5.",
    displayHeading: "Affichage",
    showAdviceName: "Afficher les chronomètres de conseil",
    showAdviceDesc: "Afficher la sous-carte de conseil d’1 minute sous les parties applicables.",    autoNextPartName: "Démarrer automatiquement la partie suivante",
    autoNextPartDesc: "Lors de la mise en pause d'une partie, démarre automatiquement la suivante dans la même section.",    alertsHeading: "Alertes",
    soundAlertName: "Alerte sonore en dépassement",
    soundAlertDesc: "Émettre un bip répété quand un chronomètre atteint sa durée allouée.",
    soundDurName: "Durée de l’alerte sonore (secondes)",
    soundDurDesc: "Durée du bip. Défaut : 1 s.",
    vibrateAlertName: "Alerte vibration en dépassement",
    vibrateAlertDesc: "Faire vibrer l’appareil quand un chronomètre atteint sa durée allouée. Mobile uniquement.",
    vibrateDurName: "Durée de l’alerte vibration (secondes)",
    vibrateDurDesc: "Durée de la vibration. Mobile uniquement. Défaut : 2 s.",
  },
  "lp-t": {
    pageTitle: "JW Meeting Timer — Configurações",
    langName: "Idioma da reunião",
    langDesc: "Idioma para obter o programa semanal de wol.jw.org.",
    customLocaleName: "Configuração regional personalizada (avançado)",
    customLocaleDesc: "Usar qualquer caminho de configuração WOL, ex. «r4/lp-s». Deixar em branco para usar o menu.",
    startTimeName: "Horário de início da reunião",
    startTimeDesc: "Formato de 24 horas, ex. “20:00” ou “18:30”.",
    openingSongName: "Cântico inicial + oração (minutos)",
    openingSongDesc: "Minutos fixos antes da primeira parte do programa (cântico + oração). Padrão: 5.",
    displayHeading: "Exibição",
    showAdviceName: "Exibir temporizadores de conselho",
    showAdviceDesc: "Exibir o subcárton de conselho de 1 minuto abaixo das partes aplicáveis.",
    autoNextPartName: "Iniciar automaticamente a próxima parte",
    autoNextPartDesc: "Ao pausar uma parte, inicia automaticamente a próxima na mesma seção.",
    alertsHeading: "Alertas",
    soundAlertName: "Alerta sonoro ao ultrapassar o tempo",
    soundAlertDesc: "Reproduzir um bipe repetido quando um temporizador atinge a duração atribuída.",
    soundDurName: "Duração do alerta sonoro (segundos)",
    soundDurDesc: "Duração do bipe. Padrão: 1 s.",
    vibrateAlertName: "Alerta de vibração ao ultrapassar o tempo",
    vibrateAlertDesc: "Vibrar o dispositivo quando um temporizador atinge a duração atribuída. Apenas mobile.",
    vibrateDurName: "Duração do alerta de vibração (segundos)",
    vibrateDurDesc: "Duração da vibração. Apenas mobile. Padrão: 2 s.",
  },
  "lp-x": {
    pageTitle: "JW Meeting Timer — Einstellungen",
    langName: "Versammlungssprache",
    langDesc: "Sprache zum Abrufen des Wochenprogramms von wol.jw.org.",
    customLocaleName: "Benutzerdefiniertes Gebietsschema (erweitert)",
    customLocaleDesc: "Beliebigen WOL-Lokalisierungspfad verwenden, z. B. «r4/lp-s». Leer lassen für Dropdown.",
    startTimeName: "Beginn der Versammlung",
    startTimeDesc: "24-Stunden-Format, z. B. “20:00” oder “18:30”.",
    openingSongName: "Eröffnungslied + Gebet (Minuten)",
    openingSongDesc: "Feste Minuten vor dem ersten Programmpunkt (Lied + Gebet). Standard: 5.",
    displayHeading: "Anzeige",
    showAdviceName: "Ratgeber-Timer anzeigen",
    showAdviceDesc: "Die 1-minütige Ratgeber-Unterkarte unter den zutreffenden Punkten anzeigen.",
    autoNextPartName: "Nächsten Teil automatisch starten",
    autoNextPartDesc: "Beim Pausieren eines Teils wird automatisch der nächste Teil in derselben Abschnitt gestartet.",
    alertsHeading: "Benachrichtigungen",
    soundAlertName: "Ton-Alarm bei Überschreitung",
    soundAlertDesc: "Wiederholenden Piepton abspielen, wenn ein Timer die vorgesehene Dauer erreicht.",
    soundDurName: "Ton-Alarm-Dauer (Sekunden)",
    soundDurDesc: "Dauer des Pieptons. Standard: 1 s.",
    vibrateAlertName: "Vibrations-Alarm bei Überschreitung",
    vibrateAlertDesc: "Gerät vibrieren lassen, wenn ein Timer die vorgesehene Dauer erreicht. Nur mobil.",
    vibrateDurName: "Vibrations-Alarm-Dauer (Sekunden)",
    vibrateDurDesc: "Dauer der Vibration. Nur mobil. Standard: 2 s.",
  },
  "lp-i": {
    pageTitle: "JW Meeting Timer — Impostazioni",
    langName: "Lingua della riunione",
    langDesc: "Lingua per ottenere il programma settimanale da wol.jw.org.",
    customLocaleName: "Impostazioni locali personalizzate (avanzato)",
    customLocaleDesc: "Usa qualsiasi percorso locale WOL, es. «r4/lp-s». Lasciare vuoto per usare il menu.",
    startTimeName: "Ora di inizio della riunione",
    startTimeDesc: "Formato 24 ore, es. “20:00” o “18:30”.",
    openingSongName: "Cantico iniziale + preghiera (minuti)",
    openingSongDesc: "Minuti fissi prima della prima parte del programma (cantico + preghiera). Predefinito: 5.",
    displayHeading: "Visualizzazione",
    showAdviceName: "Mostra timer di consiglio",
    showAdviceDesc: "Mostra la sotto-scheda di consiglio da 1 minuto sotto le parti applicabili.",
    autoNextPartName: "Avvia automaticamente la parte successiva",
    autoNextPartDesc: "Quando si mette in pausa una parte, avvia automaticamente quella successiva nella stessa sezione.",
    alertsHeading: "Avvisi",
    soundAlertName: "Avviso sonoro al superamento del tempo",
    soundAlertDesc: "Riproduci un bip ripetuto quando un timer raggiunge la durata assegnata.",
    soundDurName: "Durata avviso sonoro (secondi)",
    soundDurDesc: "Durata del bip. Predefinito: 1 s.",
    vibrateAlertName: "Avviso vibrazione al superamento del tempo",
    vibrateAlertDesc: "Far vibrare il dispositivo quando un timer raggiunge la durata assegnata. Solo mobile.",
    vibrateDurName: "Durata avviso vibrazione (secondi)",
    vibrateDurDesc: "Durata della vibrazione. Solo mobile. Predefinito: 2 s.",
  },
  "lp-u": {
    pageTitle: "JW Meeting Timer — Настройки",
    langName: "Язык встречи",
    langDesc: "Язык для загрузки еженедельной программы с wol.jw.org.",
    customLocaleName: "Пользовательский языковой стандарт (расширенный)",
    customLocaleDesc: "Используйте любой путь WOL, напр. «r4/lp-s». Оставьте пустым для использования списка.",
    startTimeName: "Время начала встречи",
    startTimeDesc: "Формат 24 часа, напр. «20:00» или «18:30».",
    openingSongName: "Вступительная песня + молитва (минуты)",
    openingSongDesc: "Фиксированные минуты до первой части программы (песня + молитва). По умолчанию: 5.",
    displayHeading: "Отображение",
    showAdviceName: "Показать таймеры совета",
    showAdviceDesc: "Показывать подкарточку совета на 1 минуту под применимыми частями.",
    autoNextPartName: "Автозапуск следующей части",
    autoNextPartDesc: "При паузе части автоматически запускает следующую в том же разделе.",
    alertsHeading: "Оповещения",
    soundAlertName: "Звуковое оповещение при превышении времени",
    soundAlertDesc: "Воспроизводить повторяющийся звук, когда таймер достигает отведённой длительности.",
    soundDurName: "Длительность звукового оповещения (секунды)",
    soundDurDesc: "Длительность звука. По умолчанию: 1 с.",
    vibrateAlertName: "Вибрационное оповещение при превышении времени",
    vibrateAlertDesc: "Вибрировать устройство, когда таймер достигает отведённой длительности. Только мобильные.",
    vibrateDurName: "Длительность вибрационного оповещения (секунды)",
    vibrateDurDesc: "Длительность вибрации. Только мобильные. По умолчанию: 2 с.",
  },
  "lp-m": {
    pageTitle: "JW Meeting Timer — Setări",
    langName: "Limba întâlnirii",
    langDesc: "Limba pentru preluarea programului săptămânal de pe wol.jw.org.",
    customLocaleName: "Setare regională personalizată (avansat)",
    customLocaleDesc: "Folosiți orice cale de setare regională WOL, ex. «r4/lp-s». Lăsați gol pentru meniu.",
    startTimeName: "Ora de început a întâlnirii",
    startTimeDesc: "Format 24 ore, ex. “20:00” sau “18:30”.",
    openingSongName: "Cântare inițială + rugăciune (minute)",
    openingSongDesc: "Minute fixe înainte de prima parte a programului (cântare + rugăciune). Implicit: 5.",
    displayHeading: "Afișare",
    showAdviceName: "Afișare temporizatoare de sfat",
    showAdviceDesc: "Afișați subcardul de sfat de 1 minut sub părțile aplicabile.",
    autoNextPartName: "Pornire automată a următoarei părți",
    autoNextPartDesc: "Când opriți o parte, pornește automat următoarea din aceeași secțiune.",
    alertsHeading: "Alerte",
    soundAlertName: "Alertă sonoră la depășirea timpului",
    soundAlertDesc: "Redați un bip repetat când un temporizator atinge durata alocată.",
    soundDurName: "Durata alertei sonore (secunde)",
    soundDurDesc: "Durata bipului. Implicit: 1 s.",
    vibrateAlertName: "Alertă vibratorie la depășirea timpului",
    vibrateAlertDesc: "Faceți dispozitivul să vibreze când un temporizator atinge durata alocată. Numai mobil.",
    vibrateDurName: "Durata alertei vibratorii (secunde)",
    vibrateDurDesc: "Durata vibrației. Numai mobil. Implicit: 2 s.",
  },
  "lp-bl": {
    pageTitle: "JW Meeting Timer — Настройки",
    langName: "Език на срещата",
    langDesc: "Език за извличане на седмичната програма от wol.jw.org.",
    customLocaleName: "Персонализирани регионални настройки (разширени)",
    customLocaleDesc: "Използвайте произволен WOL път, напр. «r4/lp-s». Оставете празно за падащото меню.",
    startTimeName: "Час на начало на срещата",
    startTimeDesc: "24-часов формат, напр. “20:00” или “18:30”.",
    openingSongName: "Начална песен + молитва (минути)",
    openingSongDesc: "Фиксирани минути преди първата програмна точка (песен + молитва). По подразбиране: 5.",
    displayHeading: "Показване",
    showAdviceName: "Показване на таймери за съвет",
    showAdviceDesc: "Показване на подкарточката за съвет от 1 минута под приложимите части.",
    autoNextPartName: "Автоматично стартиране на следващата точка",
    autoNextPartDesc: "При пауза на точка автоматично стартира следващата в същия раздел.",
    alertsHeading: "Сигнали",
    soundAlertName: "Звуков сигнал при надвишаване на времето",
    soundAlertDesc: "Възпроизвежда повтарящ звук, когато таймер достигне определената продължителност.",
    soundDurName: "Продължителност на звуковия сигнал (секунди)",
    soundDurDesc: "Продължителност на звука. По подразбиране: 1 с.",
    vibrateAlertName: "Вибрационен сигнал при надвишаване на времето",
    vibrateAlertDesc: "Вибрация на устройството, когато таймер достигне определената продължителност. Само мобилни.",
    vibrateDurName: "Продължителност на вибрационния сигнал (секунди)",
    vibrateDurDesc: "Продължителност на вибрацията. Само мобилни. По подразбиране: 2 с.",
  },
  "lp-o": {
    pageTitle: "JW Meeting Timer — Instellingen",
    langName: "Vergaderingstaal",
    langDesc: "Taal voor het ophalen van het weekprogramma van wol.jw.org.",
    customLocaleName: "Aangepast taalgebied (geavanceerd)",
    customLocaleDesc: "Gebruik een willekeurig WOL-locatiepad, bijv. «r4/lp-s». Leeg laten voor het keuzemenu.",
    startTimeName: "Starttijd vergadering",
    startTimeDesc: "24-uurs formaat, bijv. “20:00” of “18:30”.",
    openingSongName: "Openingslied + gebed (minuten)",
    openingSongDesc: "Vaste minuten voor het eerste programmapunt (lied + gebed). Standaard: 5.",
    displayHeading: "Weergave",
    showAdviceName: "Adviestimers weergeven",
    showAdviceDesc: "Toon de 1-minuut advieskaart onder de van toepassing zijnde onderdelen.",
    autoNextPartName: "Volgend onderdeel automatisch starten",
    autoNextPartDesc: "Wanneer u een onderdeel pauzeert, wordt het volgende in dezelfde sectie automatisch gestart.",
    alertsHeading: "Meldingen",
    soundAlertName: "Geluidswaarschuwing bij overschrijding",
    soundAlertDesc: "Speel een herhalende piep af wanneer een timer de toegewezen duur bereikt.",
    soundDurName: "Duur geluidswaarschuwing (seconden)",
    soundDurDesc: "Hoe lang de piep speelt. Standaard: 1 s.",
    vibrateAlertName: "Trilwaarschuwing bij overschrijding",
    vibrateAlertDesc: "Het apparaat laten trillen wanneer een timer de toegewezen duur bereikt. Alleen mobiel.",
    vibrateDurName: "Duur trilwaarschuwing (seconden)",
    vibrateDurDesc: "Hoe lang het apparaat trilt. Alleen mobiel. Standaard: 2 s.",
  },
  "lp-p": {
    pageTitle: "JW Meeting Timer — Ustawienia",
    langName: "Język spotkania",
    langDesc: "Język do pobierania tygodniowego programu z wol.jw.org.",
    customLocaleName: "Niestandardowe ustawienia regionalne (zaawansowane)",
    customLocaleDesc: "Użyj dowolnej ścieżki ustawień regionalnych WOL, np. «r4/lp-s». Pozostaw puste dla listy.",
    startTimeName: "Czas rozpoczęcia spotkania",
    startTimeDesc: "Format 24-godzinny, np. “20:00” lub “18:30”.",
    openingSongName: "Pieśń otwierająca + modlitwa (minuty)",
    openingSongDesc: "Stałe minuty przed pierwszą częścią programu (pieśń + modlitwa). Domyślnie: 5.",
    displayHeading: "Wyświetlanie",
    showAdviceName: "Pokaż timery rad",
    showAdviceDesc: "Pokaż podkartę rady na 1 minutę poniżej odpowiednich części.",
    autoNextPartName: "Automatyczne uruchamianie następnej części",
    autoNextPartDesc: "Po wstrzymaniu części automatycznie uruchamia następną w tej samej sekcji.",
    alertsHeading: "Alerty",
    soundAlertName: "Alert dźwiękowy przy przekroczeniu czasu",
    soundAlertDesc: "Odtwórz powtarzający się sygnał, gdy timer osiągnie przydzielony czas.",
    soundDurName: "Czas trwania alertu dźwiękowego (sekundy)",
    soundDurDesc: "Jak długo gra sygnał. Domyślnie: 1 s.",
    vibrateAlertName: "Alert wibracyjny przy przekroczeniu czasu",
    vibrateAlertDesc: "Wibruje urządzenie, gdy timer osiągnie przydzielony czas. Tylko urządzenia mobilne.",
    vibrateDurName: "Czas trwania alertu wibracyjnego (sekundy)",
    vibrateDurDesc: "Jak długo wibruje urządzenie. Tylko urządzenia mobilne. Domyślnie: 2 s.",
  },
  "lp-j": {
    pageTitle: "JW Meeting Timer — 設定",
    langName: "集会の言語",
    langDesc: "wol.jw.orgから週のプログラムを取得する言語。",
    customLocaleName: "カスタムロケール（上級者向け）",
    customLocaleDesc: "WOLロケールパスを指定（例：「r4/lp-s」）。ドロップダウンを使用する場合は空白にします。",
    startTimeName: "集会開始時間",
    startTimeDesc: "24時間形式（例：「20:00」または「18:30」）。",
    openingSongName: "始めの歌＋祝いの言葉（分）",
    openingSongDesc: "最初のプログラム前の固定分数（歌＋祝いの言葉）。デフォルト：5。",
    displayHeading: "表示",
    showAdviceName: "助言タイマーを表示",
    showAdviceDesc: "該当するパートの下に1分間の助言サブカードを表示します。",
    autoNextPartName: "次のパートを自動開始",
    autoNextPartDesc: "パートを一時停止すると、同じセクション内の次のパートが自動的に開始されます。",
    alertsHeading: "アラート",
    soundAlertName: "超過時の音声アラート",
    soundAlertDesc: "タイマーが割り当て時間に達したときに繰り返し音を鳴らします。",
    soundDurName: "音声アラートの長さ（秒）",
    soundDurDesc: "音声の長さ。デフォルト：1秒。",
    vibrateAlertName: "超過時の振動アラート",
    vibrateAlertDesc: "タイマーが割り当て時間に達したときにデバイスを振動させます。モバイルのみ。",
    vibrateDurName: "振動アラートの長さ（秒）",
    vibrateDurDesc: "振動の長さ。モバイルのみ。デフォルト：2秒。",
  },
  "lp-ko": {
    pageTitle: "JW Meeting Timer — 설정",
    langName: "집회 언어",
    langDesc: "wol.jw.org에서 주간 프로그램을 가져올 언어.",
    customLocaleName: "사용자 지정 로케일 (고급)",
    customLocaleDesc: "WOL 로케일 경로를 입력하세요 (예: ‘r4/lp-s’). 드롭다운을 사용하려면 비워 두세요.",
    startTimeName: "집회 시작 시간",
    startTimeDesc: "24시간 형식 (예: ‘20:00’ 또는 ‘18:30’).",
    openingSongName: "시작 노래 + 기도 (분)",
    openingSongDesc: "첫 번째 프로그램 전 고정 분수 (노래 + 기도). 기본값: 5.",
    displayHeading: "표시",
    showAdviceName: "조언 타이머 표시",
    showAdviceDesc: "해당 부분 아래에 1분 조언 서브카드를 표시합니다.",
    autoNextPartName: "다음 순서 자동 시작",
    autoNextPartDesc: "한 순서를 일시 정지하면 같은 섹션의 다음 순서가 자동으로 시작됩니다.",
    alertsHeading: "알림",
    soundAlertName: "초과 시 소리 알림",
    soundAlertDesc: "타이머가 할당된 시간에 도달하면 반복 소리를 재생합니다.",
    soundDurName: "소리 알림 지속 시간 (초)",
    soundDurDesc: "소리 지속 시간. 기본값: 1초.",
    vibrateAlertName: "초과 시 진동 알림",
    vibrateAlertDesc: "타이머가 할당된 시간에 도달하면 장치를 진동시킵니다. 모바일 전용.",
    vibrateDurName: "진동 알림 지속 시간 (초)",
    vibrateDurDesc: "진동 지속 시간. 모바일 전용. 기본값: 2초.",
  },
  "lp-a": {
    pageTitle: "JW Meeting Timer — الإعدادات",
    langName: "لغة الاجتماع",
    langDesc: "اللغة المستخدمة لجلب البرنامج الأسبوعي من wol.jw.org.",
    customLocaleName: "لغة مخصصة (متقدم)",
    customLocaleDesc: 'استخدم أي مسار لغة WOL، مثل "r4/lp-s". اتركه فارغاً للقائمة المنسدلة.',
    startTimeName: "وقت بدء الاجتماع",
    startTimeDesc: 'تنسيق 24 ساعة، مثل "20:00" أو "18:30".',
    openingSongName: "الترنيمة الافتتاحية + الصلاة (دقائق)",
    openingSongDesc: "الدقائق الثابتة قبل أول جزء (ترنيمة + صلاة). الافتراضي: 5.",
    displayHeading: "العرض",
    showAdviceName: "إظهار مؤقتات النصيحة",
    showAdviceDesc: "إظهار بطاقة النصيحة لمدة دقيقة واحدة أسفل الأجزاء المعنية.",
    autoNextPartName: "بدء الجزء التالي تلقائياً",
    autoNextPartDesc: "عند إيقاف جزء مؤقتاً، يبدأ الجزء التالي في نفس القسم تلقائياً.",
    alertsHeading: "التنبيهات",
    soundAlertName: "تنبيه صوتي عند تجاوز الوقت",
    soundAlertDesc: "تشغيل صوت متكرر عندما يصل المؤقت إلى المدة المخصصة.",
    soundDurName: "مدة التنبيه الصوتي (ثوانٍ)",
    soundDurDesc: "مدة تشغيل الصوت. الافتراضي: 1 ثانية.",
    vibrateAlertName: "تنبيه اهتزازي عند تجاوز الوقت",
    vibrateAlertDesc: "اهتزاز الجهاز عندما يصل المؤقت إلى المدة المخصصة. الهاتف فقط.",
    vibrateDurName: "مدة التنبيه الاهتزازي (ثوانٍ)",
    vibrateDurDesc: "مدة الاهتزاز. الهاتف فقط. الافتراضي: 2 ثانية.",
  },
  "lp-z": {
    pageTitle: "JW Meeting Timer — Inställningar",
    langName: "Mötets språk",
    langDesc: "Språk för att hämta veckoprogrammet från wol.jw.org.",
    customLocaleName: "Anpassad region (avancerat)",
    customLocaleDesc: 'Använd valfri WOL-sökväg, t.ex. "r4/lp-s". Lämna tomt för rullgardinslistan.',
    startTimeName: "Mötets starttid",
    startTimeDesc: '24-timmarsformat, t.ex. "20:00" eller "18:30".',
    openingSongName: "Inledningssång + bön (minuter)",
    openingSongDesc: "Fasta minuter före det första programpunkten (sång + bön). Standard: 5.",
    displayHeading: "Visning",
    showAdviceName: "Visa råd-timers",
    showAdviceDesc: "Visa 1-minuters råd-underkortet under tillämpliga delar.",
    autoNextPartName: "Starta nästa del automatiskt",
    autoNextPartDesc: "När du pausar en del startar nästa del i samma avsnitt automatiskt.",
    alertsHeading: "Aviseringar",
    soundAlertName: "Ljud-avisering vid övertid",
    soundAlertDesc: "Spela ett upprepande ljud när en timer når sin tilldelade tid.",
    soundDurName: "Ljud-aviseringens varaktighet (sekunder)",
    soundDurDesc: "Hur länge ljudet spelas. Standard: 1 s.",
    vibrateAlertName: "Vibrations-avisering vid övertid",
    vibrateAlertDesc: "Vibrera enheten när en timer når sin tilldelade tid. Endast mobil.",
    vibrateDurName: "Vibrations-aviseringens varaktighet (sekunder)",
    vibrateDurDesc: "Hur länge enheten vibrerar. Endast mobil. Standard: 2 s.",
  },
  "lp-tk": {
    pageTitle: "JW Meeting Timer — Ayarlar",
    langName: "Toplantı dili",
    langDesc: "wol.jw.org'dan haftalık programı almak için kullanılan dil.",
    customLocaleName: "Özel yerel ayar (gelişmiş)",
    customLocaleDesc: 'Herhangi bir WOL yerel ayar yolu kullanın, ör. "r4/lp-s". Açılır listesi için boş bırakın.',
    startTimeName: "Toplantı başlangıç saati",
    startTimeDesc: '24 saat formatı, ör. "20:00" veya "18:30".',
    openingSongName: "Açılış ilahisi + dua (dakika)",
    openingSongDesc: "İlk programın öncesindeki sabit dakikalar (ilahi + dua). Varsayılan: 5.",
    displayHeading: "Görünüm",
    showAdviceName: "Tavsiye zamanlayıcılarını göster",
    showAdviceDesc: "Uygun bölümlerin altında 1 dakikalık tavsiye alt kartını göster.",
    autoNextPartName: "Sonraki bölümü otomatik başlat",
    autoNextPartDesc: "Bir bölümü duraklatınca, aynı kısımdaki sonraki bölüm otomatik olarak başlar.",
    alertsHeading: "Uyarılar",
    soundAlertName: "Süre aşımında ses uyarısı",
    soundAlertDesc: "Zamanlayıcı tahsis edilen süreye ulaşınca tekrarlayan bir bip sesi çal.",
    soundDurName: "Ses uyarısı süresi (saniye)",
    soundDurDesc: "Bip sesinin çalma süresi. Varsayılan: 1 s.",
    vibrateAlertName: "Süre aşımında titreşim uyarısı",
    vibrateAlertDesc: "Zamanlayıcı tahsis edilen süreye ulaşınca cihazı titret. Yalnızca mobil.",
    vibrateDurName: "Titreşim uyarısı süresi (saniye)",
    vibrateDurDesc: "Cihazın titreşim süresi. Yalnızca mobil. Varsayılan: 2 s.",
  },
  "lp-chs": {
    pageTitle: "JW Meeting Timer — 设置",
    langName: "聚会语言",
    langDesc: "用于从 wol.jw.org 获取每周节目的语言。",
    customLocaleName: "自定义区域设置（高级）",
    customLocaleDesc: "使用任意 WOL 区域路径，例如 “r4/lp-s”。留空则使用下拉列表。",
    startTimeName: "聚会开始时间",
    startTimeDesc: "24小时格式，例如 “20:00” 或 “18:30”。",
    openingSongName: "开始颂歌 + 祈祷（分钟）",
    openingSongDesc: "第一个节目部分前的固定分钟数（颂歌 + 祈祷）。默认：5。",
    displayHeading: "显示",
    showAdviceName: "显示建议计时器",
    showAdviceDesc: "在适用部分下方显示1分钟讲师建议子卡片。",
    autoNextPartName: "自动开始下一个项目",
    autoNextPartDesc: "暂停一个项目时，自动开始同一部分的下一个项目。",
    alertsHeading: "提醒",
    soundAlertName: "超时时的声音提醒",
    soundAlertDesc: "当计时器达到分配时间时播放重复提示音。",
    soundDurName: "声音提醒持续时间（秒）",
    soundDurDesc: "提示音时长。默认：1秒。",
    vibrateAlertName: "超时时的震动提醒",
    vibrateAlertDesc: "当计时器达到分配时间时震动设备。仅限移动端。",
    vibrateDurName: "震动提醒持续时间（秒）",
    vibrateDurDesc: "震动时长。仅限移动端。默认：2秒。",
  },
};
