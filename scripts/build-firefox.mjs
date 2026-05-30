/**
 * Firefox-Build-Nachbearbeitung:
 * 1. dist/ → dist-firefox/ kopieren
 * 2. Service Worker als IIFE neu bündeln (Firefox verträgt kein "type":"module" zuverlässig)
 * 3. manifest.json patchen (browser_specific_settings, "type":"module" entfernen)
 */

import { build } from "esbuild";
import { cp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SRC = "dist";
const DST = "dist-firefox";

console.log("[firefox] Kopiere dist → dist-firefox ...");
await cp(SRC, DST, { recursive: true, force: true });

console.log("[firefox] Bündle Service Worker als IIFE ...");
await build({
  entryPoints: ["src/background/service-worker.ts"],
  outfile: join(DST, "service-worker.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  legalComments: "none",
  define: {
    "import.meta.url": "location.href"
  }
});

console.log("[firefox] Patche manifest.json ...");
const manifestPath = join(DST, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

// Firefox-spezifische Einstellungen
manifest.browser_specific_settings = {
  gecko: {
    id: "hikr-enhancements@hikr.local",
    strict_min_version: "109.0"
  }
};

// service_worker → scripts: Firefox verwendet background.scripts statt service_worker
// Das IIFE-Bundle läuft als normales Background-Script (Event Page in MV3)
manifest.background = {
  scripts: ["service-worker.js"]
};

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log("[firefox] manifest.json gepatcht.");
console.log("[firefox] Fertig! Firefox-Extension liegt in dist-firefox/");
