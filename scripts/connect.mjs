#!/usr/bin/env node
// npm run connect  ->  adds two MCP servers to the AI apps found on this computer:
//   wordcamp-wordpress : your local demo WordPress site (MCP Adapter plugin, via the
//                        @automattic/mcp-wordpress-remote STDIO proxy)
//   wporg              : the tiny hello-mcp server that searches WordPress.org
//
// Safe by design: it only ADDS or UPDATES these two entries, keeps every other server,
// and makes a timestamped backup of any config file before changing it.
//
//   npm run connect                 write configs for every app it finds
//   npm run connect -- --print      only print the config (JSON) and change nothing
//   npm run connect -- --port 9401  point the configs at a different port
//   npm run connect -- --only cursor,claude-desktop
//   npm run connect -- --npx        use `npx @automattic/mcp-wordpress-remote@latest` instead of the local copy
//
// Testing tip: KIT_CONFIG_HOME=/some/tmp/dir redirects EVERY target (home folder, AppData,
// Claude Code, Codex) into that folder, so you can try it without touching real configs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { KIT_DIR, STATE_DIR, IS_WIN, loadConfig, requireNode22, readJSON, writeJSON, flag, option, currentPort, mcpUrl, c, sym } from "./lib.mjs";

const PROXY_BIN = path.join(KIT_DIR, "node_modules", "@automattic", "mcp-wordpress-remote", "dist", "proxy.js");
const WPORG_SERVER = path.join(KIT_DIR, "hello-mcp", "server.js");

/** The two server definitions, in the common { command, args, env } shape. */
export function serverDefs({ port, useNpx = false, config = loadConfig() } = {}) {
  const env = {
    WP_API_URL: mcpUrl(port),
    WP_API_USERNAME: config.appPassword.username,
    WP_API_PASSWORD: config.appPassword.password,
  };
  // GUI apps (Claude Desktop, Cursor) often don't see your shell PATH, so use the absolute
  // path of the Node that is running right now, and the copy of the proxy in node_modules.
  const wordpress = useNpx
    ? { command: "npx", args: ["-y", "@automattic/mcp-wordpress-remote@latest"], env }
    : { command: process.execPath, args: [PROXY_BIN], env };
  const wporg = { command: process.execPath, args: [WPORG_SERVER] };
  return { [config.servers.wordpress]: wordpress, [config.servers.wporg]: wporg };
}

function homes() {
  const override = process.env.KIT_CONFIG_HOME && path.resolve(process.env.KIT_CONFIG_HOME);
  const home = override || os.homedir();
  return {
    override,
    home,
    appData: override ? path.join(home, "AppData", "Roaming") : process.env.APPDATA || path.join(home, "AppData", "Roaming"),
    localAppData: override ? path.join(home, "AppData", "Local") : process.env.LOCALAPPDATA || path.join(home, "AppData", "Local"),
    macSupport: path.join(home, "Library", "Application Support"),
  };
}

const exists = (p) => {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
};

/** Claude Desktop config files: classic install, plus the Windows Store/MSIX install which keeps its own AppData copy. */
function claudeDesktopFiles(h) {
  if (process.platform === "darwin") {
    const dir = path.join(h.macSupport, "Claude");
    const installed = !h.override && ["/Applications/Claude.app", path.join(os.homedir(), "Applications", "Claude.app")].some(exists);
    return exists(dir) || installed ? [path.join(dir, "claude_desktop_config.json")] : [];
  }
  if (IS_WIN) {
    const files = [];
    const dir = path.join(h.appData, "Claude");
    const installed = !h.override && exists(path.join(h.localAppData, "AnthropicClaude"));
    if (exists(dir) || installed) files.push(path.join(dir, "claude_desktop_config.json"));
    const pkgs = path.join(h.localAppData, "Packages");
    if (exists(pkgs)) {
      for (const name of fs.readdirSync(pkgs)) {
        if (/^Claude_/i.test(name)) files.push(path.join(pkgs, name, "LocalCache", "Roaming", "Claude", "claude_desktop_config.json"));
      }
    }
    return files;
  }
  const dir = path.join(h.home, ".config", "Claude"); // Linux (unofficial builds)
  return exists(dir) ? [path.join(dir, "claude_desktop_config.json")] : [];
}

