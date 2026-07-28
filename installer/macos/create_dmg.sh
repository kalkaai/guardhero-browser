#!/usr/bin/env bash
# create_dmg.sh — Build a signed .dmg for Guard Hero Browser (macOS)
#
# Prerequisites:
#   - brew install create-dmg    (or npm install -g create-dmg)
#   - Xcode command-line tools
#   - Valid Apple Developer certificate in keychain
#   - Built Guard Hero Browser.app in out/Release/
#
# Usage:
#   bash installer/macos/create_dmg.sh [--sign] [--notarize]
#   APPLE_ID=you@example.com APPLE_TEAM_ID=ABCDEF1234 APPLE_APP_PASSWORD=xxx \
#     bash installer/macos/create_dmg.sh --sign --notarize

set -euo pipefail

#─────────────────────────────────────────────────────────────────────────────
# Configuration
#─────────────────────────────────────────────────────────────────────────────
PRODUCT_NAME="Guard Hero Browser"
APP_NAME="Guard Hero Browser.app"
DMG_NAME="GuardHeroBrowser"
VERSION="1.0.0"
BUNDLE_ID="app.guardhero.browser"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_DIR="${REPO_ROOT}/out/Release"
INSTALLER_DIR="${REPO_ROOT}/installer/macos"
STAGING_DIR="${INSTALLER_DIR}/staging"
OUTPUT_DMG="${INSTALLER_DIR}/${DMG_NAME}.dmg"

# Signing identity (override via env var or argument)
SIGN_IDENTITY="${SIGN_IDENTITY:-Developer ID Application: Guard Hero (${APPLE_TEAM_ID:-UNSET})}"

# Flags
DO_SIGN=false
DO_NOTARIZE=false

#─────────────────────────────────────────────────────────────────────────────
# Argument parsing
#─────────────────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --sign)     DO_SIGN=true ;;
    --notarize) DO_NOTARIZE=true; DO_SIGN=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

#─────────────────────────────────────────────────────────────────────────────
# Helper functions
#─────────────────────────────────────────────────────────────────────────────
log()  { echo "  ▶  $*"; }
ok()   { echo "  ✓  $*"; }
fail() { echo "  ✗  $*" >&2; exit 1; }

check_prereqs() {
  log "Checking prerequisites..."
  command -v create-dmg >/dev/null 2>&1 || \
    fail "'create-dmg' not found. Install with: brew install create-dmg"
  command -v codesign >/dev/null 2>&1 || \
    fail "Xcode command-line tools not found."
  [[ -d "${BUILD_DIR}/${APP_NAME}" ]] || \
    fail "App not found at ${BUILD_DIR}/${APP_NAME}. Build the browser first."
  ok "Prerequisites OK"
}

sign_app() {
  log "Code-signing ${APP_NAME}..."
  # Sign all nested executables, dylibs, and frameworks first (deep signing)
  find "${STAGING_DIR}/${APP_NAME}/Contents" \
    \( -name "*.dylib" -o -name "*.framework" -o -name "*.so" \) \
    -exec codesign --force --sign "${SIGN_IDENTITY}" \
                   --options runtime \
                   --timestamp \
                   --entitlements "${INSTALLER_DIR}/entitlements.plist" \
                   {} \;

  # Sign the main executable and bundle
  codesign --force \
           --sign "${SIGN_IDENTITY}" \
           --options runtime \
           --timestamp \
           --entitlements "${INSTALLER_DIR}/entitlements.plist" \
           --deep \
           "${STAGING_DIR}/${APP_NAME}"

  # Verify
  codesign --verify --deep --strict "${STAGING_DIR}/${APP_NAME}" || \
    fail "Code signature verification failed"
  ok "App signed successfully"
}

create_dmg() {
  log "Creating DMG..."

  # Remove old staging
  rm -rf "${STAGING_DIR}"
  mkdir -p "${STAGING_DIR}"

  # Copy app to staging
  cp -R "${BUILD_DIR}/${APP_NAME}" "${STAGING_DIR}/"

  # Sign if requested
  if $DO_SIGN; then
    sign_app
  fi

  # Remove old DMG
  rm -f "${OUTPUT_DMG}"

  # Create DMG with create-dmg
  create-dmg \
    --volname "${PRODUCT_NAME}" \
    --volicon "${INSTALLER_DIR}/dmg_icon.icns" \
    --background "${INSTALLER_DIR}/dmg_background.png" \
    --window-pos 200 120 \
    --window-size 660 400 \
    --icon-size 100 \
    --icon "${APP_NAME}" 165 185 \
    --hide-extension "${APP_NAME}" \
    --app-drop-link 495 185 \
    --no-internet-enable \
    "${OUTPUT_DMG}" \
    "${STAGING_DIR}/"

  ok "DMG created: ${OUTPUT_DMG}"
}

sign_dmg() {
  log "Signing DMG..."
  codesign --force \
           --sign "${SIGN_IDENTITY}" \
           --timestamp \
           "${OUTPUT_DMG}"
  codesign --verify "${OUTPUT_DMG}" || fail "DMG signature verification failed"
  ok "DMG signed"
}

notarize_dmg() {
  log "Submitting DMG for notarization..."
  [[ -n "${APPLE_ID:-}" ]]           || fail "APPLE_ID env var not set"
  [[ -n "${APPLE_TEAM_ID:-}" ]]      || fail "APPLE_TEAM_ID env var not set"
  [[ -n "${APPLE_APP_PASSWORD:-}" ]] || fail "APPLE_APP_PASSWORD env var not set"

  # Submit for notarization
  xcrun notarytool submit \
    "${OUTPUT_DMG}" \
    --apple-id "${APPLE_ID}" \
    --team-id "${APPLE_TEAM_ID}" \
    --password "${APPLE_APP_PASSWORD}" \
    --wait \
    --output-format json | tee /tmp/notarize_result.json

  # Check result
  STATUS=$(python3 -c "import json,sys; print(json.load(open('/tmp/notarize_result.json'))['status'])")
  if [[ "${STATUS}" != "Accepted" ]]; then
    fail "Notarization failed with status: ${STATUS}"
  fi

  # Staple the notarization ticket to the DMG
  log "Stapling notarization ticket..."
  xcrun stapler staple "${OUTPUT_DMG}"
  ok "Notarization complete and ticket stapled"
}

#─────────────────────────────────────────────────────────────────────────────
# Main
#─────────────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo "  Guard Hero Browser — macOS DMG Builder"
echo "  Version: ${VERSION}"
echo "════════════════════════════════════════"
echo ""

check_prereqs
create_dmg

if $DO_SIGN; then
  sign_dmg
fi

if $DO_NOTARIZE; then
  notarize_dmg
fi

# Print final DMG info
DMG_SIZE=$(du -sh "${OUTPUT_DMG}" 2>/dev/null | cut -f1 || echo "unknown")
echo ""
echo "════════════════════════════════════════"
echo "  Build complete!"
echo "  Output: ${OUTPUT_DMG}"
echo "  Size:   ${DMG_SIZE}"
if $DO_SIGN;     then echo "  Signed: ✓"; fi
if $DO_NOTARIZE; then echo "  Notarized: ✓"; fi
echo "════════════════════════════════════════"
echo ""
