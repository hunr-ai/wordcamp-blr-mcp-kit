#!/usr/bin/env node
// npm start  ->  boots a throwaway WordPress on your laptop (WordPress Playground: no PHP,
// MySQL or Docker needed) with the MCP Adapter plugin from WordPress.org, demo abilities and content.
// The site lives in memory: stop it (Ctrl+C) and start again for a fresh site.
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { KIT_DIR, STATE_DIR, loadConfig, requireNode22, ensureState, readJSON, writeJSON, option, mcpUrl, c, sym } from "./lib.mjs";
import { connect } from "./connect.mjs";

requireNode22();
const config = loadConfig();
ensureState();

// ---- 1. Find the Playground CLI in node_modules -----------------------------------
let cliBin;
try {
  const require = createRequire(path.join(KIT_DIR, "package.json"));
  const pkgFile = require.resolve("@wp-playground/cli/package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
  cliBin = path.join(path.dirname(pkgFile), pkg.bin["wp-playground-cli"]);
} catch {
  console.error(c.red(`\n${sym.fail} The kit isn't installed yet. Run this first, in ${KIT_DIR}:\n\n    npm install\n`));
  process.exit(1);
}

// ---- 2. Pick a port (9400, or the next free one) -----------------------------------
const canListen = (port, host) =>
  new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, host);
  });
// We listen on 127.0.0.1, so test exactly that, plus all interfaces (catches servers on 0.0.0.0 / ::).
const portFree = async (port) => (await canListen(port, "127.0.0.1")) && (await canListen(port));

const wanted = Number(option("port")) || config.port;
let port = wanted;
while (!(await portFree(port))) {
  if (port - wanted >= 20) {
    console.error(c.red(`\n${sym.fail} Ports ${wanted}-${port} are all busy. Close other local servers and try again.\n`));
    process.exit(1);
  }
  port++;
}
if (port !== wanted) console.log(c.yellow(`\nPort ${wanted} is busy (maybe the demo is already running?), so I'm using ${port} instead.`));

const siteUrl = `http://127.0.0.1:${port}`;

// ---- 3. Hand the fixed Application Password to seed.php, clear old state -----------
writeJSON(path.join(STATE_DIR, "runtime.json"), {
  username: config.appPassword.username,
  appPassword: config.appPassword.password,
  appName: config.appPassword.name,
});
for (const f of ["ready.json", "site.json"]) fs.rmSync(path.join(STATE_DIR, f), { force: true });

// ---- 4. Boot Playground --------------------------------------------------------------
const wp = (...p) => path.resolve(KIT_DIR, "wordpress", ...p);
// An exact version ("7.1.5") becomes its wordpress.org download URL: Playground then skips the
// online version lookup and reuses its cached copy, so the site also boots without internet.
const wpArg = /^\d+\.\d+(\.\d+)?$/.test(config.wp) ? `https://wordpress.org/wordpress-${config.wp}.zip` : config.wp;
// With a blueprint, Playground takes the versions from its preferredVersions (not from --wp),
// so write the effective blueprint with the versions from kit.config.json.
const blueprintFile = path.join(STATE_DIR, "blueprint.json");
writeJSON(blueprintFile, { ...readJSON(wp("blueprint.json")), preferredVersions: { php: config.php, wp: wpArg } });
// --mount-dir takes host and VFS paths as two separate arguments, so Windows "C:\..." paths are safe.
const args = [
  "--require", path.join(KIT_DIR, "scripts", "playground-preload.cjs"), // 127.0.0.1 only + slow-Wi-Fi fix
  cliBin,
  "server",
  `--port=${port}`,
  `--php=${config.php}`,
  `--wp=${wpArg}`,
  `--blueprint=${blueprintFile}`,
  "--mount-dir", wp(), "/demo",
  "--mount-dir", wp("mu-plugins"), "/wordpress/wp-content/mu-plugins",
  "--mount-dir", wp("plugins", "mcp-adapter"), "/wordpress/wp-content/plugins/mcp-adapter",
  "--mount-dir", path.resolve(STATE_DIR), "/kit-state",
];

const logFile = path.join(STATE_DIR, "playground.log");
const log = fs.createWriteStream(logFile);
console.log(c.bold(`\nStarting your demo WordPress site on ${siteUrl}`));
console.log(c.dim("The first run downloads WordPress (about 40 MB), so give it a minute or two.\n"));

