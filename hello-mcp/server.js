#!/usr/bin/env node
/**
 * wporg-mcp: a minimal but genuinely useful MCP server (~100 lines).
 * It lets any MCP client (Claude, ChatGPT, Gemini, Cursor, VS Code...) query the
 * public WordPress.org APIs. No keys, no WordPress install required.
 *
 * One server, all three MCP building blocks:
 *   TOOLS     the model can DO things       -> search_plugins, plugin_details
 *   RESOURCES the model can READ context    -> wporg://core/latest
 *   PROMPTS   reusable templates for users  -> compare_plugins
 *
 * Transport: STDIO. The AI app launches this file as a subprocess and speaks JSON-RPC
 * over stdin/stdout. Rule #1 of STDIO servers: never console.log(); stdout IS the protocol.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API = "https://api.wordpress.org";
const server = new McpServer({ name: "wporg-mcp", version: "1.0.0" });

async function getJSON(url) {
  const res = await fetch(url, { headers: { "User-Agent": "wporg-mcp-demo/1.0" } });
  if (!res.ok) throw new Error(`WordPress.org API returned ${res.status}`);
  return res.json();
}

const summarize = (p) => ({
  name: p.name.replace(/&#\d+;|&amp;/g, (m) => (m === "&amp;" ? "&" : "")),
  slug: p.slug,
  version: p.version,
  active_installs: p.active_installs,
  rating: Math.round(p.rating) / 20, // 0-5 stars
  requires_wp: p.requires,
  tested_up_to: p.tested,
  last_updated: p.last_updated,
});

// ---------------------------------------------------------------- TOOL 1
server.registerTool(
  "search_plugins",
  {
    title: "Search WordPress.org plugins",
    description:
      "Searches the WordPress.org plugin directory. Returns name, slug, active installs, rating, and compatibility. Use to find or compare plugins.",
    inputSchema: {
      query: z.string().min(2).describe("Search terms, e.g. 'performance' or 'contact form'"),
      limit: z.number().int().min(1).max(10).default(5),
    },
  },
  async ({ query, limit }) => {
    const url = `${API}/plugins/info/1.2/?action=query_plugins&request[search]=${encodeURIComponent(query)}&request[per_page]=${limit}`;
    const data = await getJSON(url);
    const plugins = data.plugins.map(summarize);
    return {
      content: [{ type: "text", text: JSON.stringify({ query, plugins }, null, 2) }],
      structuredContent: { query, plugins },
    };
  }
);

// ---------------------------------------------------------------- TOOL 2
server.registerTool(
  "plugin_details",
  {
    title: "Plugin details",
    description:
      "Gets details for one plugin by slug: version, installs, rating, requirements, last update and a short description.",
    inputSchema: { slug: z.string().describe("Plugin slug, e.g. 'mcp-adapter'") },
  },
  async ({ slug }) => {
    const p = await getJSON(`${API}/plugins/info/1.2/?action=plugin_information&slug=${encodeURIComponent(slug)}`);
    if (p.error) return { content: [{ type: "text", text: p.error }], isError: true };
    const details = {
      ...summarize(p),
      requires_php: p.requires_php,
      short_description: p.sections?.description?.replace(/<[^>]+>/g, "").slice(0, 400),
      homepage: p.homepage,
    };
    return { content: [{ type: "text", text: JSON.stringify(details, null, 2) }] };
  }
);

// ---------------------------------------------------------------- RESOURCE
server.registerResource(
  "core-latest",
  "wporg://core/latest",
  {
    title: "Latest WordPress release",
    description: "The current stable WordPress version and minimum PHP/MySQL requirements.",
    mimeType: "application/json",
  },
  async (uri) => {
    const data = await getJSON(`${API}/core/version-check/1.7/`);
    const o = data.offers[0];
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ version: o.version, php_version: o.php_version, mysql_version: o.mysql_version }),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------- PROMPT
server.registerPrompt(
  "compare_plugins",
  {
    title: "Compare plugins for a job",
    description: "Find and compare WordPress.org plugins for a specific need.",
    argsSchema: { need: z.string().describe("What the site needs, e.g. 'contact forms'") },
  },
  ({ need }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Use search_plugins to find the top 5 WordPress plugins for "${need}". Compare them in a table (installs, rating, last updated, tested up to) and recommend one, explaining the trade-offs.`,
        },
      },
    ],
  })
);

await server.connect(new StdioServerTransport());
console.error("wporg-mcp running on STDIO");
