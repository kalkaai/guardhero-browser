#!/usr/bin/env bash
# setup.sh — First-time build environment setup for Guard Hero Browser.
#
# This script walks through the entire chain from a clean checkout to a
# compiled browser binary. Run it once; subsequent builds use autoninja directly.
#
# Usage:
#   ./setup.sh                  # full setup (recommended first time)
#   ./setup.sh --sync-only      # only run gclient sync (skip build)
#   ./setup.sh --patch-only     # only apply patches (skip sync + build)
#   ./setup.sh --build-only     # only run the build (skip sync + patches)
#   ./setup.sh --check          # check prerequisites only, then exit
#
# Time estimates (first run):
#   Prerequisites:   2–5 min
#   gclient sync:    60–120 min  (downloads ~30 GB of Chromium source)
#   Patch apply:     2–5 min
#   Build (Release): 90–180 min  Intel Mac, 16 GB, 6-core i7 (with concurrent_links=1)
#                    60–90  min  Apple Silicon M1/M2/M3
#
# Requirements (macOS):
#   - Xcode 15+  (install from App Store or: xcode-select --install)
#   - Python 3.9+
#   - Node.js 18+  (for browser-ui assets)
#   - Git 2.30+
#   - 80 GB free disk space (source ~30 GB, build output ~40 GB)
#   - 16 GB RAM minimum (the linker can spike to 4–8 GB per job;
#     setup.sh detects your RAM and sets concurrent_links accordingly)
#
# Requirements (Linux / Ubuntu 22.04+):
#   - build-essential python3 python3-pip git nodejs npm
#   - See: https://chromium.googlesource.com/chromium/src/+/main/docs/linux/build_instructions.md

set -euo pipefail

# ── Colors + helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'

step()  { echo -e "\n${BOLD}${CYAN}==> $*${NC}"; }
ok()    { echo -e "    ${GREEN}✓${NC}  $*"; }
warn()  { echo -e "    ${YELLOW}⚠${NC}  $*"; }
fail()  { echo -e "\n${RED}✗ FATAL: $*${NC}\n"; exit 1; }
info()  { echo -e "    ${NC}→  $*"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$REPO_ROOT/src"
OUT_DIR="$SRC_DIR/out/Release"
DEPOT_TOOLS_DIR="$REPO_ROOT/.depot_tools"
UNGOOGLED_DIR="$REPO_ROOT/.ungoogled-chromium"

# ── Parse flags ───────────────────────────────────────────────────────────────
DO_SYNC=true
DO_PATCHES=true
DO_BUILD=true
CHECK_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --sync-only)    DO_PATCHES=false; DO_BUILD=false ;;
    --patch-only)   DO_SYNC=false;    DO_BUILD=false ;;
    --build-only)   DO_SYNC=false;    DO_PATCHES=false ;;
    --check)        CHECK_ONLY=true ;;
    --help|-h)
      sed -n '2,20p' "$0" | grep '^#' | sed 's/^# //'
      exit 0 ;;
  esac
done

echo -e "${BOLD}"
echo "  ┌──────────────────────────────────────────┐"
echo "  │   Guard Hero Browser — Build Setup       │"
echo "  │   github.com/guardhero/guardhero-browser │"
echo "  └──────────────────────────────────────────┘"
echo -e "${NC}"

# ── Step 1: Prerequisites ─────────────────────────────────────────────────────
step "Checking prerequisites"

OS="$(uname -s)"
ARCH="$(uname -m)"
ok "Platform: $OS $ARCH"

# Python 3.9+
PYTHON_VER=$(python3 --version 2>/dev/null | awk '{print $2}') || fail "python3 not found"
PYTHON_MAJOR=$(echo "$PYTHON_VER" | cut -d. -f1)
PYTHON_MINOR=$(echo "$PYTHON_VER" | cut -d. -f2)
[[ "$PYTHON_MAJOR" -eq 3 && "$PYTHON_MINOR" -ge 9 ]] || \
  fail "Python 3.9+ required, found $PYTHON_VER"
ok "Python $PYTHON_VER"

# Git 2.30+
GIT_VER=$(git --version 2>/dev/null | awk '{print $3}') || fail "git not found"
ok "Git $GIT_VER"

