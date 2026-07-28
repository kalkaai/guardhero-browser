#!/usr/bin/env bash
# build/macos/make_dmg.sh — macOS DMG builder for Guard Hero Browser.
#
# Usage:
#   ./build/macos/make_dmg.sh [BUILD_DIR] [OUTPUT_DIR] [VERSION]
#
# Environment variables:
#   APPLE_DEVELOPER_ID   — If set, notarizes the DMG with xcrun notarytool
#   APPLE_TEAM_ID        — Required with APPLE_DEVELOPER_ID (Team ID, e.g. "ABCDE12345")
#   APPLE_KEYCHAIN_PROFILE — notarytool keychain profile name (default: "guardhero-notarize")
#
# Outputs:
#   GuardHeroBrowser.dmg in OUTPUT_DIR (default: dist/macos/)

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PRODUCT_NAME="Guard Hero Browser"
APP_BUNDLE_NAME="Guard Hero Browser.app"
DMG_NAME="GuardHeroBrowser.dmg"
CHROME_BINARY_NAME="Chromium"                    # name of binary in build output
GUARDHERO_BINARY_NAME="Guard Hero Browser"       # name inside .app bundle

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

BUILD_DIR="${1:-$REPO_ROOT/out/Release}"
OUTPUT_DIR="${2:-$REPO_ROOT/dist/macos}"
VERSION="${3:-1.0.0}"

