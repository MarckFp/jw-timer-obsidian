import { App, PluginSettingTab, Setting } from "obsidian";
import type JwTimerPlugin from "./main";
import { LOCALE_SETTINGS } from "./ui/locale";

// Available WOL locales shown in the dropdown: [display label, locale path]
const WOL_LOCALES: [string, string][] = [
  ["English", "r1/lp-e"],
  ["Español", "r4/lp-s"],
  ["Português", "r5/lp-t"],
  ["Français", "r30/lp-f"],
  ["Italiano", "r6/lp-i"],
  ["Deutsch", "r10/lp-x"],
  ["Nederlands", "r18/lp-o"],
  ["Русский", "r2/lp-u"],
  ["Română", "r34/lp-m"],
  ["Български", "r46/lp-bl"],
  ["Polski", "r17/lp-p"],
  ["Arabic / عربي", "r8/lp-a"],
  ["Svenska", "r16/lp-z"],
  ["Türkçe", "r24/lp-tk"],
  ["日本語", "r7/lp-j"],
  ["한국어", "r8/lp-ko"],
  ["中文（简体）", "r23/lp-chs"],
];

/** Map browser language codes to WOL locale paths. Used on first install only. */
export function detectWolLocale(): string {
  const lang = (navigator.language ?? "en").toLowerCase();
  if (lang.startsWith("es")) return "r4/lp-s";
  if (lang.startsWith("pt")) return "r5/lp-t";
  if (lang.startsWith("fr")) return "r30/lp-f";
  if (lang.startsWith("it")) return "r6/lp-i";
  if (lang.startsWith("de")) return "r10/lp-x";
  if (lang.startsWith("nl")) return "r18/lp-o";
  if (lang.startsWith("ja")) return "r7/lp-j";
  if (lang.startsWith("ko")) return "r8/lp-ko";
  if (lang.startsWith("zh")) return "r23/lp-chs";
  if (lang.startsWith("ro")) return "r34/lp-m";
  if (lang.startsWith("bg")) return "r46/lp-bl";
  if (lang.startsWith("ru")) return "r2/lp-u";
  if (lang.startsWith("pl")) return "r17/lp-p";
  if (lang.startsWith("ar")) return "r8/lp-a";
  if (lang.startsWith("sv")) return "r16/lp-z";
  if (lang.startsWith("tr")) return "r24/lp-tk";
  return "r1/lp-e";
}

export class JwTimerSettingsTab extends PluginSettingTab {
  private reloadDebounceHandle: number | null = null;

  constructor(
    app: App,
    private readonly plugin: JwTimerPlugin,
  ) {
    super(app, plugin);
  }

  /** Debounced reloadView — coalesces rapid input changes (e.g. typing start time) into one reload. */
  private scheduleReload(): void {
    if (this.reloadDebounceHandle !== null)
      window.clearTimeout(this.reloadDebounceHandle);
    this.reloadDebounceHandle = window.setTimeout(async () => {
      this.reloadDebounceHandle = null;
      await this.plugin.reloadView();
    }, 300);
  }

  private getLang(): string {
    return this.plugin.settings.wolLocale.split("/")[1] ?? "lp-e";
  }

