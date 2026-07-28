#!/usr/bin/env bash
# build/linux/make_deb.sh — Debian package builder for Guard Hero Browser.
#
# Usage:
#   ./build/linux/make_deb.sh [BUILD_DIR] [OUTPUT_DIR] [VERSION] [ARCH]
#
# Outputs:
#   guardhero-browser_<version>_<arch>.deb  in OUTPUT_DIR (default: dist/linux/)
#
# Prerequisites: dpkg-deb, fakeroot

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PACKAGE_NAME="guardhero-browser"
DISPLAY_NAME="Guard Hero Browser"
BINARY_NAME="guardhero-browser"
DESCRIPTION="A privacy-first browser that fights back."
LONG_DESCRIPTION="Guard Hero Browser is a privacy-focused Chromium fork featuring
 the EagleEye native blocking engine, canvas fingerprint noise injection,
 WebRTC IP leak protection, and a clean React-based new tab and settings UI."
MAINTAINER="Guard Hero Team <builds@guardhero.app>"
HOMEPAGE="https://guardhero.app"
SECTION="web"
PRIORITY="optional"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

BUILD_DIR="${1:-$REPO_ROOT/out/Release}"
OUTPUT_DIR="${2:-$REPO_ROOT/dist/linux}"
VERSION="${3:-1.0.0}"
ARCH="${4:-amd64}"

DEB_FILENAME="${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"
PKG_DIR="$REPO_ROOT/dist/linux/pkg_build/${PACKAGE_NAME}_${VERSION}_${ARCH}"

