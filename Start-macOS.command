#!/bin/bash
# Double-click me to start the WordCamp Bengaluru WordPress + MCP demo on macOS.
# Checks Node.js, installs the kit on first run, connects your AI apps, starts WordPress.
# First time: right-click -> Open (macOS blocks unsigned scripts on a plain double-click).

cd "$(dirname "$0")" || exit 1

finish() {
  echo
  read -n 1 -s -r -p "  Press any key to close this window..."
  echo
  exit "${1:-0}"
}

# Finder-launched windows sometimes miss Homebrew or nvm on the PATH.
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi

echo
echo "  WordCamp Bengaluru 2026 - Connecting WordPress and MCP"
echo "  ======================================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js is not installed yet. It is free and takes about 2 minutes:"
  echo
  echo "    Option 1: download the \"LTS\" installer from https://nodejs.org"
  echo "    Option 2: if you use Homebrew, run:  brew install node"
  echo
  echo "  Then double-click Start-macOS.command again."
  finish 1
fi

if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  echo "  Your Node.js is $(node --version), but this kit needs version 22 or newer."
  echo
  echo "    Option 1: download the \"LTS\" installer from https://nodejs.org"
  echo "    Option 2: if you use Homebrew, run:  brew upgrade node"
  echo
  echo "  Then double-click Start-macOS.command again."
  finish 1
fi

if [ ! -f "node_modules/@wp-playground/cli/package.json" ]; then
  echo "  First run: installing the kit. This takes 1 to 3 minutes..."
  echo
  if ! npm install; then
    echo
    echo "  The install did not finish. Check your internet connection and try again."
    echo "  On office Wi-Fi or VPN, a company proxy may block npm: try another network."
    finish 1
  fi
fi

npm run connect
npm start
finish 0