function jsonTargets(h) {
  return [
    ...claudeDesktopFiles(h).map((file) => ({ id: "claude-desktop", app: "Claude Desktop", file, key: "mcpServers", shape: "plain" })),
    ...(exists(path.join(h.home, ".cursor"))
      ? [{ id: "cursor", app: "Cursor", file: path.join(h.home, ".cursor", "mcp.json"), key: "mcpServers", shape: "plain" }]
      : []),
    ...(exists(path.join(h.home, ".codeium", "windsurf"))
      ? [{ id: "windsurf", app: "Windsurf", file: path.join(h.home, ".codeium", "windsurf", "mcp_config.json"), key: "mcpServers", shape: "plain" }]
      : []),
    // VS Code (and GitHub Copilot agent mode) reads .vscode/mcp.json from the open folder.
    { id: "vscode", app: "VS Code (open this kit folder)", file: path.join(KIT_DIR, ".vscode", "mcp.json"), key: "servers", shape: "vscode" },
  ];
}

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

/** Adds/updates our entries in one JSON config file. Never removes anything. */
function mergeJsonFile(target, defs) {
  const { file, key, shape } = target;
  const existed = exists(file);
  let data = {};
  if (existed) {
    const raw = fs.readFileSync(file, "utf8");
    if (raw.trim()) {
      try {
        data = JSON.parse(raw);
      } catch {
        return { status: "skipped", reason: "the file isn't plain JSON (maybe it has comments), so I left it alone" };
      }
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) return { status: "skipped", reason: "unexpected file format, left alone" };
  }
  if (data[key] == null) data[key] = {};
  if (typeof data[key] !== "object" || Array.isArray(data[key])) return { status: "skipped", reason: `"${key}" has an unexpected format, left alone` };

  const changes = [];
  for (const [name, def] of Object.entries(defs)) {
    const entry = shape === "vscode" ? { type: "stdio", ...def } : def;
    const before = data[key][name];
    if (JSON.stringify(before) === JSON.stringify(entry)) continue;
    data[key][name] = entry;
    changes.push(`${before ? "updated" : "added"} ${name}`);
  }
  if (!changes.length) return { status: "unchanged" };

  let backup;
  if (existed) {
    backup = `${file}.wcblr-backup-${stamp()}`;
    fs.copyFileSync(file, backup);
  }
  writeJSON(file, data);
  return { status: "changed", changes, backup };
}

