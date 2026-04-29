# Changelog

All notable changes to **JW Meeting Timer** are listed here.
New entries and version bumps are written automatically by AI on every commit.
To release: run `npm run release` — it seals `[Unreleased]`, commits, tags, and pushes.

---

## [Unreleased]

## [4.8.0] – 2026-04-29

- Changed the release script to only tag and push the current commit, simplifying the release process.
- Updated the changelog update script to automatically add new bullets and seal the changelog with the current date and version.
- Changed the gear button icon to a vertical ellipsis for better visual representation.
- Updated CSS styles for the gear button to improve layout and responsiveness.
- Added a script to automate the release process, including sealing the changelog and pushing the release to GitHub.
- Added a script to automate changelog updates and version bumps based on git commits.

## [4.7.0] - 2026-04-29

- Added **Clear cache** button in Settings to wipe all fetched weekly schedules — useful when a schedule looks wrong or stale.
- Removed right-click context menu on cards. The gear button (⚙) is now the only way to open card options on all platforms.
- Alert duration range (sound and vibration) tightened to **1–5 seconds** maximum.
- Vibration redesigned as a **phone-ring pattern**: two quick bursts per second, repeated for the configured number of seconds. Uses individual `navigator.vibrate()` calls for full Android WebView compatibility.
- Share button now **copies to clipboard** on all platforms. The button label temporarily shows "Copied!" then reverts — no modal, no platform-specific branching.

---

## [4.6.4] – 2026-04-29

- Investigated share sheet approach via `navigator.share` — confirmed not available in Obsidian's WebView on Android/iOS.

## [4.6.3] – 2026-04-29

- Debugging session for share context menu triggering.

## [4.6.2] – 2026-04-29

- Attempted another fix for the Android context menu not opening.

## [4.6.1] – 2026-04-29

- Added right-click on desktop cards to open the options overlay.
- Tracked pointer type to avoid long-press on touchscreens accidentally triggering the overlay.

## [4.6.0] – 2026-04-29

- Fixed Share button layout and ensured clipboard fallback worked correctly on desktop.

---

## [4.5.3] – 2026-04-28

- Fixed vibration pattern not respecting duration on certain Android WebViews.

## [4.5.2] – 2026-04-28

- Made overtime vibration more noticeable by increasing pulse length.

## [4.5.1] – 2026-04-28

- Improved visibility of the gear icon (⚙) in card headers.

## [4.5.0] – 2026-04-28

- Replaced long-press interaction with a **persistent gear button** (⚙) in each card header. On touch devices it is always visible; on hover devices it appears on hover.
- Centered and enlarged the loading spinner overlay (2.5 rem, accent colour).
- Reset action now also clears the saved note for that part.

---

## [4.4.0] – 2026-04-28

- **Markdown notes**: part notes are now rendered as Markdown. Click to switch to edit mode; blur to render again.
- **Inline validation** on all Settings fields with clear error messages and `aria-invalid` highlighting.
- **Inline validation** on modal duration and label fields with focus-on-error behaviour.
- **Accessibility**: status bar has `aria-live="polite"` and `aria-atomic`; section headings have `aria-expanded`.
- **Smarter cache eviction**: past weeks kept 7 days after the week ends; future weeks kept 30 days from fetch time.
- GitHub Actions updated to use Node.js 20-compatible action versions.

---

## [4.3.0] – 2026-04-28

- **Collapsible sections**: each meeting section (Treasures, Ministry, Christian Living) can be collapsed with an animated chevron. State is preserved for the session.
- **Show notes toggle** in Settings: hide or show the per-part note field globally.
- **Auto-start next part** setting: when pausing a part, the next part in the same section starts automatically.

---

## [4.2.2] – 2026-04-23

- Full TypeScript strict mode — zero implicit `any` types across the entire codebase.

## [4.2.1] – 2026-04-23

- Fixed card state animation flickering on timer transitions.

## [4.2.0] – 2026-04-23

- Refactored plugin architecture for maintainability.
- Fixed auto-open sidebar panel on Obsidian startup.
- Performance improvements in the tick loop.

---

## [4.1.0] – 2026-04-23

- Removed PDF export feature — too heavy for an Obsidian plugin context.
- Various small bug fixes.

---

## [4.0.0] – 2026-04-23

- **Share / Export**: generates a formatted plain-text summary of all meeting parts with elapsed times and statuses.
- Copies to clipboard with a brief "Copied!" confirmation.

