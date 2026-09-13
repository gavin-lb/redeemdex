import { execFileSync } from "node:child_process";
import fs from "node:fs";

const manifestPaths = ["extension/public/manifest.json"];

const version = process.env.npm_package_version;

for (const manifestPath of manifestPaths) {
  const contents = fs.readFileSync(manifestPath, "utf8");

  const updated = contents.replace(
    /("version"\s*:\s*)"[^"]*"/,
    `$1"${version}"`,
  );

  if (updated === contents) {
    throw new Error(`Could not find version in ${manifestPath}`);
  }

  fs.writeFileSync(manifestPath, updated);
}

execFileSync("git", ["add", ...manifestPaths], { stdio: "inherit" });