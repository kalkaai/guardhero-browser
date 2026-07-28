#!/usr/bin/env bash
# Guard Hero Browser — Local Development Script
#
# Usage:
#   ./dev.sh          Launch UI dev server (Tier 1)
#   ./dev.sh test     Run C++ unit tests   (Tier 2)
#   ./dev.sh e2e      Run Playwright E2E   (Tier 3) — requires Tier 1 running
#   ./dev.sh e2e:ui   Open Playwright UI mode
#   ./dev.sh all      Run Tier 2 tests, then launch Tier 1

set -e
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RESET='\033[0m'

tier1() {
  echo -e "${CYAN}── Tier 1: React UI Dev Server ─────────────────────────${RESET}"
  echo "Installing dependencies..."
  cd "$REPO_ROOT/browser-ui"
  npm install --silent
  echo -e "${GREEN}✓ Starting dev server → http://localhost:5173${RESET}"
  echo "  Opening Guard Hero dev launcher in your browser..."
  echo "  Panels available:"
  echo "    http://localhost:5173/index.html          ← Dev Launcher"
  echo "    http://localhost:5173/newtab/index.html   ← New Tab Page"
  echo "    http://localhost:5173/popup/index.html    ← Toolbar Popup"
  echo "    http://localhost:5173/settings/index.html ← Settings"
  echo "    http://localhost:5173/devtools/index.html ← DevMode Panel"
  echo ""
  npm run dev
}

tier2() {
  echo -e "${CYAN}── Tier 2: C++ Unit Tests ───────────────────────────────${RESET}"
  chmod +x "$REPO_ROOT/tests/run_cpp_tests.sh"
  "$REPO_ROOT/tests/run_cpp_tests.sh" "${2:-all}"
}

tier3() {
  echo -e "${CYAN}── Tier 3: Playwright E2E Tests ─────────────────────────${RESET}"
  echo -e "${YELLOW}  Requires Tier 1 dev server running on http://localhost:5173${RESET}"
  echo "  Start it first with: ./dev.sh  (in a separate terminal)"
  echo ""
  cd "$REPO_ROOT/browser-ui"
  npm install --silent

  # Install Playwright browsers if not already present
  if ! npx playwright --version &>/dev/null 2>&1; then
    echo "Installing Playwright browsers..."
    npx playwright install --with-deps chromium
  fi

  echo -e "${CYAN}▶ Running E2E specs...${RESET}"
  npm run test:e2e
}

tier3_ui() {
  echo -e "${CYAN}── Tier 3: Playwright UI Mode ───────────────────────────${RESET}"
  echo -e "${YELLOW}  Requires Tier 1 dev server running on http://localhost:5173${RESET}"
  cd "$REPO_ROOT/browser-ui"
  npm install --silent
  npm run test:e2e:ui
}

case "${1:-ui}" in
  ui|"")   tier1 ;;
  test)    tier2 "$@" ;;
  e2e)     tier3 ;;
  e2e:ui)  tier3_ui ;;
  all)
    tier2 "$@"
    echo ""
    tier1
    ;;
  *)
    echo "Usage: ./dev.sh [ui|test|e2e|e2e:ui|all]"
    exit 1
    ;;
esac
