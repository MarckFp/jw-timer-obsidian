import { requestUrl } from "obsidian";
import type { WeeklySchedule, MeetingPart, MeetingSection } from "./types";

// ─── URL helpers ──────────────────────────────────────────────────────────────

function isoWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export function currentWeekNumber(): number {
  return isoWeek(new Date());
}

export function buildWolUrl(
  locale: string,
  year: number,
  week: number,
): string {
  return `https://wol.jw.org/en/wol/meetings/${locale}/${year}/${week}`;
}

export function cacheKey(year: number, week: number): string {
  return `${year}-${String(week).padStart(2, "0")}`;
}

// ─── Duration parsing ─────────────────────────────────────────────────────────

/**
 * Matches duration annotations in all supported WOL languages:
 * - Latin-script:  (N min.)  (N mins.)  (N min)  — English, Spanish, French, Portuguese,
 *                  German (Min.), Dutch, Italian, Polish, etc.
 * - Russian:       (N мин.)   — Cyrillic мин with period
 * - Bulgarian:     (N мин)    — Cyrillic мин without period
 * - Korean:        (N분)      — ASCII parens + Hangul
 * - Japanese:      （N分）    — full-width parens + kanji
 * - Chinese:       （N分钟）  — full-width parens + 分钟
 *
 * Uses a character class for the opening/closing paren to handle full-width variants,
 * and an alternation for the unit suffix.
 */
const DURATION_RE = /[(\uff08](\d+)\s*(?:mins?\.?|мин\.?|분|分钟?)[)\uff09]/i;

function parseDuration(text: string): number | null {
  const m = DURATION_RE.exec(text);
  return m ? parseInt(m[1], 10) * 60 : null;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

/**
 * Wraps requestUrl with a 10-second timeout and up to 2 automatic retries on
 * network/server errors. Returns { status, text } on success, null on permanent failure.
 */
async function fetchWithRetry(
  url: string,
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; text: string } | null> {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (compatible; JWTimerObsidian/2.0)",
    ...extraHeaders,
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      let timeoutHandle: number | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = window.setTimeout(
          () => reject(new Error("Request timed out")),
          FETCH_TIMEOUT_MS,
        );
      });
      const resp = await Promise.race([
        requestUrl({ url, headers }),
        timeoutPromise,
      ]);
      window.clearTimeout(timeoutHandle!);

      if (resp.status === 304) return { status: 304, text: "" };
      if (resp.status >= 200 && resp.status < 300)
        return { status: resp.status, text: resp.text };
      // 4xx — not retryable
      if (resp.status >= 400 && resp.status < 500) return null;
      // 5xx — fall through to retry
    } catch {
      // timeout or network error — fall through to retry
    }

    if (attempt < MAX_RETRIES) {
      await new Promise<void>((r) =>
        window.setTimeout(r, 1_000 * (attempt + 1)),
      );
    }
  }
  return null;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetch the weekly schedule from wol.jw.org.
 * Returns the parsed schedule, "not-modified" (when the server confirms no change via 304),
 * or null on error.
 *
 * @param cachedAt  Optional ms-since-epoch timestamp of a previously fetched version.
 *                  When provided, an If-Modified-Since header is sent so the server can
 *                  respond with 304 and save bandwidth.
 */
export async function fetchWeekSchedule(
  locale: string,
  year: number,
  week: number,
  cachedAt?: number,
): Promise<WeeklySchedule | null | "not-modified"> {
  const conditionalHeaders: Record<string, string> = cachedAt
    ? { "If-Modified-Since": new Date(cachedAt).toUTCString() }
    : {};

  // Step 1: fetch the meetings index page to find the MWB doc link
  const meetingsUrl = buildWolUrl(locale, year, week);
  const meetingsResp = await fetchWithRetry(meetingsUrl, conditionalHeaders);
  if (!meetingsResp) return null;
  if (meetingsResp.status === 304) return "not-modified";
  const meetingsHtml = meetingsResp.text;

  // MWB doc IDs are 9+ digits
  const docLinkRe = /href="(\/[^"]+\/wol\/d\/[^"#?]+)"/g;
  const docLinks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = docLinkRe.exec(meetingsHtml)) !== null) {
    if (/\/\d{9,}$/.test(m[1])) docLinks.push(m[1]);
  }
  if (docLinks.length === 0) return null;

  // Step 2: fetch the MWB article page (no conditional header — always want full content)
  const docUrl = `https://wol.jw.org${docLinks[0]}`;
  const docResp = await fetchWithRetry(docUrl);
  if (!docResp || docResp.status === 304) return null;

  return parseDocPage(docResp.text, year, week);
}

// ─── HTML utilities ───────────────────────────────────────────────────────────

function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Doc page parsing ─────────────────────────────────────────────────────────

