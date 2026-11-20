# Let AI work with your WordPress site, *safely*

The hands-on kit for **"Connecting WordPress and MCP"**, a workshop at WordCamp Bengaluru 2026 (Sunday 22 November).
It sets up a real WordPress site on your laptop with the **MCP Adapter** plugin from WordPress.org and connects it to your AI app, on Windows or macOS.

**Main page:** https://hunr.ai/wordcamp · Mirror: https://hunr-ai.github.io/wordcamp-blr-mcp-kit/

## Easiest way: paste this into your coding agent

Open Claude Code, Cursor, Codex, GitHub Copilot (agent mode), Windsurf or any other coding agent, and paste:

```text
Set up the WordCamp Bengaluru WordPress + MCP demo for me by following https://github.com/hunr-ai/wordcamp-blr-mcp-kit/blob/main/AGENT_SETUP.md
```

It checks your computer, asks before installing anything, sets everything up, and tells you what to try. No terminal? No problem. Your agent knows where it is.

## No coding agent? Double-click

You need **Node.js 22 or newer**. If it's missing, the launcher tells you how to get it (it's free and takes 2 minutes).

### Windows

1. [Download the ZIP](https://github.com/hunr-ai/wordcamp-blr-mcp-kit/archive/refs/heads/main.zip).
2. Right-click the ZIP → **Extract All…** → open the new folder.
3. Double-click **`Start-Windows.cmd`**. If Windows says it protected your PC, click **More info → Run anyway**.
4. Keep the window open. When it says your site is running, restart your AI app and try a prompt below.

### macOS

1. [Download the ZIP](https://github.com/hunr-ai/wordcamp-blr-mcp-kit/archive/refs/heads/main.zip) and double-click it to unzip (Safari may have done this already).
2. Open the **`wordcamp-blr-mcp-kit-main`** folder.
3. Right-click **`Start-macOS.command`** → **Open** → **Open**. (No Open button? **System Settings → Privacy & Security → Open Anyway**.)
4. Keep the Terminal window open. When it says your site is running, restart your AI app and try a prompt below.

Then open the dashboard at http://127.0.0.1:9400/wp-admin/ and log in with **admin** / **password**.

### Prefer the terminal?

```bash
git clone https://github.com/hunr-ai/wordcamp-blr-mcp-kit.git
cd wordcamp-blr-mcp-kit
npm install
npm run connect   # adds the MCP servers to Claude Desktop, Cursor, VS Code, Claude Code… (with backups)
npm start         # boots WordPress on http://127.0.0.1:9400 (keep it running)
npm run check     # in a second terminal: proves MCP works, no AI needed
```

## Prompts to try

Restart your AI app after setup, then ask:

- `Are you connected to my WordPress site? What is it called and what version is it running?`
- `Run a content audit and give me the top 3 things to fix this week.`
- `Run an SEO check on "WordPress 7.2 is almost here", rewrite it to fix every issue, and save the result as a new draft.`
- `Delete all posts on my site.` (it can't, on purpose)

More in [PROMPTS.md](PROMPTS.md).

## What's inside

| | |
|---|---|
| `Start-Windows.cmd`, `Start-macOS.command` | Double-click launchers: check Node, install, connect your apps, start the site |
| `AGENT_SETUP.md` | Step-by-step instructions written for coding agents |
| `scripts/start.mjs` (`npm start`) | Boots WordPress Playground on port 9400 (or the next free port), on 127.0.0.1 only |
| `scripts/connect.mjs` (`npm run connect`) | Adds two MCP servers to the AI apps it finds. `--print` shows the config without changing anything |
| `scripts/check.mjs` (`npm run check`) | Talks raw MCP to your site, exactly like an AI app would |
| `wordpress/` | Blueprint, demo content, the [MCP Adapter](https://wordpress.org/plugins/mcp-adapter/) plugin (0.7.2) and the demo abilities in `mu-plugins/wcblr-abilities.php` |
| `hello-mcp/` (`npm run hello`) | A ~100-line MCP server for the WordPress.org plugin directory, plus a tiny client |
| `kit.config.json` | Port, logins and the throwaway Application Password |
| `docs/` | The landing page (`content.json` holds its copy) |

The two MCP servers it adds:

- **`wordcamp-wordpress`**: your demo site, through the MCP Adapter endpoint `http://127.0.0.1:9400/wp-json/mcp/mcp-adapter-default-server`. Desktop apps connect with the `@automattic/mcp-wordpress-remote` proxy (installed locally, so it works offline); Claude Code connects over HTTP directly.
- **`wporg`**: the `hello-mcp` example server.

Supported apps: Claude Desktop, Cursor, Windsurf, VS Code / GitHub Copilot (`.vscode/mcp.json` in this folder), Claude Code and Codex. For anything else, `npm run connect -- --print` prints JSON you can paste.

## Safety notes

- **Local only.** The site listens on 127.0.0.1, so nobody else on the Wi-Fi can reach it. It lives in memory and starts fresh every time you stop it. After the first start it also works offline.
- **The AI only sees what the site shares.** There's a `delete-all-posts` ability in the code, but it isn't exposed to MCP, so the AI can't even see it.
- **Agents draft, humans publish.** No ability publishes. The AI acts as a WordPress user through an Application Password you can revoke in one click (Users → Profile).
- **The Application Password is deliberately fixed** (in `kit.config.json`) so your app configs keep working after restarts. It's a throwaway credential for a throwaway, local-only site. **Never reuse it on a real site.**
- **Your app configs are safe.** `npm run connect` only adds or updates its own two entries, keeps everything else, and saves a timestamped `*.wcblr-backup-*` copy next to each file it changes.
- **On a real site:** install MCP Adapter from WordPress.org, create an Application Password for a least-privilege user (not an admin), and start on staging.

## License

GPL-2.0-or-later. The bundled MCP Adapter plugin is GPL-2.0-or-later, © the WordPress contributors.

---

Workshop by Amartya Gaur ([hunr.ai](https://hunr.ai)), Nagesh Pai and Prince Kumar, at WordCamp Bengaluru 2026.
