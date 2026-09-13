import { execFileSync } from "node:child_process";
import fs from "node:fs";

const manifestPaths = ["extension/public/manifest.json"];

const version = process.env.npm_package_version;

for (const manifestPath of manifestPaths) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.version = version;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

execFileSync("git", ["add", ...manifestPaths], { stdio: "inherit" });
