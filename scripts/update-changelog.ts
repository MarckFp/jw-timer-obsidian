#!/usr/bin/env tsx
/**
 * update-changelog.ts
 *
 * Called by the prepare-commit-msg git hook.
 *
 * For each commit that touches .ts or .css files:
 *   1. Sends the staged diff + existing unreleased bullets to GitHub Models API.
 *   2. AI returns new bullet points AND a semver bump type (patch/minor/major).
 *   3. Prepends the bullets under "## [Unreleased]" in CHANGELOG.md.
 *   4. Updates `version` in package.json and manifest.json.
 *   5. Stages all modified files so they are part of the commit.
 *
 * Requirements:
 *   - Node.js 18+  (native fetch)
 *   - `gh auth login` done, OR GITHUB_TOKEN env var set
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ── Paths ─────────────────────────────────────────────────────────────────────

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHANGELOG = join(ROOT, "CHANGELOG.md");
const PKG_JSON = join(ROOT, "package.json");
const MANIFEST_JSON = join(ROOT, "manifest.json");

// ── Types ─────────────────────────────────────────────────────────────────────

type SemverBump = "major" | "minor" | "patch";

interface AiResponse {
  bullets: string[];
  bump: SemverBump;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function exec(cmd: string): string {
  return execSync(cmd, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function bumpVersion(tag: string, bump: SemverBump): string {
  const clean = tag.replace(/^v/, "");
  const parts = clean.split(".").map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return clean;
  const [major, minor, patch] = parts;
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function getUnreleasedBullets(changelog: string): string {
  const start = changelog.indexOf("## [Unreleased]");
  if (start === -1) return "";
  const afterHeader = changelog.indexOf("\n", start) + 1;
  const nextSection = changelog.indexOf("\n## [", afterHeader);
  const block =
    nextSection === -1
      ? changelog.slice(afterHeader)
      : changelog.slice(afterHeader, nextSection);
  return block.trim();
}

// ── 1. Staged diff ────────────────────────────────────────────────────────────

let diff: string;
try {
  diff = exec("git diff --staged --unified=3 -- '*.ts' '*.css'");
} catch {
  process.exit(0); // not a git repo — skip silently
}

if (!diff.trim()) process.exit(0); // only docs/json staged — skip

const diffSnippet =
  diff.length > 6000 ? diff.slice(0, 6000) + "\n\n[…diff truncated…]" : diff;

// ── 2. Context: last tag + existing unreleased bullets ────────────────────────

let lastTag = "0.0.0";
try {
  lastTag = exec("git describe --tags --abbrev=0");
} catch {
  /* no tags yet */
}

const changelog = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, "utf8") : "";
const existingBullets = getUnreleasedBullets(changelog);

// ── 3. GitHub token ───────────────────────────────────────────────────────────

let token = process.env.GITHUB_TOKEN ?? "";
if (!token) {
  try {
    token = exec("gh auth token");
  } catch {
    console.warn("[changelog] gh auth token failed — skipping AI generation.");
    process.exit(0);
  }
}

// ── 4. GitHub Models API ──────────────────────────────────────────────────────

async function main(): Promise<void> {
  const SYSTEM_PROMPT = `You are a technical writer for an Obsidian plugin called "JW Meeting Timer".
You receive:
1. The current "Unreleased" changelog bullets (may be empty)
2. A new git diff for this commit

Your tasks:
- Write 1–5 concise bullet points summarising user-visible changes in the diff
  (present tense: "Fixed …", "Added …", "Removed …", "Changed …")
- Decide the semver bump for the upcoming release based on ALL unreleased bullets
  combined (not just the new diff):
  - "major" — breaking change or major redesign
  - "minor" — new user-visible feature
  - "patch" — bug fix, small improvement, or internal change

Respond with ONLY valid JSON (no markdown fences) in this exact shape:
{"bullets":["- Change one","- Change two"],"bump":"minor"}`;

  const userContent = `## Existing unreleased bullets
${existingBullets || "(none yet)"}

## New diff
${diffSnippet}`;

  let aiResult: AiResponse;
  try {
    const res = await fetch(
      "https://models.inference.ai.azure.com/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 400,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
        }),
      },
    );

    if (!res.ok) {
      console.warn(
        `[changelog] GitHub Models API error ${res.status}: ${await res.text()}`,
      );
      process.exit(0);
    }

    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    aiResult = JSON.parse(raw) as AiResponse;
  } catch (err) {
    console.warn(`[changelog] Failed: ${(err as Error).message}`);
    process.exit(0);
  }

  const { bump } = aiResult;
  // Normalise: ensure every bullet starts with "- "
  const bullets = (Array.isArray(aiResult.bullets) ? aiResult.bullets : [])
    .map((b) => (b.startsWith("- ") ? b : `- ${b}`))
    .filter((b) => b.length > 2);
  if (bullets.length === 0) process.exit(0);

  // ── 5. Update CHANGELOG.md ────────────────────────────────────────────────────

  if (changelog.includes("## [Unreleased]")) {
    const markerIdx = changelog.indexOf("## [Unreleased]");
    const afterHeader = changelog.indexOf("\n", markerIdx) + 1;
    let insertAt = afterHeader;
    while (insertAt < changelog.length && changelog[insertAt] === "\n")
      insertAt++;

    const updated =
      changelog.slice(0, afterHeader) +
      "\n" +
      bullets.join("\n") +
      "\n" +
      changelog.slice(insertAt);

    writeFileSync(CHANGELOG, updated, "utf8");
  }

  // ── 6. Bump version in package.json + manifest.json ──────────────────────────

  const nextVersion = bumpVersion(lastTag, bump);

  if (existsSync(PKG_JSON)) {
    const pkg = JSON.parse(readFileSync(PKG_JSON, "utf8")) as Record<
      string,
      unknown
    >;
    pkg.version = nextVersion;
    writeFileSync(PKG_JSON, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  }

  if (existsSync(MANIFEST_JSON)) {
    const manifest = JSON.parse(readFileSync(MANIFEST_JSON, "utf8")) as Record<
      string,
      unknown
    >;
    manifest.version = nextVersion;
    writeFileSync(
      MANIFEST_JSON,
      JSON.stringify(manifest, null, 2) + "\n",
      "utf8",
    );
  }

  // ── 7. Stage everything ───────────────────────────────────────────────────────

  try {
    exec("git add CHANGELOG.md package.json manifest.json");
    console.log(
      `[changelog] ✓ ${bump} bump → ${nextVersion}  |  ${bullets.length} bullet(s) added`,
    );
  } catch {
    /* non-fatal */
  }
} // end main

void main();
