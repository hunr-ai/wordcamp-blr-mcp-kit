// Shared helpers for the kit scripts. Plain Node 22+, no dependencies, works on Windows and macOS.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const KIT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const STATE_DIR = path.join(KIT_DIR, ".state");
export const IS_WIN = process.platform === "win32";

export function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(KIT_DIR, "kit.config.json"), "utf8"));
}

export function requireNode22() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) {
    console.error(
      `\nThis kit needs Node.js 22 or newer. You have ${process.version}.\n` +
        (IS_WIN
          ? "Install the LTS version with:  winget install OpenJS.NodeJS.LTS\n"
          : "Install the LTS version from https://nodejs.org or with:  brew install node\n") +
        "Then close this window, open a new one, and try again.\n"
    );
    process.exit(1);
  }
}

export function ensureState() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

export function readJSON(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

/** Command-line flag helpers. `npm run x --flag` hands flags to npm, not to us, so check npm_config_* too. */
export function flag(name) {
  return process.argv.includes(`--${name}`) || ["true", "1"].includes(process.env[`npm_config_${name.replace(/-/g, "_")}`] ?? "");
}
export function option(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const env = process.env[`npm_config_${name.replace(/-/g, "_")}`];
  return env && env !== "true" ? env : undefined;
}

/** The port the site is actually running on (written by start.mjs), else the configured one. */
export function currentPort(config = loadConfig()) {
  const explicit = Number(option("port"));
  if (explicit) return explicit;
  const site = readJSON(path.join(STATE_DIR, "site.json"));
  return site?.port || config.port;
}

export const mcpUrl = (port) => `http://127.0.0.1:${port}/wp-json/mcp/mcp-adapter-default-server`;

// Colours and symbols. Old Windows consoles can't draw tick marks, so fall back to ASCII there.
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const fancy = !IS_WIN || !!process.env.WT_SESSION || process.env.TERM_PROGRAM === "vscode";
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const c = { green: paint("32"), red: paint("31"), yellow: paint("33"), bold: paint("1"), dim: paint("2") };
export const sym = fancy ? { ok: "✔", fail: "✖", arrow: "→", dot: "·" } : { ok: "[ok]", fail: "[x]", arrow: "->", dot: "-" };
