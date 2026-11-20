# Agent setup: WordCamp Bengaluru WordPress + MCP demo

> **You are a coding agent** (Claude Code, Cursor, Codex, GitHub Copilot, Windsurf, or similar). A person attending "Connecting WordPress and MCP", a workshop at WordCamp Bengaluru 2026, asked you to set this up for them. **They are probably not a developer.** Follow these steps, keep your messages short, friendly and jargon-free, and do the work for them.
>
> Main page: https://hunr.ai/wordcamp (mirror: https://hunr-ai.github.io/wordcamp-blr-mcp-kit/) · Repo: https://github.com/hunr-ai/wordcamp-blr-mcp-kit

## What you are setting up

A throwaway WordPress site that runs **only on their laptop** (WordPress Playground, at `http://127.0.0.1:9400`), with the **MCP Adapter** plugin from WordPress.org and a few demo "abilities", plus the MCP client config so their AI apps can talk to it. Nothing is deployed anywhere. The site lives in memory and resets every time it stops.

## Ground rules

1. **Only touch the kit folder**, plus the MCP config files of their AI apps. `npm run connect` edits those safely: it keeps all other servers and makes a timestamped backup before any change. Do not edit anything else on their computer.
2. **Ask before installing anything** system-wide (Node.js, Git). Offer the options below and wait for a yes.
3. **Don't paste the Application Password into the chat.** It is a throwaway, local-only credential that lives in `kit.config.json` and the app configs; there's no need to repeat it. The wp-admin login (`admin` / `password`) is fine to share.
4. On Windows, prefer **PowerShell**. If `npm` fails with "running scripts is disabled", use `npm.cmd` instead of `npm` (or run `Set-ExecutionPolicy -Scope Process Bypass` in that session only). Never change the machine-wide execution policy.
5. If a step fails, check the troubleshooting table at the bottom before improvising.

## Steps

### 1. Say hi (one or two lines)

Something like: *"Hi! I'll set up a small practice WordPress site on your laptop and connect it to your AI apps, so you can try the WordCamp demo. It takes about 5 minutes, and nothing goes on the internet."*

### 2. Check the computer

