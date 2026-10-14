
const { spawnSync } = require("node:child_process");
const dotenv = require("dotenv");

dotenv.config({ quiet: true, override: false });

const [command, ...args] = process.argv.slice(2);

if (!command) {
    console.error("Usage: node scripts/with-dotenv.js <command> [args...]");
    process.exit(1);
}

const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
});

if (result.error) {
    console.error(result.error.message);
    process.exit(1);
}

process.exit(result.status ?? 1);