STAGING_DIR="$REPO_ROOT/dist/macos/staging"
APP_BUNDLE="$STAGING_DIR/$APP_BUNDLE_NAME"
DMG_OUTPUT="$OUTPUT_DIR/$DMG_NAME"
INSTALLER_SCRIPT="$REPO_ROOT/installer/macos/create_dmg.sh"
ENTITLEMENTS="$REPO_ROOT/installer/macos/entitlements.plist"
KEYCHAIN_PROFILE="${APPLE_KEYCHAIN_PROFILE:-guardhero-notarize}"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
step()    { echo -e "\n${CYAN}==> $1${NC}"; }
ok()      { echo -e "    ${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "    ${YELLOW}[WARN]${NC} $1"; }
fail()    { echo -e "    ${RED}[FAIL]${NC} $1"; exit 1; }

require_cmd() { command -v "$1" &>/dev/null || fail "$1 not found on PATH"; }

# ── Step 1: Validate build output ────────────────────────────────────────────
step "Validating build output: $BUILD_DIR"

[[ -d "$BUILD_DIR" ]] || fail "Build dir not found: $BUILD_DIR\nRun: autoninja -C out/Release chrome"

CHROMIUM_APP="$BUILD_DIR/Chromium.app"
[[ -d "$CHROMIUM_APP" ]] || CHROMIUM_APP="$BUILD_DIR/chrome.app"
[[ -d "$CHROMIUM_APP" ]] || fail "No Chromium.app or chrome.app found in $BUILD_DIR"
ok "Found app bundle: $CHROMIUM_APP"

# ── Step 2: Create app bundle structure ──────────────────────────────────────
step "Creating app bundle: $APP_BUNDLE"

rm -rf "$STAGING_DIR"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"
mkdir -p "$APP_BUNDLE/Contents/Frameworks"

# Copy entire Chromium.app contents as base
cp -R "$CHROMIUM_APP/." "$APP_BUNDLE/"

# Rename the main binary
ORIGINAL_BIN=$(find "$APP_BUNDLE/Contents/MacOS" -maxdepth 1 -type f | head -1)
if [[ -n "$ORIGINAL_BIN" ]]; then
    mv "$ORIGINAL_BIN" "$APP_BUNDLE/Contents/MacOS/$GUARDHERO_BINARY_NAME"
    ok "Renamed binary to: $GUARDHERO_BINARY_NAME"
fi

# Write Info.plist overrides
cat > "$APP_BUNDLE/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
    "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>Guard Hero Browser</string>
    <key>CFBundleExecutable</key>
    <string>Guard Hero Browser</string>
    <key>CFBundleIdentifier</key>
    <string>app.guardhero.browser</string>
    <key>CFBundleName</key>
    <string>Guard Hero Browser</string>
    <key>CFBundleShortVersionString</key>
    <string>${VERSION}</string>
    <key>CFBundleVersion</key>
    <string>${VERSION}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>GHRB</string>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.browsers</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
</dict>
</plist>
PLIST
ok "Info.plist written"

# Write version file
echo "$VERSION" > "$APP_BUNDLE/Contents/Resources/VERSION"

# ── Step 3: Code-sign the app bundle ─────────────────────────────────────────
step "Code-signing app bundle"

if [[ -n "${APPLE_DEVELOPER_ID:-}" ]]; then
    require_cmd codesign
    [[ -f "$ENTITLEMENTS" ]] || fail "entitlements.plist not found: $ENTITLEMENTS"

    # Sign all nested binaries first (frameworks, helpers)
    find "$APP_BUNDLE/Contents/Frameworks" -type f \( -name "*.dylib" -o -perm +111 \) \
        -exec codesign --force --timestamp --options runtime \
            --entitlements "$ENTITLEMENTS" \
            --sign "Developer ID Application: $APPLE_DEVELOPER_ID" {} \;

    # Sign the main bundle
    codesign --force --timestamp --options runtime \
        --entitlements "$ENTITLEMENTS" \
        --sign "Developer ID Application: $APPLE_DEVELOPER_ID" \
        "$APP_BUNDLE"
    ok "App bundle signed with: $APPLE_DEVELOPER_ID"
else
    warn "APPLE_DEVELOPER_ID not set — signing with ad-hoc identity"
    codesign --force --deep --sign - "$APP_BUNDLE" 2>/dev/null || \
        warn "Ad-hoc signing failed (codesign may not be available)"
fi

# ── Step 4: Build DMG ─────────────────────────────────────────────────────────
step "Building DMG"

mkdir -p "$OUTPUT_DIR"

if [[ -f "$INSTALLER_SCRIPT" ]]; then
    bash "$INSTALLER_SCRIPT" "$STAGING_DIR" "$DMG_OUTPUT" "$VERSION"
    ok "DMG created via installer/macos/create_dmg.sh"
else
    warn "installer/macos/create_dmg.sh not found — using hdiutil directly"
    require_cmd hdiutil

    # Create a temporary writable DMG
    TEMP_DMG="$OUTPUT_DIR/temp_rw.dmg"
    hdiutil create -srcfolder "$STAGING_DIR" \
        -volname "$PRODUCT_NAME" \
        -fs HFS+ \
        -fsargs "-c c=64,a=16,b=16" \
        -format UDRW \
        -size 500m \
        "$TEMP_DMG"

    # Convert to compressed read-only DMG
    hdiutil convert "$TEMP_DMG" -format UDZO -imagekey zlib-level=9 -o "$DMG_OUTPUT"
    rm -f "$TEMP_DMG"
    ok "DMG created: $DMG_OUTPUT"
fi

# ── Step 5: Notarize (optional) ───────────────────────────────────────────────
step "Notarization"

if [[ -n "${APPLE_DEVELOPER_ID:-}" ]]; then
    require_cmd xcrun
    [[ -n "${APPLE_TEAM_ID:-}" ]] || fail "APPLE_TEAM_ID is required for notarization"

    echo "    Submitting for notarization (this may take several minutes)..."
    xcrun notarytool submit "$DMG_OUTPUT" \
        --keychain-profile "$KEYCHAIN_PROFILE" \
        --team-id "$APPLE_TEAM_ID" \
        --wait

    echo "    Stapling notarization ticket..."
    xcrun stapler staple "$DMG_OUTPUT"
    ok "Notarization complete and stapled"
else
    warn "APPLE_DEVELOPER_ID not set — skipping notarization"
    warn "To notarize: set APPLE_DEVELOPER_ID, APPLE_TEAM_ID, and re-run"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN} Guard Hero Browser DMG ready!${NC}"
echo -e "${GREEN} Output: $DMG_OUTPUT${NC}"
echo -e "${GREEN}=====================================================${NC}"
