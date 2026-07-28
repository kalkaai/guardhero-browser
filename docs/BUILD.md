# Guard Hero Browser — Build Guide

This document covers building Guard Hero Browser from source on Windows, macOS, and Linux.

---

## Prerequisites

### All Platforms

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.9+ | Used by build scripts and depot_tools |
| Git | 2.28+ | For patch management |
| Node.js | 18+ | For browser-ui asset build |
| depot_tools | latest | Chromium's build toolchain |
| Disk space | 150 GB | Chromium source is large |
| RAM | 32 GB min | 64 GB recommended |

### Windows

| Requirement | Version |
|---|---|
| Windows | 10 or 11 (64-bit) |
| Visual Studio | 2022 with "Desktop development with C++" workload |
| Windows SDK | 10.0.20348.0 or newer |
| MSVC | v143 toolset |

### macOS

| Requirement | Version |
|---|---|
| macOS | 13 (Ventura) or newer |
| Xcode | 14.3 or newer |
| Command-line tools | `xcode-select --install` |

### Linux (Ubuntu 22.04 LTS recommended)

```bash
sudo apt-get install -y \
  build-essential clang-16 lld-16 libc++-16-dev libc++abi-16-dev \
  libglib2.0-dev libgtk-3-dev libnotify-dev libnss3-dev libxss1 \
  libxtst-dev libxrandr-dev libpango1.0-dev libatk1.0-dev \
  libcups2-dev libdrm-dev libxkbcommon-dev \
  python3 python3-pip git curl wget
```

---

## Step 1: Install depot_tools

```bash
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git ~/depot_tools
echo 'export PATH="$HOME/depot_tools:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Windows (PowerShell):
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git C:\depot_tools
# Add C:\depot_tools to your system PATH
```

## Step 2: Clone the repository

```bash
mkdir guardhero-browser && cd guardhero-browser
git clone https://github.com/guardhero/guardhero-browser.git .
```

## Step 3: Sync Chromium source

This step downloads ~20 GB of Chromium source code. It is slow on first run.

```bash
gclient sync --with_branch_heads --with_tags --jobs=16
```

The `DEPS` file pins the exact Chromium revision used by Guard Hero.

## Step 4: Apply ungoogled-chromium patches

```bash
# From the src/ directory (after gclient sync)
python3 src/utils/patches.py apply
```

## Step 5: Apply Guard Hero patches

```bash
python3 build/apply_gh_patches.py
```

To check for conflicts without applying:
```bash
python3 build/apply_gh_patches.py --dry-run
```

## Step 6: Build browser-ui assets

```bash
cd browser-ui
npm install
npm run build
cd ..
```

This produces the React bundles (NTP, popup, settings) in `resources/guardhero/webui/`.

## Step 7: Configure the GN build

```bash
# Linux / macOS
gn gen out/Release --args='
  is_official_build=true
  is_debug=false
  target_cpu="x64"
  enable_guardhero=true
  enable_eagleeye_native=true
  proprietary_codecs=true
  ffmpeg_branding="Chrome"
'

# Windows (PowerShell)
gn gen out\Release --args="is_official_build=true is_debug=false target_cpu=`"x64`" enable_guardhero=true enable_eagleeye_native=true proprietary_codecs=true ffmpeg_branding=`"Chrome`""
```

### Optional GN args

| Arg | Default | Description |
|---|---|---|
| `is_debug` | false | Enable debug build (much slower) |
| `enable_guardhero` | true | Toggle all Guard Hero features |
| `enable_eagleeye_native` | true | Toggle EagleEye blocking engine |
| `symbol_level` | 0 | Debug symbol level (0=none, 1=minimal, 2=full) |
| `is_component_build` | false | Component build for faster incremental builds |

For faster **development builds** (not for release):
```bash
gn gen out/Debug --args='
  is_debug=true
  is_component_build=true
  symbol_level=1
  enable_guardhero=true
  enable_eagleeye_native=true
'
```

## Step 8: Build

```bash
# Build the browser
autoninja -C out/Release chrome

# Build just the EagleEye targets
autoninja -C out/Release guardhero

# Run unit tests
autoninja -C out/Release unit_tests
./out/Release/unit_tests --gtest_filter=GuardHero*
```

Build time on 32-core machine: approximately 90 minutes.
Build time on 8-core machine: approximately 4–6 hours.

---

## Step 9: Package

### Windows

```powershell
# Build the NSIS installer
cd installer\windows
makensis guardhero.nsi
# Output: GuardHeroBrowser-Setup-x64.exe
```

### macOS

```bash
# Build the DMG (unsigned)
bash installer/macos/create_dmg.sh

# Build, sign, and notarize
APPLE_ID=you@example.com \
APPLE_TEAM_ID=ABCDEF1234 \
APPLE_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
bash installer/macos/create_dmg.sh --sign --notarize
```

### Linux

```bash
# DEB package (Ubuntu/Debian)
bash build/linux/make_deb.sh

# RPM package (Fedora/RHEL)
bash build/linux/make_rpm.sh
```

---

## Troubleshooting

### `gclient sync` hangs or fails
- Ensure you have a reliable network connection.
- Try again with `--force` flag.
- If behind a proxy: `export HTTPS_PROXY=http://proxy:8080`

### Patch conflicts
After running `apply_gh_patches.py`, if patches fail:
```bash
# See what conflicted
python3 build/apply_gh_patches.py --dry-run

# Navigate to src/ and resolve manually
cd src
git apply ../patches/core/001-branding-product-name.patch --reject
# Edit the .rej file, apply changes, then:
git add <conflicted-file>
# Re-run the patch script:
cd ..
python3 build/apply_gh_patches.py
```

### Out of disk space
The full build tree is ~100–150 GB. Use a build configuration without debug symbols (`symbol_level=0`) to reduce size.

### Windows build: "cl.exe not found"
Run the build from the **"x64 Native Tools Command Prompt for VS 2022"** or set:
```batch
set DEPOT_TOOLS_WIN_TOOLCHAIN=0
call "C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvars64.bat"
```

---

## CI/CD

Guard Hero uses GitHub Actions for automated builds. See `.github/workflows/build.yml`.

Self-hosted runners are required for the actual Chromium build (GitHub-hosted runners have insufficient disk/RAM). The `rebase-check` job runs on GitHub-hosted `ubuntu-latest`.

Required GitHub secrets:
- `APPLE_ID` — Apple Developer account email
- `APPLE_TEAM_ID` — 10-character team identifier
- `APPLE_APP_PASSWORD` — App-specific password for notarization
- `SLACK_WEBHOOK_URL` — For rebase alerts
- `GH_BLOCKLIST_TOKEN` — GitHub token for blocklist update commits
