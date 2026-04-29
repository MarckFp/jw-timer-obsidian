#!/usr/bin/env node
/**
 * update-changelog.mjs
 *
 * Called by the prepare-commit-msg git hook.
 * - Reads the staged diff for meaningful source files.
 * - Sends it to the GitHub Models API (gpt-4o-mini) for a concise summary.
 * - Prepends the summary as bullet points under "## [Unreleased]" in CHANGELOG.md.
 * - Stages CHANGELOG.md so it is part of the commit.
 *
 * Requirements:
 *   - Node.js 18+  (uses native fetch)
 *   - `gh auth login` done, OR GITHUB_TOKEN env var set
 *
 * The GitHub Models endpoint is free for GitHub accounts with Copilot access.
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHANGELOG = join(ROOT, "CHANGELOG.md");

// ── 1. Get the staged diff ────────────────────────────────────────────────────

const MEANINGFUL_EXTS = /\.(ts|css|json)$/;
const IGNORE_FILES = /(package-lock|versions\.json|manifest\.json)$/;

let diff;
try {
  diff = execSync("git diff --staged --unified=3 -- '*.ts' '*.css'", {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
} catch {
  process.exit(0); // not a git repo or no staged files — skip silently
}

if (!diff.trim()) {
  // Only non-source files staged (e.g. pure doc edits) — skip
  process.exit(0);
}

// Truncate very large diffs to avoid token limits (keep first 6000 chars)
const diffSnippet =
  diff.length > 6000 ? diff.slice(0, 6000) + "\n\n[…diff truncated…]" : diff;

// ── 2. Get a GitHub token ─────────────────────────────────────────────────────

let token = process.env.GITHUB_TOKEN;
if (!token) {
  try {
    token = execSync("gh auth token", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    console.warn("[changelog] gh auth token failed — skipping AI generation.");
    process.exit(0);
  }
}

// ── 3. Call GitHub Models API ─────────────────────────────────────────────────

const ENDPOINT = "https://models.inference.ai.azure.com/chat/completions";
const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a technical writer for an Obsidian plugin called "JW Meeting Timer".
Given a git diff, write 1–5 concise changelog bullet points in plain English.
Rules:
- Each bullet starts with "- "
- Focus on user-visible changes: new features, fixed bugs, changed behaviour, removed things
- Ignore refactors, formatting, type annotations, and comments unless they affect behaviour
- Use present tense: "Fixed …", "Added …", "Removed …", "Changed …"
- Be brief: one line per bullet, no sub-bullets
- Output ONLY the bullet list, nothing else`;

let bullets;
try {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: diffSnippet },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.warn(`[changelog] GitHub Models API error ${res.status}: ${body}`);
    process.exit(0);
  }

  const json = await res.json();
  bullets = json.choices?.[0]?.message?.content?.trim();
} catch (err) {
  console.warn(`[changelog] Fetch failed: ${err.message}`);
  process.exit(0);
}

if (!bullets) {
  process.exit(0);
}

// ── 4. Prepend bullets to ## [Unreleased] ─────────────────────────────────────

if (!existsSync(CHANGELOG)) {
  process.exit(0);
}

const changelog = readFileSync(CHANGELOG, "utf8");

const MARKER = "## [Unreleased]";
const markerIdx = changelog.indexOf(MARKER);

if (markerIdx === -1) {
  console.warn("[changelog] ## [Unreleased] section not found — skipping.");
  process.exit(0);
}

// Find the end of the ## [Unreleased] header line
const afterHeader = changelog.indexOf("\n", markerIdx) + 1;

// Skip any existing blank line right after the header
let insertAt = afterHeader;
while (insertAt < changelog.length && changelog[insertAt] === "\n") {
  insertAt++;
}

// Build the updated changelog
const updated =
  changelog.slice(0, afterHeader) +
  "\n" +
  bullets +
  "\n" +
  changelog.slice(insertAt);

writeFileSync(CHANGELOG, updated, "utf8");

// ── 5. Stage CHANGELOG.md ─────────────────────────────────────────────────────

try {
  execSync("git add CHANGELOG.md", { cwd: ROOT });
  console.log("[changelog] ✓ Updated CHANGELOG.md with AI-generated notes.");
} catch {
  // Non-fatal — worst case the user stages it manually
}