// ---- CLI-based clients (Claude Code, Codex) ----------------------------------------
// cmd.exe splits on spaces and also on = ; , so quote anything with those (base64, --env K=V).
const quoteWin = (a) => (/[\s"&|<>^()=;,]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a);

function run(cmd, args, env) {
  // On Windows, npm-installed CLIs are .cmd shims, which need a shell (and manual quoting).
  const r = IS_WIN
    ? spawnSync([cmd, ...args].map(quoteWin).join(" "), { shell: true, env, encoding: "utf8" })
    : spawnSync(cmd, args, { env, encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}`.trim(), missing: !!r.error || r.status === 9009 };
}

function cliEnv(h) {
  const env = { ...process.env };
  if (h.override) {
    env.CLAUDE_CONFIG_DIR = path.join(h.home, ".claude");
    env.CODEX_HOME = path.join(h.home, ".codex");
    fs.mkdirSync(env.CODEX_HOME, { recursive: true });
  }
  return env;
}

const hasCli = (cmd, env) => {
  const r = run(cmd, ["--version"], env);
  return r.ok;
};

function connectClaudeCode(port, defs, config, env) {
  const name = config.servers.wordpress;
  const basic = Buffer.from(`${config.appPassword.username}:${config.appPassword.password}`).toString("base64");
  const results = [];
  // `claude mcp add` refuses to overwrite, so remove our own entries first (ignore "not found").
  run("claude", ["mcp", "remove", "--scope", "user", name], env);
  const a = run("claude", ["mcp", "add", "--scope", "user", "--transport", "http", name, mcpUrl(port), "--header", `Authorization: Basic ${basic}`], env);
  results.push(a.ok ? `added ${name} (direct HTTP)` : `could not add ${name}: ${a.out}`);
  const w = defs[config.servers.wporg];
  run("claude", ["mcp", "remove", "--scope", "user", config.servers.wporg], env);
  const b = run("claude", ["mcp", "add", "--scope", "user", config.servers.wporg, "--", w.command, ...w.args], env);
  results.push(b.ok ? `added ${config.servers.wporg}` : `could not add ${config.servers.wporg}: ${b.out}`);
  return { ok: a.ok && b.ok, results };
}

function connectCodex(defs, env) {
  const results = [];
  let ok = true;
  for (const [name, def] of Object.entries(defs)) {
    run("codex", ["mcp", "remove", name], env);
    const envArgs = Object.entries(def.env || {}).flatMap(([k, v]) => ["--env", `${k}=${v}`]);
    const r = run("codex", ["mcp", "add", name, ...envArgs, "--", def.command, ...def.args], env);
    ok = ok && r.ok;
    results.push(r.ok ? `added ${name}` : `could not add ${name}: ${r.out}`);
  }
  return { ok, results };
}

/** Main entry, also used by start.mjs to re-point configs when the port changes. */
export function connect({ port, only, useNpx = false, log = console.log } = {}) {
  const config = loadConfig();
  const defs = serverDefs({ port, useNpx, config });
  const h = homes();
  const env = cliEnv(h);
  const want = (id) => !only || only.includes(id);
  const touched = new Set();
  const restart = new Set();

  if (!useNpx && !exists(PROXY_BIN)) {
    log(c.red(`${sym.fail} The kit isn't installed yet. Run "npm install" in ${KIT_DIR} first.`));
    process.exitCode = 1;
    return { targets: [] };
  }

  log(c.bold(`\nConnecting your AI apps to the demo site (${mcpUrl(port)})\n`));
  if (h.override) log(c.yellow(`  Test mode: KIT_CONFIG_HOME=${h.override} (real configs are not touched)\n`));

  for (const t of jsonTargets(h).filter((t) => want(t.id))) {
    const r = mergeJsonFile(t, defs);
    if (r.status === "changed") {
      log(`  ${c.green(sym.ok)} ${c.bold(t.app)}: ${r.changes.join(", ")}`);
      log(c.dim(`      ${t.file}`));
      if (r.backup) log(c.dim(`      backup: ${r.backup}`));
      restart.add(t.app);
    } else if (r.status === "unchanged") {
      log(`  ${c.green(sym.ok)} ${c.bold(t.app)}: already set up`);
      log(c.dim(`      ${t.file}`));
    } else {
      log(`  ${c.yellow("!")} ${c.bold(t.app)}: skipped, ${r.reason}`);
      log(c.dim(`      ${t.file}`));
      continue;
    }
    touched.add(t.id);
  }

  if (want("claude-code") && hasCli("claude", env)) {
    const r = connectClaudeCode(port, defs, config, env);
    log(`  ${r.ok ? c.green(sym.ok) : c.yellow("!")} ${c.bold("Claude Code")}: ${r.results.join(", ")} (user scope)`);
    if (r.ok) {
      touched.add("claude-code");
      restart.add("Claude Code (start a new session)");
    }
  }
  if (want("codex") && hasCli("codex", env)) {
    const r = connectCodex(defs, env);
    log(`  ${r.ok ? c.green(sym.ok) : c.yellow("!")} ${c.bold("Codex")}: ${r.results.join(", ")}`);
    if (r.ok) {
      touched.add("codex");
      restart.add("Codex (start a new session)");
    }
  }

  const notFound = [];
  if (want("claude-desktop") && !touched.has("claude-desktop")) notFound.push("Claude Desktop");
  if (want("cursor") && !touched.has("cursor")) notFound.push("Cursor");
  if (notFound.length) log(c.dim(`\n  Not found on this computer: ${notFound.join(", ")}. (That's fine.)`));

  if (restart.size) {
    log(c.bold(`\n  Restart ${[...restart].join(", ")} to load the new tools.`));
    log(c.dim("  (Quit the app completely, not just the window, then open it again.)"));
  }
  log("");

  writeJSON(path.join(STATE_DIR, "connected.json"), { port, targets: [...touched], useNpx, at: new Date().toISOString() });
  return { targets: [...touched] };
}

function main() {
  requireNode22();
  const config = loadConfig();
  const port = Number(option("port")) || currentPort(config);
  const useNpx = flag("npx");
  if (flag("print")) {
    // stdout gets pure JSON (pipe-able); the human notes go to stderr.
    process.stdout.write(JSON.stringify({ mcpServers: serverDefs({ port, useNpx, config }) }, null, 2) + "\n");
    const basic = Buffer.from(`${config.appPassword.username}:${config.appPassword.password}`).toString("base64");
    console.error(
      c.dim(
        `\nPaste the JSON above into your app's MCP config (Claude Desktop, Cursor, Windsurf use "mcpServers";\n` +
          `VS Code uses "servers" and each entry also needs "type": "stdio").\n` +
          `Claude Code, direct HTTP:\n  claude mcp add --scope user --transport http ${config.servers.wordpress} ${mcpUrl(port)} --header "Authorization: Basic ${basic}"\n`
      )
    );
    return;
  }
  const only = option("only")?.split(",").map((s) => s.trim());
  connect({ port, only, useNpx });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
