#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Checking JavaScript syntax..."
node --check background.js
node --check contentScript.js
node --check options.js
node --check popup.js

echo "Checking manifest and icon paths..."
node - <<'NODE'
const fs = require("fs");
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const icons = [
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {})
];

for (const icon of icons) {
  if (!fs.existsSync(icon)) {
    throw new Error(`Missing icon: ${icon}`);
  }
}

if (manifest.name !== "Bilingual Reading Companion") {
  throw new Error(`Unexpected extension name: ${manifest.name}`);
}

if (!manifest.action?.default_popup || !fs.existsSync(manifest.action.default_popup)) {
  throw new Error(`Missing popup: ${manifest.action?.default_popup || "(none)"}`);
}

console.log(`${manifest.name} ${manifest.version}`);
NODE

echo "Scanning for likely accidental secrets..."
if rg -n --glob '!scripts/check-release.sh' "AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|Bearer [0-9A-Za-z._-]{20,}|Authorization:\s*[0-9A-Za-z._-]{20,}|/Users/[0-9A-Za-z._-]+" .; then
  echo "Potential secret or personal path found. Please review the matches above." >&2
  exit 1
fi

echo "Release check passed."