function parseDocPage(
  html: string,
  year: number,
  week: number,
): WeeklySchedule | null {
  // Week label from h1
  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const weekLabel = h1Match ? cleanText(h1Match[1]) : `Week ${week}`;

  // ── Section detection via CSS colour classes (language-independent) ─────────
  // h2 with class du-color--teal-700   → TREASURES FROM GOD'S WORD
  // h2 with class du-color--gold-700   → APPLY YOURSELF TO THE FIELD MINISTRY
  // h2 with class du-color--maroon-600 → LIVING AS CHRISTIANS
  type SectionBoundary = {
    pos: number;
    section: MeetingSection;
    label: string;
  };
  const boundaries: SectionBoundary[] = [];

  const h2Re = /<h2([^>]*)>([\s\S]*?)<\/h2>/gi;
  let h2m: RegExpExecArray | null;
  while ((h2m = h2Re.exec(html)) !== null) {
    const cls = h2m[1];
    const text = cleanText(h2m[2]).toUpperCase();
    let sec: MeetingSection | null = null;
    // Primary: CSS colour class — works in any language
    if (cls.includes("teal-700")) sec = "treasures";
    else if (cls.includes("gold-700")) sec = "ministry";
    else if (cls.includes("maroon-600")) sec = "living";
    // Fallback: English section text
    else if (text.includes("TREASURES")) sec = "treasures";
    else if (text.includes("APPLY YOURSELF") || text.includes("FIELD MINISTRY"))
      sec = "ministry";
    else if (text.includes("LIVING AS CHRISTIANS")) sec = "living";
    if (sec)
      boundaries.push({
        pos: h2m.index,
        section: sec,
        label: cleanText(h2m[2]),
      });
  }

  function sectionForPos(pos: number): MeetingSection {
    let sec: MeetingSection = "opening";
    for (const b of boundaries) {
      if (pos >= b.pos) sec = b.section;
    }
    return sec;
  }

  // ── Parse h3 elements into programme parts ────────────────────────────────
  const parts: MeetingPart[] = [];
  let order = 0;

  // Captures: [1] h3 attrs, [2] h3 inner HTML, [3] sibling body HTML until next h3/h2
  const h3Re =
    /<h3([^>]*)>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|<h2|<\/article|$)/gi;
  let h3m: RegExpExecArray | null;
  while ((h3m = h3Re.exec(html)) !== null) {
    const h3Attrs = h3m[1];
    const titleHtml = h3m[2];
    const bodyHtml = h3m[3] ?? "";
    const title = cleanText(titleHtml);
    const bodyText = cleanText(bodyHtml);
    const pos = h3m.index;

    const isSong = h3Attrs.includes("dc-icon--music");

    if (isSong) {
      const durInTitle = parseDuration(title);

      if (durInTitle === null) {
        // Mid-meeting song separator: counted for schedule timing but no stopwatch shown
        parts.push({
          label: title,
          section: sectionForPos(pos),
          durationSec: 5 * 60,
          order: order++,
          isSeparator: true,
        });
        continue;
      }

      // Opening song h3: "Song 86 and Prayer | Opening Comments (1 min.)"
      // Only surface the programme label (the pipe segment that has the duration)
      const label = labelFromPipeSegment(title);
      if (!label) continue;
      parts.push({
        label,
        section: sectionForPos(pos),
        durationSec: durInTitle,
        order: order++,
      });
      continue;
    }

    // Regular programme part — duration may be in the h3 title (closing row) or in body
    const durInTitle = parseDuration(title);
    const durInBody = parseDuration(bodyText.slice(0, 200));
    const durationSec = durInTitle ?? durInBody;
    if (durationSec === null) continue;

    // Closing h3: "Concluding Comments (3 min.) | Song N and Prayer"
    if (title.includes("|")) {
      const label = labelFromPipeSegment(title);
      if (!label) continue;
      parts.push({ label, section: "closing", durationSec, order: order++ });
      continue;
    }

    // Normal numbered part — strip duration annotation from label
    const cleanLabel = title
      .replace(DURATION_RE, "")
      .replace(/\s+/g, " ")
      .trim();
    const section = sectionForPos(pos);
    // Ministry parts and Bible reading (dc-icon--bible) get a 1-min instructor advice sub-timer
    const hasAdvice =
      section === "ministry" ||
      (section === "treasures" && h3Attrs.includes("dc-icon--bible"));
    parts.push({
      label: cleanLabel,
      section,
      durationSec,
      order: order++,
      ...(hasAdvice ? { hasAdvice } : {}),
    });
  }

  if (parts.length < 5) return null;

  const sectionLabels: Partial<Record<MeetingSection, string>> = {};
  for (const b of boundaries) {
    sectionLabels[b.section] = b.label;
  }

  return {
    weekLabel,
    year,
    weekNumber: week,
    parts,
    fetchedAt: Date.now(),
    sectionLabels,
  };
}

/**
 * For pipe-separated h3 titles (opening or closing rows), returns the segment
 * that contains the duration annotation, with that annotation stripped.
 *
 * "Song 86 and Prayer | Opening Comments (1 min.)"  → "Opening Comments"
 * "Canción 86 y oración | Palabras de introducción (1 min.)" → "Palabras de introducción"
 * "Concluding Comments (3 min.) | Song 70 and Prayer" → "Concluding Comments"
 */
function labelFromPipeSegment(title: string): string | null {
  const segments = title.split("|").map((s) => s.trim());
  const withDur = segments.find((s) => DURATION_RE.test(s));
  if (!withDur) return null;
  return withDur.replace(DURATION_RE, "").replace(/\s+/g, " ").trim() || null;
}
