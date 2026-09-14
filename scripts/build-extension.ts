import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extension = path.join(root, "extension");
const manifestDir = path.join(extension, "manifests");
const publicDir = path.join(extension, "public");
const distDir = path.join(extension, "dist");

function getExtensionDistDir(platform: Platform, environment: Environment): string {
  return path.join(distDir, environment, platform);
}

export type Platform = "firefox" | "chrome";
export type Environment = "dev" | "prod";

export function getExtensionPlatform(value: string): Platform {
  if (value !== "firefox" && value !== "chrome") {
    throw new Error(`Unsupported extension platform: ${value}`);
  }

  return value;
}

export function getExtensionEnvironment(value: string): Environment {
  if (value !== "dev" && value !== "prod") {
    throw new Error(`Unsupported extension environment: ${value}`);
  }

  return value;
}

function writeManifest(platform: Platform, environment: Environment): void {
  const baseManifestPath = path.join(publicDir, "manifest.json");
  const platformManifestPath = path.join(manifestDir, `${platform}.json`);
  const destination = path.join(getExtensionDistDir(platform, environment), "manifest.json");

  const baseManifest = JSON.parse(fs.readFileSync(baseManifestPath, "utf8"));
  const platformManifest = JSON.parse(fs.readFileSync(platformManifestPath, "utf8"));

  const manifest = {
    ...baseManifest,
    ...platformManifest,
  };

  if (environment === "dev") {
    manifest.host_permissions = [
      ...(manifest.host_permissions ?? []),
      "http://127.0.0.1/*",
      "http://localhost/*",
    ];

    if (manifest.content_scripts) {
      for (const contentScript of manifest.content_scripts) {
        contentScript.matches = [
          ...contentScript.matches,
          "http://127.0.0.1/*",
          "http://localhost/*",
        ];
      }
    }
  }

  fs.writeFileSync(destination, `${JSON.stringify(manifest, null, 2)}\n`);
}

function zipExtension(platform: Platform, environment: Environment, version: string): void {
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
  const sourceDir = getExtensionDistDir(platform, environment);
  const outputPath = path.join(distDir, environment, `RedeemDex-${platformName}-${version}.zip`);

  fs.rmSync(outputPath, { force: true });

  execFileSync("zip", ["-r", outputPath, "."], {
    cwd: sourceDir,
    stdio: "inherit",
  });
}

async function buildExtension(platform: Platform, environment: Environment): Promise<void> {
  const outputDir = getExtensionDistDir(platform, environment);

  await build({
    configFile: path.join(extension, "vite.config.ts"),
    mode: environment,
    build: { outDir: outputDir },
  });

  await build({
    configFile: path.join(extension, "vite.background.config.ts"),
    mode: environment,
    build: { outDir: outputDir },
  });

  await build({
    configFile: path.join(extension, "vite.content.config.ts"),
    mode: environment,
    build: { outDir: outputDir },
  });

  writeManifest(platform, environment);

  if (environment === "prod") {
    const manifestPath = path.join(outputDir, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    zipExtension(platform, environment, manifest.version);
  }
}

const platform = getExtensionPlatform(process.argv[2]);
const environment = getExtensionEnvironment(process.argv[3]);

await buildExtension(platform, environment);