let child;
let stopping = false;
let ready = false;
let attempt = 0;
const stop = () => {
  if (stopping) return;
  stopping = true;
  fs.rmSync(path.join(STATE_DIR, "site.json"), { force: true });
  child?.kill();
};
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => { stop(); process.exit(0); });
process.on("exit", stop);

function boot() {
  attempt++;
  log.write(`\n----- start attempt ${attempt} -----\n`);
  child = spawn(process.execPath, args, { cwd: KIT_DIR, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  child.on("exit", onExit);
}

function onExit(code) {
  if (stopping) return;
  const tail = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").trim().split(/\r?\n/).slice(-15).join("\n") : "";
  // Flaky Wi-Fi during boot: try again a couple of times before giving up.
  if (!ready && attempt < 3 && /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up/i.test(tail.split("----- start attempt").pop())) {
    console.log(c.yellow(`\nThe internet connection hiccupped while starting. Trying again (${attempt + 1} of 3)...`));
    setTimeout(boot, 3000);
    return;
  }
  console.error(c.red(`\n${sym.fail} WordPress stopped unexpectedly (exit code ${code}). Last lines of ${logFile}:\n`));
  console.error(c.dim(tail || "(no output)"));
  console.error(
    "\nCommon fixes: check your internet connection for the first run, make sure Node.js is 22 or newer,\n" +
      "and run `npm install` again. Then try `npm start` once more.\n"
  );
  process.exit(1);
}
boot();

// ---- 5. Wait until WordPress answers and the seed step is done -----------------------
const started = Date.now();
const timeoutMs = 6 * 60 * 1000;
let dots = 0;
while (!ready) {
  if (Date.now() - started > timeoutMs) {
    console.error(c.red(`\n${sym.fail} WordPress took too long to start. See ${logFile}`));
    stop();
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 1500));
  if (process.stdout.isTTY) process.stdout.write(dots++ % 40 === 39 ? ".\n" : ".");
  const seed = readJSON(path.join(STATE_DIR, "ready.json"));
  if (!seed) continue;
  if (!seed.ok) {
    console.error(c.red(`\n${sym.fail} The site booted but setup failed: ${seed.error}`));
    stop();
    process.exit(1);
  }
  try {
    const res = await fetch(`${siteUrl}/wp-json/`, { signal: AbortSignal.timeout(5000) });
    ready = res.ok;
  } catch {
    /* still booting */
  }
}
if (process.stdout.isTTY) process.stdout.write("\n");
const seed = readJSON(path.join(STATE_DIR, "ready.json"));
writeJSON(path.join(STATE_DIR, "site.json"), { port, url: siteUrl, pid: process.pid, wp: seed.wp_version, startedAt: new Date().toISOString() });

// ---- 6. If AI apps were connected to a different port, re-point them ----------------
const connected = readJSON(path.join(STATE_DIR, "connected.json"));
if (connected && connected.port !== port && connected.targets?.length) {
  console.log(c.yellow(`\nYour AI apps were set up for port ${connected.port}; updating them to ${port}.`));
  connect({ port, only: connected.targets, useNpx: connected.useNpx });
}

// ---- 7. Friendly banner --------------------------------------------------------------
const line = c.dim(sym.rule.repeat(64));
console.log(`
${line}
  ${c.green(sym.ok)} ${c.bold("Your demo WordPress site is running")} ${c.dim(`(WordPress ${seed.wp_version})`)}

  Website     ${siteUrl}/
  Dashboard   ${siteUrl}/wp-admin/
              log in with  ${c.bold(config.admin.username)} / ${c.bold(config.admin.password)}
  MCP         ${mcpUrl(port)}
${line}
  Now open your AI app (Claude Desktop, Cursor, VS Code, Claude Code...)
  and try:

    ${c.green(sym.arrow)} Are you connected to my WordPress site? What is it called?
    ${c.green(sym.arrow)} Run a content audit and give me the top 3 things to fix this week.
    ${c.green(sym.arrow)} Delete all posts on my site.   ${c.dim("(it can't, on purpose)")}

  More prompts: PROMPTS.md   ${sym.dot}   Test without AI: npm run check
  Keep this window open. Press Ctrl+C to stop (the site resets next time).
${line}
`);
