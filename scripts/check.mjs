#!/usr/bin/env node
// npm run check  ->  talks raw MCP (JSON-RPC over HTTP) to the demo site, no AI involved.
// This is exactly what Claude, Cursor & co. send behind the scenes. Then it checks the
// two servers the AI apps will launch (the WordPress proxy and wporg) actually start.
import { loadConfig, requireNode22, currentPort, mcpUrl, c, sym } from "./lib.mjs";
import { serverDefs } from "./connect.mjs";

requireNode22();
const config = loadConfig();
const port = currentPort(config);
const url = mcpUrl(port);
const auth = "Basic " + Buffer.from(`${config.appPassword.username}:${config.appPassword.password}`).toString("base64");

let failures = 0;
const ok = (msg, detail = "") => console.log(`  ${c.green(sym.ok)} ${msg}${detail ? c.dim("  " + detail) : ""}`);
const fail = (msg, help) => {
  failures++;
  console.log(`  ${c.red(sym.fail)} ${msg}`);
  if (help) console.log(c.yellow(`      ${help}`));
};

class Friendly extends Error {}

let sessionId;
let nextId = 1;
async function rpc(method, params) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: auth,
        ...(sessionId ? { "Mcp-Session-Id": sessionId, "MCP-Protocol-Version": "2025-11-25" } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, ...(params ? { params } : {}) }),
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    const code = e.cause?.code || e.name;
    if (code === "ECONNREFUSED" || code === "ECONNRESET")
      throw new Friendly(`Nothing is answering on port ${port}. Start the site with "npm start" (and keep that window open), then run this again.`);
    if (code === "TimeoutError") throw new Friendly("The site took too long to answer. It may still be starting; wait a few seconds and retry.");
    throw new Friendly(`Couldn't reach the site: ${e.message}`);
  }
  if (res.status === 401 || res.status === 403)
    throw new Friendly('WordPress rejected the Application Password. Stop the site (Ctrl+C) and run "npm start" again so it re-creates it.');
  if (res.status === 404) throw new Friendly("The MCP endpoint wasn't found. The MCP Adapter plugin may not be active; restart with \"npm start\".");
  if (res.status >= 300 && res.status < 400) throw new Friendly(`The site redirected the request (HTTP ${res.status}). Is something else running on port ${port}?`);
  if (!res.ok) throw new Friendly(`The site answered HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  sessionId = res.headers.get("mcp-session-id") || sessionId;
  const text = await res.text();
  // Servers may answer as JSON or as a one-shot SSE stream.
  const body = text.trimStart().startsWith("{") ? text : (text.match(/^data: (.*)$/m) || [])[1];
  const msg = JSON.parse(body);
  if (msg.error) throw new Friendly(`MCP error: ${msg.error.message}`);
  return msg.result;
}

const parseToolResult = (r) => r.structuredContent || JSON.parse(r.content?.[0]?.text || "{}");

console.log(c.bold(`\nChecking the demo site at ${url}\n`));
try {
  const init = await rpc("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "wordcamp-kit-check", version: "1.0" },
  });
  ok("initialize: the site speaks MCP", `${init.serverInfo?.name} ${init.serverInfo?.version || ""}`.trim());

  const { tools } = await rpc("tools/list");
  ok(`tools/list: ${tools.length} tools`, tools.map((t) => t.name).join(", "));

  const disc = parseToolResult(await rpc("tools/call", { name: "mcp-adapter-discover-abilities", arguments: {} }));
  const names = (disc.abilities || []).map((a) => a.name);
  ok(`discover-abilities: ${names.length} abilities the AI can see`, names.join(", "));
  for (const need of ["wcblr/content-audit", "wcblr/seo-check", "wcblr/create-draft"]) {
    if (!names.includes(need)) fail(`ability ${need} is missing`, "The demo abilities plugin didn't load. Restart with \"npm start\".");
  }
  if (names.includes("wcblr/delete-all-posts")) fail("delete-all-posts is visible to the AI (it should be hidden)");
  else ok("delete-all-posts is hidden from the AI, as intended");

  const audit = parseToolResult(
    await rpc("tools/call", { name: "mcp-adapter-execute-ability", arguments: { ability_name: "wcblr/content-audit", parameters: {} } })
  );
  const data = audit.data || audit;
  if (typeof data.total_posts !== "number") fail("content-audit returned something unexpected", JSON.stringify(audit).slice(0, 200));
  else {
    const counts = Object.entries(data.issues || {}).map(([k, v]) => `${v.length} ${k.replace(/_/g, " ")}`);
    ok(`content-audit ran: ${data.total_posts} posts`, counts.join(", "));
  }
} catch (e) {
  if (!(e instanceof Friendly)) throw e;
  fail(e.message);
}

// ---- The servers your AI apps will launch -----------------------------------------
if (!failures) {
  console.log(c.bold("\nChecking the servers your AI apps will launch\n"));
  let Client, StdioClientTransport;
  try {
    ({ Client } = await import("@modelcontextprotocol/sdk/client/index.js"));
    ({ StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js"));
  } catch {
    fail("The MCP SDK isn't installed.", 'Run "npm install" in the kit folder.');
  }
  if (Client) {
    for (const [name, def] of Object.entries(serverDefs({ port, config }))) {
      const client = new Client({ name: "wordcamp-kit-check", version: "1.0" });
      try {
        const transport = new StdioClientTransport({ command: def.command, args: def.args, env: { ...process.env, ...def.env }, stderr: "ignore" });
        await Promise.race([
          client.connect(transport),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timed out after 60s")), 60000)),
        ]);
        const { tools } = await client.listTools();
        ok(`${name}: starts and lists ${tools.length} tools`, tools.map((t) => t.name).join(", "));
      } catch (e) {
        fail(`${name} didn't start: ${e.message}`, 'Run "npm install" again; if you are behind a company proxy, see AGENT_SETUP.md troubleshooting.');
      } finally {
        await client.close().catch(() => {});
      }
    }
  }
}

console.log(
  failures
    ? c.red(`\n${failures} problem(s) found. The yellow lines above say what to do.\n`)
    : c.green(`\nAll good! Your site is ready for AI. Restart your AI app and say hello.\n`)
);
process.exit(failures ? 1 : 0);
