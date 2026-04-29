#!/usr/bin/env tsx
/**
 * release.ts
 *
 * Run with: npm run release
 *
 * The pre-commit hook already:
 *   - Added bullets to the changelog
 *   - Sealed [Unreleased] → [x.y.z] – date
 *   - Bumped version in package.json and manifest.json
 *
 * This script just tags the current commit and pushes → triggers GitHub Actions.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

// ── 1. Read version from package.json ─────────────────────────────────────────

const pkg = JSON.parse(readFileSync(PKG_JSON, "utf8")) as { version: string };
const version = pkg.version;
if (!version) {
  console.error("[release] No version found in package.json");
  process.exit(1);
}

// ── 2. Verify the version is sealed in CHANGELOG.md ──────────────────────────

const changelog = readFileSync(CHANGELOG, "utf8");
if (!changelog.includes(`## [${version}]`)) {
  console.error(
    `[release] ## [${version}] not found in CHANGELOG.md.\n` +
      `Make sure you have committed at least one code change so the pre-commit hook can seal the version.`,
  );
  process.exit(1);
}

// ── 3. Tag + push ─────────────────────────────────────────────────────────────

try {
  exec(`git tag ${version}`);
  exec(`git push origin ${version}`);
  console.log(
    `[release] ✓ Tagged and pushed ${version} — GitHub Actions will build and publish.`,
  );
} catch (err) {
  console.error(`[release] Failed: ${(err as Error).message}`);
  process.exit(1);
}