# Node.js 18+
if command -v node &>/dev/null; then
  NODE_VER=$(node --version | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  [[ "$NODE_MAJOR" -ge 18 ]] || warn "Node.js 18+ recommended (found $NODE_VER). Browser UI build may fail."
  ok "Node.js $NODE_VER"
else
  warn "Node.js not found — browser-ui assets won't be built. Install from nodejs.org"
fi

# macOS: Xcode command line tools
if [[ "$OS" == "Darwin" ]]; then
  xcode-select -p &>/dev/null || \
    fail "Xcode command line tools not installed.\nRun: xcode-select --install"
  XCODE_VER=$(xcodebuild -version 2>/dev/null | head -1) || true
  ok "${XCODE_VER:-Xcode CLI tools present}"

  # Accept Xcode license (required for builds)
  if ! xcodebuild -checkFirstLaunchStatus &>/dev/null; then
    warn "Xcode license may not be accepted. If the build fails, run: sudo xcodebuild -license accept"
  fi
fi

# Linux: check build-essential
if [[ "$OS" == "Linux" ]]; then
  if ! dpkg -l build-essential &>/dev/null 2>&1; then
    warn "build-essential may not be installed."
    info "Install: sudo apt install build-essential python3 python3-pip git nodejs npm"
  else
    ok "build-essential present"
  fi
fi

# Disk space — need 80 GB minimum
if [[ "$OS" == "Darwin" ]]; then
  AVAIL_GB=$(df -g "$REPO_ROOT" | tail -1 | awk '{print $4}')
else
  AVAIL_GB=$(df -BG "$REPO_ROOT" | tail -1 | awk '{print $4}' | tr -d 'G')
fi
if [[ "$AVAIL_GB" -lt 80 ]]; then
  warn "Low disk space: ${AVAIL_GB}GB available, 80 GB+ recommended."
  warn "The Chromium source is ~30 GB; build output adds ~40 GB."
  read -r -p "    Continue anyway? [y/N] " DISK_CONFIRM
  [[ "$DISK_CONFIRM" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
else
  ok "${AVAIL_GB}GB disk space available"
fi

[[ "$CHECK_ONLY" == "true" ]] && { echo -e "\n${GREEN}All prerequisite checks passed.${NC}"; exit 0; }

# ── Step 2: depot_tools ───────────────────────────────────────────────────────
step "Setting up depot_tools"

if [[ -d "$DEPOT_TOOLS_DIR/.git" ]]; then
  ok "depot_tools found at $DEPOT_TOOLS_DIR"
  info "Updating depot_tools..."
  git -C "$DEPOT_TOOLS_DIR" pull --ff-only --quiet || warn "depot_tools update failed (using existing)"
elif command -v gclient &>/dev/null; then
  DEPOT_TOOLS_DIR="$(dirname "$(command -v gclient)")"
  ok "depot_tools already on PATH at $DEPOT_TOOLS_DIR"
else
  info "Cloning depot_tools into $DEPOT_TOOLS_DIR ..."
  git clone --depth=1 https://chromium.googlesource.com/chromium/tools/depot_tools.git \
      "$DEPOT_TOOLS_DIR"
  ok "depot_tools cloned"
fi

# Add depot_tools to PATH for this session
export PATH="$DEPOT_TOOLS_DIR:$PATH"
export DEPOT_TOOLS_UPDATE=0       # don't auto-update again mid-script

# Verify gclient is now available
command -v gclient &>/dev/null || fail "gclient not found after depot_tools setup"
ok "gclient: $(gclient --version 2>&1 | head -1)"

# ── Step 3: Clone ungoogled-chromium (determines target Chromium version) ─────
# Must happen before gclient sync so we know which Chromium version to pin.
if [[ "$DO_SYNC" == "true" || "$DO_PATCHES" == "true" ]]; then
  step "Fetching ungoogled-chromium (determines Chromium version to sync)"

  UNGOOGLED_TAG="130.0.6723.116-1"   # stable ungoogled-chromium release

  if [[ -d "$UNGOOGLED_DIR/.git" ]]; then
    info "ungoogled-chromium already cloned"
  else
    info "Cloning ungoogled-chromium at tag $UNGOOGLED_TAG..."
    git clone --depth=1 \
      --branch "$UNGOOGLED_TAG" \
      https://github.com/ungoogled-software/ungoogled-chromium.git \
      "$UNGOOGLED_DIR"
    ok "ungoogled-chromium cloned"
  fi

  # Read exact Chromium version this ungoogled release targets
  CHROMIUM_VERSION=$(cat "$UNGOOGLED_DIR/chromium_version.txt" 2>/dev/null | tr -d '[:space:]')
  [[ -z "$CHROMIUM_VERSION" ]] && fail "Cannot read chromium_version.txt — version unknown"
  ok "Target Chromium version: $CHROMIUM_VERSION (from ungoogled-chromium)"
fi

# ── Step 4: gclient sync ──────────────────────────────────────────────────────
if [[ "$DO_SYNC" == "true" ]]; then
  step "Syncing Chromium source via gclient (this takes 60–120 min)"

  info "Pinning to Chromium $CHROMIUM_VERSION (matches ungoogled-chromium)"
  info "Source will be synced into: $SRC_DIR"
  info "Estimated download: ~30 GB"

  # Pin to the exact version tag from ungoogled-chromium.
  # Using a version tag (e.g. 130.0.6723.116) works with Gitiles smart HTTP
  # because tags are advertised refs — unlike raw commit hashes (HTTP 500).
  cat > "$REPO_ROOT/.gclient" << GCLIENTEOF
solutions = [
  {
    "name"        : "src",
    "url"         : "https://chromium.googlesource.com/chromium/src.git@${CHROMIUM_VERSION}",
    "managed"     : True,
    "custom_deps" : {},
    "custom_vars" : {},
  },
]
cache_dir = None
GCLIENTEOF
  ok "Wrote .gclient (pinned to Chromium $CHROMIUM_VERSION)"

  # macOS: use depot_tools' own Python and clang, not Xcode's shims.
  if [[ "$OS" == "Darwin" ]]; then
    export FORCE_MAC_TOOLCHAIN=0
    export DEVELOPER_DIR="$(xcode-select -p)"
  fi

  # --nohooks: skip hooks until after our patches are applied (hooks expect
  # pristine Chromium; applying patches first avoids hook failures).
  # --no-history: shallow clone saves ~10 GB and significant sync time.
  cd "$REPO_ROOT"
  gclient sync \
    --nohooks \
    --no-history \
    --jobs=8 \
    --verbose 2>&1 | tee "$REPO_ROOT/.gclient-sync.log" | \
      grep -E "^(\[|Syncing|remote:|fatal:|error:)" || true

  ok "gclient sync complete"
  info "Full log: $REPO_ROOT/.gclient-sync.log"
else
  info "Skipping gclient sync (--patch-only or --build-only)"
fi

# ── Step 5: Ungoogled Chromium + Guard Hero patches ───────────────────────────
if [[ "$DO_PATCHES" == "true" ]]; then
  step "Applying Ungoogled Chromium + Guard Hero patches"

  # Apply ungoogled-chromium patches via their pruning/patching pipeline
  if [[ -f "$UNGOOGLED_DIR/utils/patches.py" ]]; then
    info "Applying ungoogled-chromium patches (this takes 10–30 min, progress shown below)..."
    python3 "$UNGOOGLED_DIR/utils/patches.py" apply \
      "$SRC_DIR" \
      "$UNGOOGLED_DIR/patches"
    ok "Ungoogled Chromium patches applied"
  else
    warn "ungoogled-chromium utils/patches.py not found — skipping UGC patches"
    warn "The Guard Hero patches layer on top of UGC. Results may differ."
  fi

  # ── Step 5: Guard Hero patches ────────────────────────────────────────────
  step "Applying Guard Hero patches"

  python3 "$REPO_ROOT/build/apply_gh_patches.py" \
    --patches-dir "$REPO_ROOT/patches" \
    --src-dir "$SRC_DIR" \
    --verbose

  ok "Guard Hero patches applied"

  # ── Step 5b: gclient runhooks ────────────────────────────────────────────
  # Hooks download additional build tools (clang, node, sysroot, etc.).
  # We run them AFTER patching so the hook scripts see the patched tree.
  step "Running gclient hooks (downloads clang, sysroot, etc.)"
  cd "$REPO_ROOT"
  gclient runhooks --jobs=8 2>&1 | tee -a "$REPO_ROOT/.gclient-sync.log" | \
    grep -E "^(Hook|Running|Updating|\\[)" || true
  ok "Hooks complete"
else
  info "Skipping patches (--sync-only or --build-only)"
fi

# ── Step 6: Generate icons ────────────────────────────────────────────────────
step "Generating Guard Hero icon set"

if python3 -c "import cairosvg" &>/dev/null 2>&1 || command -v rsvg-convert &>/dev/null; then
  python3 "$REPO_ROOT/build/generate_icons.py" --output "$SRC_DIR/resources/guardhero/icons"
  ok "Icons generated"
else
  warn "No SVG rasterizer found — skipping icon generation"
  info "Install one: pip install cairosvg   OR   brew install librsvg"
fi

# ── Step 7: Build browser-ui assets ──────────────────────────────────────────
step "Building browser-ui React assets"

if command -v node &>/dev/null && [[ -f "$REPO_ROOT/browser-ui/package.json" ]]; then
  cd "$REPO_ROOT/browser-ui"
  npm ci --silent
  npm run build
  cd "$REPO_ROOT"
  ok "browser-ui assets built"
else
  warn "Skipping browser-ui build (node not found)"
fi

# ── Step 7b: gclient runhooks (idempotent — safe to re-run) ──────────────────
# Hooks download clang, sysroot, node, and bootstrap depot_tools' own Python.
# Required before GN gen. We run this in --build-only mode too in case the
# patch step was skipped (hooks are idempotent, re-running is safe).
if [[ "$DO_BUILD" == "true" ]]; then
  if [[ ! -f "$REPO_ROOT/src/build/config/compiler/BUILD.gn" ]]; then
    warn "src/ does not look fully synced — skipping runhooks"
  else
    step "Running gclient hooks (downloads clang, sysroot if needed)"
    cd "$REPO_ROOT"
    gclient runhooks --jobs=8 2>&1 | grep -E "^(Hook|Running|Updating|\[)" || true
    ok "Hooks complete"
  fi
fi

# ── Step 8: GN configuration ──────────────────────────────────────────────────
if [[ "$DO_BUILD" == "true" ]]; then
  step "Configuring build with GN"

  mkdir -p "$OUT_DIR"

  # ── Detect RAM and tune link parallelism ─────────────────────────────────
  # The Chromium linker (lld) can use 4–8 GB per parallel link job.
  # On 16 GB machines, running two linkers simultaneously causes OOM kills.
  # We detect physical RAM and set concurrent_links conservatively.
  #
  # Rule of thumb:  concurrent_links = floor(RAM_GB / 10), minimum 1.
  # The chrome binary link alone can spike to 6–8 GB, so we're conservative.
  # 16 GB → 1 link job at a time   (safe: one 6-8 GB link + OS + compile)
  # 32 GB → 3 link jobs
  # 64 GB → 6 link jobs
  if [[ "$OS" == "Darwin" ]]; then
    RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
    RAM_GB=$(( RAM_BYTES / 1024 / 1024 / 1024 ))
  else
    RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)
    RAM_GB=$(( RAM_KB / 1024 / 1024 ))
  fi

  # Floor(RAM_GB / 10), minimum 1
  CONCURRENT_LINKS=$(( RAM_GB / 10 ))
  [[ "$CONCURRENT_LINKS" -lt 1 ]] && CONCURRENT_LINKS=1
  [[ "$CONCURRENT_LINKS" -gt 8 ]] && CONCURRENT_LINKS=8

  # Compile jobs: RAM_GB / 2, capped at physical core count
  CPU_CORES=$(nproc 2>/dev/null || sysctl -n hw.physicalcpu 2>/dev/null || echo 4)
  COMPILE_JOBS=$(( RAM_GB / 2 ))
  [[ "$COMPILE_JOBS" -lt 4  ]] && COMPILE_JOBS=4
  [[ "$COMPILE_JOBS" -gt "$CPU_CORES" ]] && COMPILE_JOBS=$CPU_CORES

  if [[ "$RAM_GB" -gt 0 ]]; then
    ok "Detected ${RAM_GB} GB RAM → concurrent_links=$CONCURRENT_LINKS, compile_jobs=$COMPILE_JOBS"
  else
    warn "Could not detect RAM — using safe defaults (concurrent_links=1, jobs=$CPU_CORES)"
    CONCURRENT_LINKS=1
    COMPILE_JOBS=$CPU_CORES
  fi

  # Detect CPU architecture for GN target_cpu
  if [[ "$ARCH" == "arm64" ]]; then
    TARGET_CPU="arm64"
    info "Apple Silicon detected → target_cpu=arm64"
  else
    TARGET_CPU="x64"
    info "Intel x86_64 detected → target_cpu=x64"
  fi

  cat > "$OUT_DIR/args.gn" << GNEOF
# Guard Hero Browser — Release build args
# Generated by setup.sh on $(date +%Y-%m-%d). Edit and re-run 'gn gen out/Release' to apply.
# Host: $OS $ARCH | RAM: ${RAM_GB}GB

# ── Target architecture ───────────────────────────────────────────────────────
target_cpu = "$TARGET_CPU"

# ── Build type ────────────────────────────────────────────────────────────────
is_official_build = true
is_debug = false
symbol_level = 0            # no debug symbols — saves ~10 GB disk + link RAM
blink_symbol_level = 0      # no Blink debug symbols either
enable_nacl = false         # no PNaCl (saves build time and binary size)
enable_iterator_debugging = false
is_component_build = false  # monolithic binary, required for is_official_build

# ── Linker memory management ─────────────────────────────────────────────────
# Limit parallel link jobs to avoid OOM on machines with ≤ 32 GB RAM.
# The main chrome binary link alone can spike to 6–8 GB.
# concurrent_links=1 is the safe choice on 16 GB.
concurrent_links = $CONCURRENT_LINKS

# Use lld (LLVM linker) — faster and less memory-hungry than the system ld.
# On Intel Mac, lld is especially important: Apple's ld64 is much slower
# for a codebase of this size.
use_lld = true

# Disable ThinLTO — requires extra RAM during the final link step and
# significantly increases link time on Intel. Safe to enable on 32 GB+.
use_thin_lto = false

# ── Clang (depot_tools bundled, not Xcode's clang) ────────────────────────────
# FORCE_MAC_TOOLCHAIN=0 in the environment ensures we use depot_tools' clang.
# Do not set use_xcode_clang=true — Xcode's clang lacks the custom plugins
# Chromium needs and produces subtly different codegen.
is_clang = true
clang_use_chrome_plugins = false

# ── PGO — disabled ───────────────────────────────────────────────────────────
# PGO profile data requires a separate gclient runhooks download that isn't
# always available. Disable for development builds; enable for release binaries.
chrome_pgo_phase = 0

# ── Guard Hero features ──────────────────────────────────────────────────────
enable_guardhero = true
enable_eagleeye_native = true

# ── Google services — disabled ────────────────────────────────────────────────
# These are replaced by Guard Hero's privacy-hardened alternatives.
# safe_browsing_mode = 0 breaks unit_tests dep graph in Cr130 — disabled at runtime instead.
enable_reporting = false
disable_fieldtrial_testing_config = true
enable_background_mode = false
enable_google_now = false
enable_hangout_services_extension = false
enable_one_click_signin = false
enable_service_discovery = false
google_api_key = ""
google_default_client_id = ""
google_default_client_secret = ""
GNEOF

  info "Running: gn gen out/Release"
  cd "$SRC_DIR"
  gn gen out/Release 2>&1 | tail -5
  ok "GN configuration complete (out/Release/args.gn)"

  # ── Step 9: Build ───────────────────────────────────────────────────────────
  step "Building Guard Hero Browser (this takes 60–120 min)"

  info "RAM: ${RAM_GB}GB → link parallelism: $CONCURRENT_LINKS, compile jobs: $COMPILE_JOBS"
  info "Build output: $OUT_DIR"
  info "Tail progress in another terminal:"
  info "  tail -f $REPO_ROOT/.build.log"
  echo ""

  # -j $COMPILE_JOBS caps compile parallelism to avoid swapping.
  # The linker parallelism is already capped via concurrent_links in args.gn.
  autoninja -C out/Release chrome -j "$COMPILE_JOBS" \
    2>&1 | tee "$REPO_ROOT/.build.log" | \
    grep -E "^(\[|ninja: |FAILED|ERROR)" || true

  ok "Build complete"
  cd "$REPO_ROOT"

  # ── Done ─────────────────────────────────────────────────────────────────
  echo -e "\n${BOLD}${GREEN}"
  echo "  ═══════════════════════════════════════════════════"
  echo "   Guard Hero Browser build complete!"
  echo "  ═══════════════════════════════════════════════════"
  echo -e "${NC}"

  if [[ "$OS" == "Darwin" ]]; then
    echo "  Run the browser:"
    echo "    $SRC_DIR/out/Release/Chromium.app/Contents/MacOS/Chromium"
    echo ""
    echo "  Package as DMG:"
    echo "    ./build/macos/make_dmg.sh"
  else
    echo "  Run the browser:"
    echo "    $SRC_DIR/out/Release/chrome"
    echo ""
    echo "  Package as .deb:"
    echo "    ./build/linux/make_deb.sh"
  fi

  echo ""
  echo "  Run C++ unit tests (no full build needed):"
  echo "    ./tests/run_cpp_tests.sh"
  echo ""
  echo "  Run browser-ui dev server:"
  echo "    ./dev.sh"
  echo ""
else
  info "Skipping build (--sync-only or --patch-only)"
  echo -e "\n${GREEN}Setup complete.${NC}"
  echo "  When ready to build, run:"
  echo "    export PATH=\"$DEPOT_TOOLS_DIR:\$PATH\""
  echo "    cd $SRC_DIR"
  echo "    gn gen out/Release"
  echo "    autoninja -C out/Release chrome"
fi

# ── Run smoke tests ───────────────────────────────────────────────────────────
step "Running smoke tests"
python3 "$REPO_ROOT/tests/smoke_test.py" && ok "All smoke tests passed" || \
  warn "Some smoke tests failed — check output above"