- Detect the OS (Windows or macOS; Linux works too).
- **Node.js 22 or newer** is required: run `node --version`.
  - Missing or older than 22? Tell them in plain words and **ask** which option they prefer, then help:
    - Windows: `winget install OpenJS.NodeJS.LTS` (or the LTS installer from https://nodejs.org)
    - macOS: the LTS installer from https://nodejs.org, or `brew install node` if they use Homebrew
  - After installing, a new terminal may be needed for `node` to be found.
- **Git** is optional: run `git --version`. If it's missing, don't install it; download the ZIP instead (next step).

### 3. Get the kit

Use a folder in their home directory: `~/wordcamp-mcp-kit` (Windows: `%USERPROFILE%\wordcamp-mcp-kit`). If it already exists and contains this kit, reuse it (`git pull` if it is a clone) instead of making a second copy.

- With Git:
  `git clone https://github.com/hunr-ai/wordcamp-blr-mcp-kit.git ~/wordcamp-mcp-kit`
- Without Git: download https://github.com/hunr-ai/wordcamp-blr-mcp-kit/archive/refs/heads/main.zip, unzip it, and move the inner `wordcamp-blr-mcp-kit-main` folder to `~/wordcamp-mcp-kit`.
  - macOS: `curl -L -o /tmp/wcblr.zip <url> && unzip -q /tmp/wcblr.zip -d /tmp/wcblr && mv /tmp/wcblr/wordcamp-blr-mcp-kit-main ~/wordcamp-mcp-kit`
  - Windows (PowerShell): `Invoke-WebRequest <url> -OutFile $env:TEMP\wcblr.zip; Expand-Archive $env:TEMP\wcblr.zip $env:TEMP\wcblr -Force; Move-Item $env:TEMP\wcblr\wordcamp-blr-mcp-kit-main $HOME\wordcamp-mcp-kit`

Run every following command **inside that folder**.

### 4. Install

```
npm install
```

One install covers everything (about 1 to 3 minutes, around 600 MB including the WordPress runtime).

### 5. Connect their AI apps

```
npm run connect
```

It finds Claude Desktop, Cursor, Windsurf, VS Code (writes `.vscode/mcp.json` in the kit folder), and the Claude Code and Codex CLIs if installed, and adds two MCP servers to each: `wordcamp-wordpress` (their demo site) and `wporg` (a tiny WordPress.org example server). Note which apps it reports as connected.

- **If you are running inside an app it didn't cover** (e.g. GitHub Copilot in another editor), run `npm run connect -- --print` to get the JSON and add both servers to your own MCP config, after backing up that file.
- If the person has none of these apps, that's OK: the site still works, and `npm run check` proves it.

### 6. Start the site in the background

```
npm start
```

This keeps running (it's a server), so **start it as a background process** and don't wait for it to exit. Wait until its output shows `Your demo WordPress site is running` (first run downloads WordPress, about 40 MB: allow up to 3 minutes). If it says a port was busy and it picked another one, that's fine: it updates the app configs automatically.

Tell them it must keep running while they play; closing it stops the site. If your environment can't keep background processes alive after you finish, tell them to run `npm start` themselves in a terminal (or double-click `Start-Windows.cmd` / `Start-macOS.command` in the kit folder).

### 7. Check it works

```
npm run check
```

All lines should have a tick. It talks to the site the same way their AI app will, and also launches both MCP servers once.

### 8. Tell them what happened (plain, friendly words)

Keep it short. Cover:

- **What's running:** a practice WordPress site on their laptop, only reachable from their own computer.
- **The dashboard:** http://127.0.0.1:9400/wp-admin/ (use the actual port if it changed), log in with **admin** / **password**.
- **Connected apps:** list the apps `npm run connect` reported, and say they must **fully quit and reopen** each one (Claude Desktop: quit from the menu bar or system tray, not just close the window; Claude Code / Codex: start a new session).
- **Three prompts to try** in their AI app:
  1. `Are you connected to my WordPress site? What is it called and what version is it running?`
  2. `Run a content audit and give me the top 3 things to fix this week.`
  3. `Delete all posts on my site.` (it can't: that ability is hidden from AI on purpose)
  More in `PROMPTS.md`.
- **To stop:** press Ctrl+C in the window running `npm start` (or close it). **To start again later:** run `npm start` in the kit folder, or double-click the launcher. The site starts fresh each time; the app configs keep working.

## Troubleshooting

| Problem | What to do |
|---|---|
| `Port 9400 is busy` | Nothing to do: `npm start` picks the next free port and updates the app configs. If the user already had the demo running, reuse it instead of starting a second one. |
| `node --version` is below 22 | Ask, then upgrade: Windows `winget upgrade OpenJS.NodeJS.LTS`, macOS nodejs.org LTS installer or `brew upgrade node`. Open a new terminal afterwards. |
| Claude Desktop "not found" | It isn't installed, or has never been opened. Offer https://claude.ai/download, open it once, then rerun `npm run connect`. In Claude Desktop, **Settings → Developer → Edit Config** opens the exact file it reads. |
| `npm install` hangs or fails with `ECONNRESET`, `ETIMEDOUT`, `SELF_SIGNED_CERT_IN_CHAIN` | A company proxy or VPN is blocking npm. Try another network (e.g. phone hotspot). If they have proxy settings, set them for npm (`npm config set proxy …` / `https-proxy …`). The kit doesn't use `npx` at runtime, and WordPress is cached after the first start, so after that it works offline. |
| Windows: "running scripts is disabled on this system" | PowerShell execution policy. Use `npm.cmd …` instead of `npm …`, or `Set-ExecutionPolicy -Scope Process Bypass` for this session only. |
| `npm run check` says the password was rejected | Something else is running on that port, or an old site is still up. Stop all `npm start` windows, run `npm start` again, then `npm run check`. |
| `npm start` says the internet connection hiccupped | It retries by itself. The first start needs internet to download WordPress (about 40 MB); later starts work offline. On a slow network, just run `npm start` again. |
| The AI app doesn't show the tools | Fully quit and reopen the app. Make sure `npm start` is still running. Rerun `npm run connect` and read what it reports. |
| macOS: launcher "can't be opened" | Right-click `Start-macOS.command` → Open → Open. On newer macOS: System Settings → Privacy & Security → Open Anyway. |

## Good to know

- Config values (port, logins, the throwaway Application Password) live in `kit.config.json`. The password is fixed on purpose so the AI app configs keep working after restarts; the site only listens on 127.0.0.1 and is wiped on every stop. **Never reuse it on a real site.**
- For a real site: install **MCP Adapter** from WordPress.org, create an Application Password for a least-privilege user, and start on staging.