# Install paths inside the package
INSTALL_DIR="/opt/guardhero/browser"
BIN_DIR="/usr/bin"
DESKTOP_DIR="/usr/share/applications"
ICON_DIR="/usr/share/icons/hicolor"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
step()    { echo -e "\n${CYAN}==> $1${NC}"; }
ok()      { echo -e "    ${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "    ${YELLOW}[WARN]${NC} $1"; }
fail()    { echo -e "    ${RED}[FAIL]${NC} $1"; exit 1; }
require_cmd() { command -v "$1" &>/dev/null || fail "$1 not found. Install with: apt-get install $1"; }

# ── Step 1: Validate ──────────────────────────────────────────────────────────
step "Validating prerequisites and build output"

require_cmd dpkg-deb
# fakeroot is optional but recommended for proper ownership
HAS_FAKEROOT=0
command -v fakeroot &>/dev/null && HAS_FAKEROOT=1

[[ -d "$BUILD_DIR" ]] || fail "Build dir not found: $BUILD_DIR\nRun: autoninja -C out/Release chrome"

CHROME_BIN="$BUILD_DIR/chrome"
[[ -f "$CHROME_BIN" ]] || fail "chrome binary not found in $BUILD_DIR"
ok "Build output validated"

# ── Step 2: Create package directory structure ────────────────────────────────
step "Creating Debian package directory structure"

rm -rf "$PKG_DIR"

mkdir -p "$PKG_DIR/DEBIAN"
mkdir -p "$PKG_DIR$INSTALL_DIR"
mkdir -p "$PKG_DIR$BIN_DIR"
mkdir -p "$PKG_DIR$DESKTOP_DIR"
mkdir -p "$PKG_DIR${ICON_DIR}/256x256/apps"
mkdir -p "$PKG_DIR/etc/guardhero"

ok "Directory structure created: $PKG_DIR"

# ── Step 3: Copy binaries ─────────────────────────────────────────────────────
step "Copying binaries and resources"

# List of files to copy from build output
FILES_TO_COPY=(
    "chrome"
    "chrome_100_percent.pak"
    "chrome_200_percent.pak"
    "resources.pak"
    "icudtl.dat"
    "v8_context_snapshot.bin"
    "snapshot_blob.bin"
    "chrome_crashpad_handler"
)

for f in "${FILES_TO_COPY[@]}"; do
    src="$BUILD_DIR/$f"
    if [[ -f "$src" ]]; then
        cp "$src" "$PKG_DIR$INSTALL_DIR/"
        ok "Copied: $f"
    else
        warn "Optional file not found, skipping: $f"
    fi
done

# Rename chrome → guardhero-browser
if [[ -f "$PKG_DIR$INSTALL_DIR/chrome" ]]; then
    mv "$PKG_DIR$INSTALL_DIR/chrome" "$PKG_DIR$INSTALL_DIR/$BINARY_NAME"
    chmod 0755 "$PKG_DIR$INSTALL_DIR/$BINARY_NAME"
fi

# Copy locales
if [[ -d "$BUILD_DIR/locales" ]]; then
    cp -R "$BUILD_DIR/locales" "$PKG_DIR$INSTALL_DIR/"
    ok "Copied: locales/"
fi

# Copy SwiftShader
if [[ -d "$BUILD_DIR/swiftshader" ]]; then
    cp -R "$BUILD_DIR/swiftshader" "$PKG_DIR$INSTALL_DIR/"
    ok "Copied: swiftshader/"
fi

# ── Step 4: Write wrapper script ──────────────────────────────────────────────
step "Writing /usr/bin launcher wrapper"

cat > "$PKG_DIR$BIN_DIR/$BINARY_NAME" <<'WRAPPER'
#!/usr/bin/env bash
# Guard Hero Browser launcher wrapper
GUARDHERO_DIR="/opt/guardhero/browser"
exec "$GUARDHERO_DIR/guardhero-browser" "$@"
WRAPPER

chmod 0755 "$PKG_DIR$BIN_DIR/$BINARY_NAME"
ok "Launcher wrapper written"

# ── Step 5: Write .desktop file ───────────────────────────────────────────────
step "Writing .desktop file"

cat > "$PKG_DIR$DESKTOP_DIR/guardhero-browser.desktop" <<DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=Guard Hero Browser
GenericName=Web Browser
Comment=A privacy-first browser that fights back.
Exec=/usr/bin/guardhero-browser %U
Icon=guardhero-browser
Terminal=false
Categories=Network;WebBrowser;
MimeType=text/html;text/xml;application/xhtml+xml;application/xml;application/rss+xml;application/rdf+xml;x-scheme-handler/http;x-scheme-handler/https;
StartupWMClass=guardhero-browser
StartupNotify=true
DESKTOP

ok ".desktop file written"

# ── Step 6: Write DEBIAN/control ─────────────────────────────────────────────
step "Writing DEBIAN/control"

# Calculate installed size
INSTALLED_KB=$(du -sk "$PKG_DIR" | cut -f1)

cat > "$PKG_DIR/DEBIAN/control" <<CONTROL
Package: ${PACKAGE_NAME}
Version: ${VERSION}
Architecture: ${ARCH}
Maintainer: ${MAINTAINER}
Installed-Size: ${INSTALLED_KB}
Depends: libc6 (>= 2.17), libgcc-s1 (>= 3.0), libstdc++6 (>= 5.2), libdbus-1-3,
 libgtk-3-0 (>= 3.9.10), libx11-6, libxcomposite1 (>= 1:0.3-1),
 libxdamage1 (>= 1:1.1), libxext6, libxfixes3, libxrandr2, libxrender1,
 libxtst6, fonts-liberation, xdg-utils
Recommends: libvulkan1
Section: ${SECTION}
Priority: ${PRIORITY}
Homepage: ${HOMEPAGE}
Description: ${DESCRIPTION}
${LONG_DESCRIPTION}
CONTROL

ok "DEBIAN/control written"

# ── Step 7: Write DEBIAN/postinst ────────────────────────────────────────────
cat > "$PKG_DIR/DEBIAN/postinst" <<'POSTINST'
#!/bin/bash
set -e

# Register as a default browser alternative
if command -v update-alternatives &>/dev/null; then
    update-alternatives --install /usr/bin/x-www-browser x-www-browser \
        /usr/bin/guardhero-browser 200
    update-alternatives --install /usr/bin/gnome-www-browser gnome-www-browser \
        /usr/bin/guardhero-browser 200
fi

# Update desktop database
if command -v update-desktop-database &>/dev/null; then
    update-desktop-database -q /usr/share/applications
fi

# Update icon cache
if command -v gtk-update-icon-cache &>/dev/null; then
    gtk-update-icon-cache -qf /usr/share/icons/hicolor 2>/dev/null || true
fi

exit 0
POSTINST

# ── Step 8: Write DEBIAN/prerm ────────────────────────────────────────────────
cat > "$PKG_DIR/DEBIAN/prerm" <<'PRERM'
#!/bin/bash
set -e

if command -v update-alternatives &>/dev/null; then
    update-alternatives --remove x-www-browser /usr/bin/guardhero-browser 2>/dev/null || true
    update-alternatives --remove gnome-www-browser /usr/bin/guardhero-browser 2>/dev/null || true
fi

exit 0
PRERM

chmod 0755 "$PKG_DIR/DEBIAN/postinst" "$PKG_DIR/DEBIAN/prerm"
ok "Maintainer scripts written"

# ── Step 9: Build the .deb ────────────────────────────────────────────────────
step "Building .deb package"

mkdir -p "$OUTPUT_DIR"

DEB_OUTPUT="$OUTPUT_DIR/$DEB_FILENAME"

if [[ "$HAS_FAKEROOT" -eq 1 ]]; then
    fakeroot dpkg-deb --build "$PKG_DIR" "$DEB_OUTPUT"
else
    warn "fakeroot not found — ownership may not be correct in package"
    dpkg-deb --build "$PKG_DIR" "$DEB_OUTPUT"
fi

ok "Package built: $DEB_OUTPUT"

# ── Step 10: Verify ───────────────────────────────────────────────────────────
step "Verifying package"

if command -v dpkg-deb &>/dev/null; then
    echo "    Package info:"
    dpkg-deb --info "$DEB_OUTPUT" | sed 's/^/    /'
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN} Guard Hero Browser .deb ready!${NC}"
echo -e "${GREEN} Output: $DEB_OUTPUT${NC}"
echo -e "${GREEN} Install: sudo dpkg -i $DEB_FILENAME${NC}"
echo -e "${GREEN}=====================================================${NC}"
