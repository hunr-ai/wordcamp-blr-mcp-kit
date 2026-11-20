#!/usr/bin/env node
/**
 * A tiny MCP *client*. This is what Claude Desktop, ChatGPT, Cursor etc. do behind the scenes:
 *   1) launch the server  2) list tools  3) call tools  4) read a resource
 * Run:  npm run hello   (needs internet: it asks the public WordPress.org API)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "server.js");
const client = new Client({ name: "wordcamp-demo-client", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [serverFile] }));
console.log("🤝 connected to", client.getServerVersion());

const { tools } = await client.listTools();
console.log("\n🧰 tools/list");
for (const t of tools) console.log(`   - ${t.name}: ${t.description}`);

// Official WordPress-team plugins only (no third-party promotion on stage).
console.log("\n📞 tools/call plugin_details × 3 (official WordPress.org plugins)");
const rows = [];
for (const slug of ["mcp-adapter", "ai", "performance-lab"]) {
  const r = await client.callTool({ name: "plugin_details", arguments: { slug } });
  const d = JSON.parse(r.content[0].text);
  rows.push({ slug, version: d.version, active_installs: d.active_installs, tested_up_to: d.tested_up_to });
}
console.table(rows);

const details = await client.callTool({ name: "plugin_details", arguments: { slug: "mcp-adapter" } });
console.log("📞 tools/call plugin_details { slug: 'mcp-adapter' }\n", details.content[0].text);

const core = await client.readResource({ uri: "wporg://core/latest" });
console.log("\n📖 resources/read wporg://core/latest →", core.contents[0].text);

await client.close();
