import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extension = path.join(root, "extension");
const manifestDir = path.join(extension, "manifests");
const publicDir = path.join(extension, "public");

export function getExtensionPlatform(mode: string): "firefox" | "chrome" {
  if (mode !== "firefox" && mode !== "chrome") {
    throw new Error(`Unsupported extension platform: ${mode}`);
  }

  return mode;
}

export function writeManifest(platform: "firefox" | "chrome"): void {
  const source = path.join(manifestDir, `${platform}.json`);
  const destination = path.join(publicDir, "manifest.json");

  fs.copyFileSync(source, destination);
}