  private getLabels() {
    return LOCALE_SETTINGS[this.getLang()] ?? LOCALE_SETTINGS["lp-e"];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const L = this.getLabels();

    containerEl.createEl("h2", { text: L.pageTitle });

    // ── Language / locale ────────────────────────────────────────────────────
    const knownValues = WOL_LOCALES.map(([, v]) => v);
    const currentIsCustom = !knownValues.includes(
      this.plugin.settings.wolLocale,
    );

    new Setting(containerEl)
      .setName(L.langName)
      .setDesc(L.langDesc)
      .addDropdown((drop) => {
        for (const [label, value] of WOL_LOCALES) {
          drop.addOption(value, label);
        }
        if (!currentIsCustom) drop.setValue(this.plugin.settings.wolLocale);
        drop.onChange(async (value) => {
          this.plugin.settings.wolLocale = value;
          await this.plugin.saveSettings();
          // Changing language requires re-fetching the schedule from WOL
          await this.plugin.clearCacheAndRefresh();
          // Re-render settings panel in the newly selected language
          this.display();
        });
      });

    // ── Custom locale override ───────────────────────────────────────────────
    new Setting(containerEl)
      .setName(L.customLocaleName)
      .setDesc(L.customLocaleDesc)
      .addText((text) => {
        text
          .setPlaceholder("r1/lp-e")
          .setValue(currentIsCustom ? this.plugin.settings.wolLocale : "")
          .onChange(async (value) => {
            const trimmed = value.trim();
            if (trimmed) {
              this.plugin.settings.wolLocale = trimmed;
              await this.plugin.saveSettings();
              await this.plugin.clearCacheAndRefresh();
              this.display();
            }
          });
      });

    // ── Meeting start time ───────────────────────────────────────────────────
    new Setting(containerEl)
      .setName(L.startTimeName)
      .setDesc(L.startTimeDesc)
      .addText((text) => {
        text
          .setPlaceholder("20:00")
          .setValue(this.plugin.settings.meetingStartTime)
          .onChange(async (value) => {
            const trimmed = value.trim();
            if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
              this.plugin.settings.meetingStartTime = trimmed;
              await this.plugin.saveSettings();
              this.scheduleReload();
            }
          });
      });

    // ── Opening song duration ────────────────────────────────────────────────
    new Setting(containerEl)
      .setName(L.openingSongName)
      .setDesc(L.openingSongDesc)
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.max = "15";
        text.inputEl.style.width = "4.5rem";
        text
          .setValue(String(this.plugin.settings.openingSongMinutes))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            if (!isNaN(n) && n >= 1 && n <= 15) {
              this.plugin.settings.openingSongMinutes = n;
              await this.plugin.saveSettings();
              this.scheduleReload();
            }
          });
      });

    // ── Display ──────────────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: L.displayHeading });

    new Setting(containerEl)
      .setName(L.showAdviceName)
      .setDesc(L.showAdviceDesc)
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showAdvice)
          .onChange(async (value) => {
            this.plugin.settings.showAdvice = value;
            await this.plugin.saveSettings();
            await this.plugin.reloadView();
          });
      });

    new Setting(containerEl)
      .setName(L.autoNextPartName)
      .setDesc(L.autoNextPartDesc)
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.autoNextPart)
          .onChange(async (value) => {
            this.plugin.settings.autoNextPart = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(L.showNotesName)
      .setDesc(L.showNotesDesc)
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showNotes)
          .onChange(async (value) => {
            this.plugin.settings.showNotes = value;
            await this.plugin.saveSettings();
            await this.plugin.reloadView();
          });
      });

    // ── Alerts ───────────────────────────────────────────────────────────────
    containerEl.createEl("h3", { text: L.alertsHeading });

    new Setting(containerEl)
      .setName(L.soundAlertName)
      .setDesc(L.soundAlertDesc)
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.alertSound)
          .onChange(async (value) => {
            this.plugin.settings.alertSound = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(L.soundDurName)
      .setDesc(L.soundDurDesc)
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.max = "10";
        text.inputEl.style.width = "4.5rem";
        text
          .setValue(String(this.plugin.settings.alertSoundSec))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            if (!isNaN(n) && n >= 1 && n <= 10) {
              this.plugin.settings.alertSoundSec = n;
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(containerEl)
      .setName(L.vibrateAlertName)
      .setDesc(L.vibrateAlertDesc)
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.alertVibrate)
          .onChange(async (value) => {
            this.plugin.settings.alertVibrate = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(L.vibrateDurName)
      .setDesc(L.vibrateDurDesc)
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.max = "30";
        text.inputEl.style.width = "4.5rem";
        text
          .setValue(String(this.plugin.settings.alertVibrateSec))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            if (!isNaN(n) && n >= 1 && n <= 30) {
              this.plugin.settings.alertVibrateSec = n;
              await this.plugin.saveSettings();
            }
          });
      });
  }
}
