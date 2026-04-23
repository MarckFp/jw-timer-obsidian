import { App, PluginSettingTab, Setting } from "obsidian";
import type JwTimerPlugin from "./main";
import type { PluginSettings } from "./types";

// Available WOL locales: label → locale path segment
const WOL_LOCALES: Record<string, string> = {
  "English":    "r1/lp-e",
  "Spanish":    "r4/lp-s",
  "Portuguese": "r5/lp-t",
  "French":     "r30/lp-f",
  "Italian":    "r6/lp-i",
  "German":     "r10/lp-x",
  "Dutch":      "r18/lp-o",
  "Japanese":   "r7/lp-j",
  "Korean":     "r8/lp-ko",
  "Chinese (Simplified)": "r23/lp-chs",
  "Romanian":   "r34/lp-m",
  "Bulgarian":  "r46/lp-bl",
  "Russian":    "r2/lp-u",
};

export class JwTimerSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: JwTimerPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "JW Meeting Timer — Settings" });

    // Language / locale
    new Setting(containerEl)
      .setName("Meeting language")
      .setDesc("Language used to fetch the weekly programme from wol.jw.org.")
      .addDropdown((drop) => {
        for (const [label, value] of Object.entries(WOL_LOCALES)) {
          drop.addOption(value, label);
        }
        // If the current locale is a known dropdown value, select it; otherwise leave at default
        const knownValues = Object.values(WOL_LOCALES);
        if (knownValues.includes(this.plugin.settings.wolLocale)) {
          drop.setValue(this.plugin.settings.wolLocale);
        }
        drop.onChange(async (value) => {
          this.plugin.settings.wolLocale = value;
          await this.plugin.saveSettings();
          // Clear the custom-locale text field so it doesn’t mislead
          if (customLocaleText) customLocaleText.setValue("");
        });
      });

    // Custom locale override
    let customLocaleText: import("obsidian").TextComponent;
    const knownValues = Object.values(WOL_LOCALES);
    const currentIsCustom = !knownValues.includes(this.plugin.settings.wolLocale);
    new Setting(containerEl)
      .setName("Custom locale (advanced)")
      .setDesc(
        'Override with any WOL locale path, e.g. "r4/lp-s". Leave blank to use the dropdown selection.'
      )
      .addText((text) => {
        customLocaleText = text;
        text
          .setPlaceholder("r1/lp-e")
          // Show the saved custom value only when it isn’t one of the dropdown options
          .setValue(currentIsCustom ? this.plugin.settings.wolLocale : "")
          .onChange(async (value) => {
            const trimmed = value.trim();
            if (trimmed) {
              this.plugin.settings.wolLocale = trimmed;
              await this.plugin.saveSettings();
            }
          });
      });

    // Meeting start time
    new Setting(containerEl)
      .setName("Meeting start time")
      .setDesc('24-hour format, e.g. "20:00" or "18:30".')
      .addText((text) => {
        text
          .setPlaceholder("20:00")
          .setValue(this.plugin.settings.meetingStartTime)
          .onChange(async (value) => {
            const trimmed = value.trim();
            if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
              this.plugin.settings.meetingStartTime = trimmed;
              await this.plugin.saveSettings();
            }
          });
      });

    // Opening song duration
    new Setting(containerEl)
      .setName("Opening song + prayer (minutes)")
      .setDesc("Fixed minutes before the first programme part (song + prayer). Default: 5.")
      .addSlider((slider) => {
        slider
          .setLimits(1, 15, 1)
          .setValue(this.plugin.settings.openingSongMinutes)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.openingSongMinutes = value;
            await this.plugin.saveSettings();
          });
      });

    // Manual refresh button
    new Setting(containerEl)
      .setName("Refresh schedule")
      .setDesc("Clear the cached schedule and re-fetch from wol.jw.org.")
      .addButton((btn) => {
        btn.setButtonText("Refresh now").onClick(async () => {
          await this.plugin.clearCacheAndRefresh();
          btn.setButtonText("Done ✓");
          window.setTimeout(() => btn.setButtonText("Refresh now"), 2000);
        });
      });

    containerEl.createEl("h3", { text: "Display" });

    new Setting(containerEl)
      .setName("Show advice timers")
      .setDesc("Show the 1-minute instructor advice sub-card below applicable parts.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.showAdvice)
          .onChange(async (value) => {
            this.plugin.settings.showAdvice = value;
            await this.plugin.saveSettings();
            await this.plugin.reloadView();
          });
      });

    containerEl.createEl("h3", { text: "Alerts" });

    // Sound alert
    new Setting(containerEl)
      .setName("Sound alert at overtime")
      .setDesc("Play a repeating beep when a timer reaches its allotted duration.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.alertSound)
          .onChange(async (value) => {
            this.plugin.settings.alertSound = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Sound alert duration (seconds)")
      .setDesc("How long the beep plays. Default: 2 s.")
      .addSlider((slider) => {
        slider
          .setLimits(1, 10, 1)
          .setValue(this.plugin.settings.alertSoundSec)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.alertSoundSec = value;
            await this.plugin.saveSettings();
          });
      });

    // Vibration alert
    new Setting(containerEl)
      .setName("Vibration alert at overtime")
      .setDesc("Vibrate the device when a timer reaches its allotted duration. Has no effect on desktop.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.alertVibrate)
          .onChange(async (value) => {
            this.plugin.settings.alertVibrate = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Vibration alert duration (seconds)")
      .setDesc("How long the device vibrates. Has no effect on desktop. Default: 5 s.")
      .addSlider((slider) => {
        slider
          .setLimits(1, 30, 1)
          .setValue(this.plugin.settings.alertVibrateSec)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.alertVibrateSec = value;
            await this.plugin.saveSettings();
          });
      });
  }
}
