# JW Meeting Timer

An [Obsidian](https://obsidian.md/) sidebar plugin that provides per-part stopwatches for JW congregation meetings. It automatically fetches the week's programme from **wol.jw.org** and builds a timer card for each part, so the meeting overseer or timekeeper can track every item with a single tap.

---

## Features

- **Auto-fetched schedule** — scrapes the week's programme from wol.jw.org in your chosen language. Cached locally; re-fetched only when stale.
- **Per-part timer cards** — one stopwatch per part; shows elapsed time, a progress bar, and the scheduled end time.
- **Advice sub-timers** — optional 1-minute instructor-feedback timer below applicable parts (Bible reading, ministry demonstrations).
- **Visual overtime indicator** — card turns red when a part exceeds its allotted time; audio beep and/or vibration alert (configurable).
- **Meeting progress bar** — global bar showing total elapsed vs. total allotted time.
- **Week navigation** — browse past and future weeks.
- **Customisable parts** — add your own stopwatches, edit labels/durations, reorder parts with long-press, delete parts.
- **Auto-start next part** — when you pause a part, the next one in the same section starts automatically (opt-in).
- **Export** — share a text summary via WhatsApp, Telegram, etc.
- **14 languages** — English, Spanish, French, Portuguese, German, Italian, Russian, Romanian, Bulgarian, Dutch, Polish, Japanese, Korean, Simplified Chinese.
- **Auto-detect locale** on first install based on your device language.

---

## Installation via BRAT (recommended for beta testers)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tool) lets you install plugins directly from GitHub without waiting for them to be in the Obsidian community plugins directory.

### Step 1 — Install BRAT

1. Open Obsidian → **Settings** → **Community plugins**.
2. Make sure **Restricted mode** is **off**.
3. Click **Browse**, search for **BRAT**, and install it.
4. Enable BRAT.

### Step 2 — Add this plugin via BRAT

1. Open the BRAT settings (**Settings** → **BRAT**).
2. Click **Add Beta plugin**.
3. Paste the repository URL:
   ```
   https://github.com/MarckFp/jw-timer-obsidian
   ```
4. Click **Add Plugin**. BRAT will download and install it.
5. Go to **Settings** → **Community plugins**, find **JW Meeting Timer**, and enable it.

### Step 3 — First launch

A timer sidebar will open automatically. A settings panel appears under **Settings** → **JW Meeting Timer**.

---

## Manual installation (advanced)

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/YOUR_USERNAME/jw-timer-obsidian/releases).
2. In your vault, navigate to `.obsidian/plugins/` and create a folder named `jw-timer-sidebar`.
3. Copy the three files into that folder.
4. Restart Obsidian, then enable the plugin under **Settings** → **Community plugins**.

---

## Usage

### Opening the sidebar

- Click the **timer icon** (⏱) in the left ribbon, or
- Run the command **"Open JW Meeting Timer sidebar"** from the command palette (`Ctrl/Cmd + P`).

### Navigating weeks

Use the **◀ ▶** arrows in the nav bar to browse weeks. The **Today** button jumps back to the current week.

### Using the timers

| Action                      | How                                 |
| --------------------------- | ----------------------------------- |
| Start a part                | Tap **Play**                        |
| Pause a part                | Tap **Pause**                       |
| Reset a part                | Tap **Reset** → **Confirm?**        |
| Reset all                   | Tap **Reset All** → **Confirm?**    |
| Edit / Delete / Move a part | Long-press a card → overlay menu    |
| Add a custom stopwatch      | Tap the **+** button in the toolbar |

### Exporting results

Scroll to the bottom of the list to find the **Share** button:

- **Share** — builds a plain-text summary of all parts and their elapsed times. On mobile (Android/iOS), this opens the native share sheet so you can send it via WhatsApp, Telegram, email, etc. On desktop it copies the text to the clipboard.

---

## Settings

Open **Settings** → **JW Meeting Timer**.

| Setting                         | Description                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------- |
| **Language**                    | WOL locale used to fetch and display the schedule.                                |
| **Custom locale (advanced)**    | Enter any WOL locale path (e.g. `r4/lp-s`) to use a language not in the dropdown. |
| **Meeting start time**          | Start time in 24-hour format, e.g. `20:00`.                                       |
| **Opening song + prayer (min)** | Minutes reserved before the first programme part (song + prayer). Default: 5.     |
| **Show advice timers**          | Show the 1-minute instructor advice sub-card below applicable parts.              |
| **Auto-start next part**        | When you pause a part, automatically start the next one in the same section.      |
| **Sound alert at overtime**     | Play a repeating beep when a part exceeds its allotted time.                      |
| **Sound alert duration**        | How long the beep plays (seconds).                                                |
| **Vibration alert at overtime** | Vibrate the device at overtime. Mobile only.                                      |
| **Vibration alert duration**    | How long the device vibrates (seconds).                                           |

---

## How it works

1. On load, the plugin fetches the weekly programme from `wol.jw.org/{locale}/wol/meetings/r*/lp-*` for the current week.
2. The HTML is parsed to extract part labels, durations, and sections.
3. Timer states (elapsed ms) are persisted in Obsidian's plugin data so timers survive restarts.
4. A 250 ms tick updates only the cards whose timers are currently running (skipped entirely when all timers are idle).

---

## Development

```bash
# Install dependencies
npm install

# Build (esbuild, watch mode)
npm run dev

# Production build
npm run build

# Type-check only
npx tsc --noEmit
```

Entry point: `src/main.ts`  
Bundled output: `main.js` (loaded by Obsidian)

### Project structure

```
src/
├── main.ts            Plugin entry point & data persistence
├── view.ts            JwTimerView — the sidebar ItemView
├── scraper.ts         wol.jw.org HTML parser
├── timer-engine.ts    In-memory timer state machine
├── types.ts           Shared TypeScript interfaces
├── settings-tab.ts    Settings panel
└── ui/
    ├── locale.ts      i18n strings (14 languages)
    ├── helpers.ts     Pure utility functions & CardRefs interface
    ├── modals.ts      EditPartModal, AddPartModal
    ├── card-renderer.ts  renderCard / renderAdviceCard (CardController pattern)
    └── exporter.ts    Export-to-text (share / clipboard) logic
```

---

## License

MIT
