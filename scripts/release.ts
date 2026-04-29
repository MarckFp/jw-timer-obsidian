#!/usr/bin/env tsx
/**
 * release.ts
 *
 * Run with: npm run release
 *
 * What it does:
 *   1. Reads the next version from package.json (already bumped by pre-commit hook)
 *   2. Renames "## [Unreleased]" → "## [x.y.z] – YYYY-MM-DD" in CHANGELOG.md
 *   3. Adds a fresh empty "## [Unreleased]" at the top
 *   4. Commits the sealed changelog
 *   5. Creates and pushes the git tag  → triggers the GitHub Actions release workflow
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHANGELOG = join(ROOT, "CHANGELOG.md");
const PKG_JSON = join(ROOT, "package.json");

function exec(cmd: string): string {
  return execSync(cmd, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

// ── 1. Read current version ───────────────────────────────────────────────────

const pkg = JSON.parse(readFileSync(PKG_JSON, "utf8")) as { version: string };
const version = pkg.version;
if (!version) {
  console.error("[release] No version found in package.json");
  process.exit(1);
}

// ── 2. Check there are unreleased changes ─────────────────────────────────────

const changelog = readFileSync(CHANGELOG, "utf8");
const unreleasedStart = changelog.indexOf("## [Unreleased]");
if (unreleasedStart === -1) {
  console.error("[release] ## [Unreleased] section not found in CHANGELOG.md");
  process.exit(1);
}

const afterHeader = changelog.indexOf("\n", unreleasedStart) + 1;
const nextSection = changelog.indexOf("\n## [", afterHeader);
const unreleasedBody =
  nextSection === -1
    ? changelog.slice(afterHeader)
    : changelog.slice(afterHeader, nextSection);

if (!unreleasedBody.trim()) {
  console.error(
    "[release] ## [Unreleased] is empty — nothing to release. Commit some changes first.",
  );
  process.exit(1);
}

// ── 3. Seal the changelog ─────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const sealedHeader = `## [${version}] – ${today}`;

const sealed = changelog.replace("## [Unreleased]", sealedHeader);

// Prepend a new empty [Unreleased] section at the top, after the title block
const dividerIdx = sealed.indexOf("\n---\n");
if (dividerIdx === -1) {
  console.error("[release] Could not find '---' divider in CHANGELOG.md");
  process.exit(1);
}
const afterDivider = dividerIdx + "\n---\n".length;

const updated =
  sealed.slice(0, afterDivider) +
  "\n## [Unreleased]\n" +
  sealed.slice(afterDivider);

writeFileSync(CHANGELOG, updated, "utf8");

// ── 4. Commit + tag + push ────────────────────────────────────────────────────

try {
  exec("git add CHANGELOG.md");
  exec(`git commit -m "chore: release ${version}"`);
  exec(`git tag ${version}`);
  exec("git push");
  exec(`git push origin ${version}`);
  console.log(
    `[release] ✓ Released ${version} — GitHub Actions will build and publish.`,
  );
} catch (err) {
  console.error(`[release] Git operation failed: ${(err as Error).message}`);
  process.exit(1);
}
