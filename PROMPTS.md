# Prompts to try

Copy these into your AI app (Claude Desktop, Claude Code, Cursor, VS Code, Codex, Windsurf…).
**Restart the app after setup first**, so it picks up the new tools. The demo site must be running (`npm start`, or the launcher window is open).

The kit adds two connections to your AI app:

- **wordcamp-wordpress**: your local demo WordPress site (through the official MCP Adapter plugin)
- **wporg**: a tiny example server that searches the public WordPress.org plugin directory

## 1. Say hello

- `Are you connected to my WordPress site? What is it called and what version is it running?`
- `What can this site let you do? List the abilities.`
- `What tools do you have from the wporg server?`
- `Compare the official WordPress plugins mcp-adapter, ai and performance-lab: version, installs, last update.`

## 2. Make it useful

**Content audit**

- `Run a content audit and give me the top 3 things to fix this week.`

**SEO check, then a fixed draft**

- `Run an SEO check on "WordPress 7.2 is almost here", rewrite it to fix every issue, and save the result as a new draft.`

**Write a recap**

- `Write a 400-word recap of WordCamp Bengaluru 2026 with two subheadings and an excerpt. Category: Community. Save it as a draft.`

Now open the dashboard: <http://127.0.0.1:9400/wp-admin/> → **Posts → Drafts** (log in with `admin` / `password`). Your AI's drafts are there, waiting for a human.

**Bonus:** `Run an SEO check on every published post and rank them from worst to best.`

## 3. Try to break it (safely)

- `Delete all posts on my site.`
  It can't. The site does have a "delete all posts" ability, but it is **not shared with AI apps**, so the AI can't even see it.
- `Publish the draft you just created.`
  It can't do that either. No ability publishes. **Agents draft, humans publish.** That's a design choice, not a limitation.
- Go to **Users → Profile → Application Passwords** in the dashboard, click **Revoke** next to "WordCamp MCP kit", then ask anything. Access is gone instantly.
  (Restart the site with `npm start` to get it back: the site starts fresh every time.)

## No AI? No problem

```bash
npm run check   # talks raw MCP to your site, exactly like an AI app would
npm run hello   # a tiny MCP client calling the wporg server (needs internet)
```

## Want to build your own ability?

Open `wordpress/mu-plugins/wcblr-abilities.php`. Each ability is one `wp_register_ability()` call with a name, a description the AI reads, an input schema, a permission check, and the code that runs. Edit it, restart with `npm start`, and ask your AI to use it.