---

## [3.5.0] – 2026-04-23

- **Auto-start next part**: configurable option to automatically start the next part when the current one is paused.
- Code cleanup and refactoring pass.

---

## [3.4.0] – 2026-04-23

- Settings panel reworked: cleaner layout, better grouping (Language, Schedule, Display, Alerts).
- Language auto-detection from browser locale on first install.

---

## [3.3.0] – 2026-04-23

- Code split into separate modules: `card-renderer`, `modals`, `exporter`, `helpers`, `locale`.
- Fixed vibration not honouring duration setting on some Android devices.

---

## [3.2.0] – 2026-04-23

- Added per-part **note field**: type free text below any timer card. Notes persist across sessions.
- Added **advice timer sub-card** for parts that have an instructor feedback slot (Bible reading, ministry).
- Week navigation (previous / next week).

---

## [3.1.0] – 2026-04-23

- Fixed meeting bar progress calculation for edge cases.
- Fixed opening song timer not starting from the right offset.

---

## [3.0.0] – 2026-04-23

- **Edit part**: change the label, duration, and section of any timer card for the current week.
- **Delete part**: remove a card for the current week.
- **Add custom part**: insert an ad-hoc stopwatch into any section.
- Options accessed via long-press overlay.

---

## [2.12.0] – 2026-04-23

- Sound alert duration configurable in Settings (seconds).
- Vibration duration configurable in Settings (seconds, mobile only).

## [2.11.1] – 2026-04-23

- Fixed audio context not resuming after browser auto-suspend.
- Fixed vibration not triggering on iOS in certain states.

## [2.11.0] – 2026-04-23

- **Sound alert** at overtime: repeating beep synthesised with the Web Audio API.
- **Vibration alert** at overtime (mobile devices only).

---

## [2.10.1] – 2026-04-23

- Added **delta indicator** (e.g. `+0:15`) showing how far over or under the allotted time a part ran.
- Stopped-at timestamp shown alongside elapsed time when a timer is paused.

## [2.10.0] – 2026-04-23

- Removed compiled `main.js` from the repository; it is now built fresh on every release.

---

## [2.9.1] – 2026-04-23

- Added translations for Arabic, Swedish, Turkish, Japanese, Korean, and Simplified Chinese.

## [2.9.0] – 2026-04-23

- Clarified display of schedule fetch timestamps.

## [2.8.0] – 2026-04-23

- Schedule fetching now uses `If-Modified-Since` conditional requests — no unnecessary re-downloads.
- Retry logic (up to 2 retries with 10 s timeout) for flaky connections.
- Meeting bar shows real-time progress across all parts.

## [2.7.0] – 2026-04-23

- Redesigned card layout: allotted duration and scheduled end time visible at a glance.
- Progress bar inside each card fills as time elapses.
- Colour states: green (running on time), orange (≥ 90 % elapsed), red (overtime).

## [2.6.0] – 2026-04-23

- Added WOL locale support for Italian, German, Dutch, Russian, Romanian, Bulgarian, and Polish.

## [2.5.0] – 2026-04-23

- Fixed off-by-one errors in part start/end time calculations.
- Added more WOL locale paths via dropdown and custom override field.

---

## [2.4.0] – 2026-04-22

- Locale cleanup and inline code comments.

## [2.3.0] – 2026-04-22

- UI improvements for translation labels and meeting section headings.

## [2.2.0] – 2026-04-22

- Styling and week pagination improvements.

## [2.1.0] – 2026-04-22

- Fixed scraper parsing issues for certain WOL page structures.

## [2.0.1] – 2026-04-22

- Switched from native `fetch` to Obsidian's `requestUrl` for proper CORS handling inside the plugin sandbox.

## [2.0.0] – 2026-04-22

- Full rewrite of the plugin architecture.
- Sidebar panel with live timer cards fetched from `wol.jw.org`.
- Support for English and Spanish locales.
- Meeting bar showing overall session progress.

---

## [1.0.4] – 2026-04-22

- Removed "desired time" feature — too complex and rarely used.

## [1.0.3] – 2026-04-22

## [1.0.2] – 2026-04-22

## [1.0.1] – 2026-04-22

## [1.0.0] – 2026-04-22

- Initial working release: sidebar with per-part countdown timers.
- Manual part list (no WOL scraping yet).
