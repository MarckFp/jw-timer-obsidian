import { requestUrl } from "obsidian";
import type { WeeklySchedule, MeetingPart, MeetingSection } from "./types";

// ─── URL helpers ──────────────────────────────────────────────────────────────

/** Returns the ISO week number (1-53) for a given date. */
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export function currentWeekNumber(): number {
  return isoWeek(new Date());
}

export function buildWolUrl(locale: string, year: number, week: number): string {
  return `https://wol.jw.org/en/wol/meetings/${locale}/${year}/${week}`;
}

export function cacheKey(year: number, week: number): string {
  return `${year}-${String(week).padStart(2, "0")}`;
}

// ─── Fixed duration constants (seconds) ───────────────────────────────────────

const SONG_SEC = 5 * 60;       // opening / mid song
const PRAYER_SEC = 1 * 60;

// Parts whose durations cannot be read from the page text
const FIXED_DURATIONS: Record<string, number> = {
  opening_comments: 1 * 60,
  mid_song: SONG_SEC,
  concluding_comments: 3 * 60,
};

// ─── Scraper ──────────────────────────────────────────────────────────────────

/** Regex to extract duration in minutes from strings like "(10 min.)" or "(2 min.)" */
const DURATION_RE = /\((\d+)\s*min\.\)/i;

function parseDuration(text: string): number | null {
  const m = DURATION_RE.exec(text);
  return m ? parseInt(m[1], 10) * 60 : null;
}

export async function fetchWeekSchedule(
  locale: string,
  year: number,
  week: number
): Promise<WeeklySchedule | null> {
  // Step 1: fetch the meetings index page to find the doc link for this week
  const meetingsUrl = buildWolUrl(locale, year, week);

  let meetingsHtml: string;
  try {
    const resp = await requestUrl({
      url: meetingsUrl,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JWTimerObsidian/2.0)" },
    });
    if (resp.status < 200 || resp.status >= 300) return null;
    meetingsHtml = resp.text;
  } catch {
    return null;
  }

  // Extract the workbook doc path — WOL uses relative hrefs like /en/wol/d/<locale>/<docId>
  const docLinkRe = /href="(\/[^"]+\/wol\/d\/[^"#?]+)"/g;
  const docLinks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = docLinkRe.exec(meetingsHtml)) !== null) {
    const href = m[1];
    // MWB docIds are 9+ digits; Watchtower study docIds are shorter
    if (/\/\d{9,}$/.test(href)) {
      docLinks.push(href);
    }
  }

  if (docLinks.length === 0) return null;

  // First 9-digit link is the MWB week
  const mwbDocPath = docLinks[0];

  // Step 2: fetch the actual workbook article page
  const docUrl = `https://wol.jw.org${mwbDocPath}`;
  let docHtml: string;
  try {
    const resp = await requestUrl({
      url: docUrl,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JWTimerObsidian/2.0)" },
    });
    if (resp.status < 200 || resp.status >= 300) return null;
    docHtml = resp.text;
  } catch {
    return null;
  }

  return parseDocPage(docHtml, year, week);
}

// ─── HTML parse ───────────────────────────────────────────────────────────────

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function cleanText(html: string): string {
  return decodeHtmlEntities(stripHtmlTags(html)).trim();
}

function parseDocPage(html: string, year: number, week: number): WeeklySchedule | null {
  // ── Extract week label from h1 ────────────────────────────────────────────
  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const weekLabel = h1Match ? cleanText(h1Match[1]) : `Week ${week}`;

  // ── Split into sections by h2 ─────────────────────────────────────────────
  // Sections: TREASURES FROM GOD'S WORD / APPLY YOURSELF TO THE FIELD MINISTRY / LIVING AS CHRISTIANS
  const parts: MeetingPart[] = [];
  let order = 0;

  // Opening: Song + Prayer + Comments
  parts.push({ label: "Song and Prayer", section: "opening", durationSec: SONG_SEC + PRAYER_SEC, order: order++ });
  parts.push({ label: "Opening Comments", section: "opening", durationSec: FIXED_DURATIONS.opening_comments, order: order++ });

  // Parse h3 headings with their inline content
  // Pattern: <h3...>TITLE</h3> followed shortly by duration text
  const h3Re = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|<h2|<\/article|$)/gi;
  const h2Re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;

  // Build section boundaries from h2 positions
  type SectionBoundary = { pos: number; section: MeetingSection };
  const boundaries: SectionBoundary[] = [];

  // Opening is everything before first h2 we care about
  let h2m: RegExpExecArray | null;
  while ((h2m = h2Re.exec(html)) !== null) {
    const text = cleanText(h2m[1]).toUpperCase();
    let sec: MeetingSection | null = null;
    if (text.includes("TREASURES")) sec = "treasures";
    else if (text.includes("APPLY YOURSELF") || text.includes("FIELD MINISTRY")) sec = "ministry";
    else if (text.includes("LIVING AS CHRISTIANS")) sec = "living";
    if (sec) boundaries.push({ pos: h2m.index, section: sec });
  }

  function sectionForPos(pos: number): MeetingSection {
    let sec: MeetingSection = "opening";
    for (const b of boundaries) {
      if (pos >= b.pos) sec = b.section;
    }
    return sec;
  }

  // Mid-section song (between ministry and living)
  let midSongInserted = false;

  let h3m: RegExpExecArray | null;
  while ((h3m = h3Re.exec(html)) !== null) {
    const titleHtml = h3m[1];
    const bodyHtml = h3m[2] ?? "";
    const title = cleanText(titleHtml);
    const body = cleanText(bodyHtml);
    const pos = h3m.index;

    // Skip song headings that are just "Song N" — they're separators, not programme parts
    // But we DO want "Song and Prayer" style headings as-is
    if (/^song\s+\d+$/i.test(title)) {
      const sec = sectionForPos(pos);
      // Insert mid-song marker before LIVING section
      if (sec === "living" && !midSongInserted) {
        parts.push({ label: title, section: "living", durationSec: SONG_SEC, order: order++ });
        midSongInserted = true;
      }
      continue;
    }

    // Skip pure "Song N and Prayer" opening lines already handled
    if (/^song\s+\d+\s+and\s+prayer/i.test(title) && order <= 2) continue;

    // Extract duration from the h3 content itself or the first line of body
    const combined = `${title} ${body.slice(0, 80)}`;
    const durationSec = parseDuration(combined);
    if (durationSec === null) continue; // no duration = separator/song/comment

    const section = sectionForPos(pos);

    // Strip duration annotation from label
    const cleanLabel = title.replace(DURATION_RE, "").replace(/\s+/g, " ").trim();

    parts.push({ label: cleanLabel, section, durationSec, order: order++ });
  }

  // Closing
  parts.push({ label: "Concluding Comments", section: "closing", durationSec: FIXED_DURATIONS.concluding_comments, order: order++ });
  parts.push({ label: "Closing Song and Prayer", section: "closing", durationSec: SONG_SEC + PRAYER_SEC, order: order++ });

  if (parts.length < 5) return null; // parse clearly failed

  return {
    weekLabel,
    year,
    weekNumber: week,
    parts,
    fetchedAt: Date.now(),
  };
}
