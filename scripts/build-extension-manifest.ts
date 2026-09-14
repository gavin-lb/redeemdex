import fs from "node:fs";
import path from "node:path";

type Browser = "chrome" | "firefox";

const browser = process.argv[2] as Browser;

if (browser !== "chrome" && browser !== "firefox") {
  throw new Error("Usage: tsx scripts/build-extension-manifest.ts <chrome|firefox>");
}

const manifestPath = path.resolve("extension", "dist", browser, "manifest.json");
const browserManifestPath = path.resolve("extension", "manifests", `${browser}.json`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const browserManifest = JSON.parse(fs.readFileSync(browserManifestPath, "utf8"));

if (browserManifest.background !== undefined) {
  manifest.background = browserManifest.background;
}

if (browserManifest.browser_specific_settings !== undefined) {
  manifest.browser_specific_settings = browserManifest.browser_specific_settings;
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);