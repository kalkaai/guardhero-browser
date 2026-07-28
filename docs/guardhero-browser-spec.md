# Guard Hero Browser — Complete Build Specification

> Feed this document to Claude to scaffold, implement, and iterate on the Guard Hero Browser — a privacy-first Chromium-based browser built on top of Ungoogled Chromium with native EagleEye integration.

---

## 1. Project Overview

### Identity
- **Product name**: Guard Hero Browser
- **Tagline**: "The browser that fights back."
- **Core promise**: A Chromium-based browser with privacy protection baked in at the native level — no extensions needed, no opt-ins, no compromises.
- **Brand parent**: Guard Hero (guardhero.app) — an AI-powered privacy ecosystem that also includes EagleEye (browser extension) and OPi-one (network appliance).

### Strategic Goals
1. Eliminate the extension install friction of EagleEye by making blocking native.
2. Provide a browser that works out-of-the-box with zero configuration for non-technical users.
3. Deepen integration with the Guard Hero ecosystem (OPi-one dashboard sync, cross-device stats).
4. Compete with Brave on privacy, but differentiate with AI-powered adaptive blocking (not just static lists).
5. Own the **developer** audience as the primary early adopter segment — ship best-in-class devtools enhancements.
6. Win **gamers** on performance and ad-free streaming — position as the lightweight browser that doesn't eat RAM while you play.

### Target Audiences
| Audience | Core Hook | Key Features |
|---|---|---|
| **Developers** | Power user who understands trackers; wants insight + tooling | Request Inspector, API Tester, local HTTPS proxy, JS scratchpad |
| **Gamers** | Hates ads on Twitch/YouTube; wants browser that doesn't tank FPS | Performance mode, ad-free video, Picture-in-Picture+, download throttling |
| **Privacy-conscious general users** | Wants protection without configuration | EagleEye native, hardened defaults, zero setup |

### Positioning Statement
> "Guard Hero Browser — Built for people who know how the web actually works."
> Developers and gamers share one trait: they're power users who refuse to be treated like a product. Guard Hero is built for them.

### Non-Goals (v1.0)
- Crypto wallet / BAT-style reward system (not aligned with Guard Hero's brand)
- Mobile browser (defer to v2)
- Building from scratch (Chromium fork only)
- VPN integration (dilutes privacy focus, adds legal complexity)
- Game launcher integration (too far outside browser scope)
- Screen recording / capture (platform-level bloat)

---

## 2. Base: Ungoogled Chromium Fork

### Why Ungoogled Chromium
Start from `github.com/ungoogled-software/ungoogled-chromium` rather than raw Chromium. It already:
- Removes Google account sign-in integration
- Strips Safe Browsing (sends URLs to Google)
- Disables Finch (Google's remote experiment system)
- Removes most call-home telemetry
- Disables WebRTC IP leakage by default

Guard Hero's patches apply **on top of** ungoogled-chromium's patch set.

### Repository Structure
```
guardhero-browser/
├── patches/                  # Guard Hero-specific patches on top of ungoogled-chromium
│   ├── core/                 # Branding, NTP, settings page
│   ├── eagleeye/             # Native blocking engine integration
│   ├── privacy/              # Additional privacy hardening beyond ungoogled
│   └── ui/                   # Toolbar button, omnibox tweaks
├── src/                      # Chromium source (git submodule or fetched via gclient)
├── eagleeye-native/          # C++ blocking engine (ported from EagleEye extension)
│   ├── blocker/              # Core domain/URL matching logic
│   ├── ai-engine/            # ML model for detecting new trackers
│   ├── lists/                # Bundled blocklists (93,000+ domains)
│   └── bridge/               # JS↔Native bridge for dashboard communication
├── browser-ui/               # New Tab Page and Settings UI (React/TypeScript)
│   ├── newtab/
│   ├── settings/
│   └── popup/                # Toolbar popup (shields status)
├── updater/                  # Omaha-based auto-update server config
├── installer/                # NSIS (Windows) + DMG/pkg (macOS) build scripts
├── build/                    # Build scripts per platform
│   ├── windows/
│   ├── macos/
│   └── linux/
├── .github/
│   └── workflows/            # CI/CD — build, test, rebase checks
└── docs/
    ├── BUILD.md
    ├── REBASING.md
    └── ARCHITECTURE.md
```

---

## 3. Privacy Hardening (Beyond Ungoogled)

Apply these additional patches on top of ungoogled-chromium:

### Network & Telemetry
| Setting | Change |
|---|---|
| Safe Browsing | Disabled and UI removed |
| Crash reporting | Disabled, no opt-in UI |
| UMA / metrics | Stripped at compile time |
| Translation service | Disabled (sends text to Google) |
| Spell check (network) | Force local-only |
| DNS over HTTPS | Default to Cloudflare 1.1.1.1 (user-changeable) |
| OCSP / CRL | Use CRLSets only, no live OCSP requests |
| Font enumeration | Blocked (fingerprinting vector) |
| Canvas fingerprinting | Add subtle noise (same approach as Brave) |
| WebRTC | Force disable non-proxied UDP |
| Battery API | Blocked |
| Network Information API | Blocked |

### Default Settings (set at compile time, user can override)
```json
{
  "privacy": {
    "block_third_party_cookies": true,
    "send_do_not_track": true,
    "hyperlink_auditing_enabled": false,
    "allow_cross_origin_auth_prompt": false
  },
  "search_engine": "DuckDuckGo",
  "homepage": "guardhero://newtab",
  "sync_disabled": true,
  "google_login_for_extensions": false
}
```

---

## 4. EagleEye Native Blocking Engine

This is Guard Hero Browser's primary differentiator. The EagleEye engine is ported from the JavaScript extension into a native C++ component embedded in the browser.

### Architecture

```
Request lifecycle:
  Browser network stack
       │
       ▼
  [EagleEye Native Layer]  ← runs before request leaves the browser
       │
       ├─ Static blocklist check (hash lookup, <1ms)
       ├─ AI pattern analysis (for unknown domains)
       ├─ CNAME uncloaking check
       └─ Decision: BLOCK / ALLOW / MODIFY (strip tracking params)
       │
       ▼
  Network (if allowed)
```

### Component: `eagleeye-native/blocker/`

**Files to implement:**
- `domain_matcher.h / .cc` — Bloom filter + hash map for 93,000+ domain lookups. Sub-millisecond lookup time.
- `url_analyzer.h / .cc` — Strips tracking query parameters (utm_*, fbclid, gclid, etc.)
- `cname_resolver.h / .cc` — Detects CNAME-cloaked trackers (e.g., metrics.yoursite.com → doubleclick.net)
- `blocklist_manager.h / .cc` — Loads, parses, and hot-reloads blocklists from disk
- `request_interceptor.h / .cc` — Hooks into Chromium's `URLRequestInterceptor` interface

**Chromium integration point:**
```cpp
// In chrome/browser/guardhero/eagleeye_interceptor.cc
class EagleEyeInterceptor : public net::URLRequestInterceptor {
 public:
  net::URLRequestJob* MaybeInterceptRequest(
      net::URLRequest* request,
      net::NetworkDelegate* network_delegate) const override;
};
```
Register in `chrome/browser/io_thread.cc` during network service initialization.

### Component: `eagleeye-native/ai-engine/`

The AI engine identifies new trackers not yet on static lists.

**Files to implement:**
- `model_loader.h / .cc` — Loads a quantized TFLite model bundled with the browser
- `feature_extractor.h / .cc` — Extracts features from URLs/domains: TLD, subdomain depth, entropy, path patterns, request context
- `inference_engine.h / .cc` — Runs model inference, returns confidence score (0.0–1.0)
- `feedback_loop.h / .cc` — Accumulates local false-positive reports to improve local model over time (no data leaves device)

**Model spec:**
- Format: TensorFlow Lite (`.tflite`), quantized INT8
- Size target: < 5MB bundled
- Input: 32-dimensional feature vector per URL
- Output: Single float, tracker probability
- Threshold for blocking: > 0.85 confidence
- Training: Done offline by Guard Hero team; model updates ship with browser updates

### Component: `eagleeye-native/bridge/`

Exposes blocking stats and controls to the browser UI via a custom Chrome DevTools Protocol extension and `chrome.guardhero.*` JS API.

```javascript
// Available to New Tab Page and Settings page
chrome.guardhero.getSessionStats()     // → { blocked: 42, domains: [...] }
chrome.guardhero.getAllTimeStats()     // → { totalBlocked: 18420, ... }
chrome.guardhero.getPageStats(tabId)  // → { blocked: 12, trackers: [...] }
chrome.guardhero.setBlockingEnabled(bool)
chrome.guardhero.allowDomain(domain)  // Add to user allowlist
chrome.guardhero.blockDomain(domain)  // Add to user blocklist
```

---

## 5. Browser UI

### 5.1 New Tab Page (`browser-ui/newtab/`)

**Tech stack**: React 18 + TypeScript + Vite (bundled into the browser at build time)

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  [Guard Hero shield logo]   [date / time]               │
│                                                         │
│         ┌──────────────────────────────────┐           │
│         │  🔍  Search or enter address      │           │
│         └──────────────────────────────────┘           │
│                                                         │
│   ┌─────────────────────────────────────────────┐      │
│   │  SESSION         ALL TIME       THIS MONTH  │      │
│   │  42 blocked      18,420         3,210        │      │
│   └─────────────────────────────────────────────┘      │
│                                                         │
│   Top Sites (favicon grid, up to 8)                     │
│                                                         │
│   [Quick access: EagleEye | OPi-one | Settings]         │
└─────────────────────────────────────────────────────────┘
```

**Components to build:**
- `<SearchBar />` — styled omnibox that submits to browser's address bar
- `<StatsPanel />` — pulls from `chrome.guardhero.getSessionStats()` + all-time, animates numbers
- `<TopSites />` — uses `chrome.topSites.get()` API
- `<QuickLinks />` — fixed links to Guard Hero products and settings
- `<Clock />` — live date/time display

**Design direction:**
- Dark theme by default (matches Guard Hero brand)
- Shield iconography
- Colors: `#0A0E1A` (background), `#00D4FF` (accent), `#FF4B6E` (blocked indicator), `#FFFFFF` (text)
- Font: Use a clean, modern sans-serif (e.g., `DM Sans` or `Outfit`) loaded locally — never from Google Fonts CDN

### 5.2 Toolbar Popup (`browser-ui/popup/`)

Appears when user clicks the Guard Hero shield icon in the browser toolbar.

**Layout:**
```
┌───────────────────────────────┐
│  🛡 Guard Hero  [toggle ON/OFF]│
├───────────────────────────────┤
│  This page: 12 trackers blocked│
│  ──────────────────────────── │
│  analytics.google.com  BLOCKED │
│  facebook.net/tr       BLOCKED │
│  doubleclick.net       BLOCKED │
│  ...                          │
├───────────────────────────────┤
│  [Allow this site]  [Report]  │
└───────────────────────────────┘
```

**Components:**
- `<ShieldToggle />` — enables/disables blocking for current site
- `<TrackerList />` — scrollable list of blocked requests on current page
- `<AllowSiteButton />` — adds current domain to allowlist
- `<ReportButton />` — opens feedback form (false positive reporting)

### 5.3 Settings Page (`browser-ui/settings/`)

Accessible via `guardhero://settings` (custom chrome URL scheme).

**Sections:**
1. **Privacy** — blocking level (Standard / Aggressive / Custom), cookie settings, fingerprinting protection
2. **EagleEye** — blocklist management, AI engine toggle, allowlist/blocklist editor
3. **Search** — default search engine selector (DuckDuckGo, Brave Search, Startpage, custom)
4. **Appearance** — theme (dark/light/system), NTP customization
5. **OPi-one Sync** — connect to local OPi-one device for network-level coordination
6. **About** — version, update status, changelog

---

## 6. Branding & Chrome Customization

### Name & Scheme Registration
In `chrome/app/guardhero_strings.grd`:
```xml
<message name="IDS_PRODUCT_NAME">Guard Hero Browser</message>
<message name="IDS_SHORT_PRODUCT_NAME">Guard Hero</message>
```

Register custom URL scheme in `chrome/common/url_constants.cc`:
```cpp
const char kGuardHeroScheme[] = "guardhero";
// Routes: guardhero://newtab, guardhero://settings, guardhero://stats
```

### Icons & Assets
Replace all Chromium/Google branding assets:
- `chrome/app/theme/chromium/` → Guard Hero shield icon set (16, 32, 48, 64, 128, 256px)
- App icon: Shield with GH monogram, dark background, cyan accent
- Installer graphics: `installer/windows/chrome.bmp` → Guard Hero branded equivalents

### Toolbar Button
Add Guard Hero shield button to the browser toolbar (right of omnibox).
- Green shield = blocking active
- Grey shield = site allowlisted or blocking paused
- Red shield with number = threats detected (pulsing animation)

Registration in `chrome/browser/ui/views/guardhero_action_button.h/.cc`

---

## 7. Auto-Update Infrastructure

### Architecture
Use the **Omaha** update protocol (open source, same as Chrome):
- Repo: `github.com/google/omaha` (Windows) + **Sparkle** for macOS
- Self-hosted update server endpoint: `https://updates.guardhero.app/omaha`

### Update Server Response Format
```xml
<response protocol="3.0">
  <app appid="{GUARDHERO-BROWSER-APP-ID}">
    <updatecheck status="ok">
      <urls>
        <url codebase="https://releases.guardhero.app/browser/"/>
      </urls>
      <manifest version="1.2.0.0">
        <packages>
          <package name="guardhero-browser-1.2.0-win64.exe"
                   hash_sha256="abc123..."
                   size="85000000"/>
        </packages>
      </manifest>
    </updatecheck>
  </app>
</response>
```

### Update Cadence
- **Security releases**: Within 48 hours of Chromium stable security update
- **Feature releases**: Monthly
- **Blocklist updates**: Every 6 hours (separate lightweight update, no browser restart needed)

---

## 8. Build System

### Prerequisites
```bash
# All platforms
- Python 3.9+
- Git 2.28+
- Node.js 18+ (for browser-ui build)
- depot_tools (Chromium's build tool)

# Windows
- Visual Studio 2022 (MSVC v143)
- Windows 10 SDK 10.0.20348.0
- 64GB RAM recommended, 32GB minimum
- 150GB free disk

# macOS
- Xcode 14.3+
- macOS 13+ SDK
- Apple Silicon or Intel (fat binary target)

# Linux
- Ubuntu 22.04 LTS
- clang 16+
- lld linker
```

### Build Commands
```bash
# 1. Fetch Chromium source
gclient sync --with_branch_heads --with_tags

# 2. Apply ungoogled-chromium patches
python3 utils/patches.py apply

# 3. Apply Guard Hero patches
python3 build/apply_gh_patches.py

# 4. Build browser-ui assets
cd browser-ui && npm install && npm run build
cd ..

# 5. Configure GN build
gn gen out/Release --args='
  is_official_build=true
  is_debug=false
  target_cpu="x64"
  enable_guardhero=true
  enable_eagleeye_native=true
  proprietary_codecs=true
  ffmpeg_branding="Chrome"
'

# 6. Build
autoninja -C out/Release chrome
```

### CI/CD (GitHub Actions)
```yaml
# .github/workflows/build.yml
name: Build Guard Hero Browser

on:
  push:
    branches: [main, release/*]
  schedule:
    - cron: '0 2 * * 1'  # Weekly rebase check

jobs:
  build-windows:
    runs-on: [self-hosted, windows, x64]
    steps:
      - uses: actions/checkout@v3
      - name: Sync Chromium
        run: gclient sync
      - name: Apply patches
        run: python build/apply_gh_patches.py
      - name: Build
        run: autoninja -C out/Release chrome
      - name: Package installer
        run: build/windows/make_installer.ps1
      - name: Upload artifact
        uses: actions/upload-artifact@v3

  build-macos:
    runs-on: [self-hosted, macos, arm64]
    steps:
      # similar steps

  rebase-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check for new Chromium stable
        run: python build/check_upstream.py
      - name: Alert if behind
        run: python build/notify_team.py
```

---

## 9. Patch Management & Rebasing

This is the most operationally critical aspect of maintaining a Chromium fork.

### Patch Organization
Each Guard Hero patch is a `.patch` file in `patches/`:
```
patches/
├── core/
│   ├── 001-branding-product-name.patch
│   ├── 002-custom-url-schemes.patch
│   ├── 003-remove-google-branding.patch
│   └── 004-default-settings.patch
├── eagleeye/
│   ├── 010-add-interceptor-interface.patch
│   ├── 011-register-eagleeye-in-network-service.patch
│   └── 012-add-toolbar-button.patch
├── privacy/
│   ├── 020-disable-safe-browsing-ui.patch
│   ├── 021-canvas-fingerprint-noise.patch
│   └── 022-block-battery-api.patch
└── ui/
    ├── 030-newtab-page-override.patch
    └── 031-settings-page-additions.patch
```

### Rebase Procedure
```bash
# Run when new Chromium stable is released
python3 build/rebase.py --target-version=123.0.6312.58

# Script does:
# 1. Updates gclient DEPS to new version
# 2. Syncs Chromium source
# 3. Attempts to apply each patch in order
# 4. Reports conflicts for manual resolution
# 5. Runs smoke tests
```

### Rebase Principles
- **Minimize patch surface**: Every line of custom code is a future rebase conflict. Prefer configuration over code changes.
- **Never modify generated files**: Only modify source files; generated files are rebuilt.
- **Tag each patch with the Chromium file it touches**: Makes conflict triage faster.
- **Rebase within 72 hours of security releases**: Non-negotiable for a privacy product.

---

## 10. Installer & Distribution

### Windows
- Installer: **NSIS** (Nullsoft Scriptable Install System)
- Output: `GuardHeroBrowser-Setup-x64.exe`
- Silent install flag: `/S` (for enterprise deployment)
- Registry keys: Set as default browser option, add to Programs list
- Code signing: EV certificate required (prevents SmartScreen warnings)

### macOS
- Output: `GuardHeroBrowser.dmg` containing `Guard Hero Browser.app`
- Notarization: Required for Gatekeeper; use Apple Developer account
- `.pkg` variant for enterprise MDM deployment
- Universal binary (arm64 + x86_64)

### Linux
- `.deb` package for Ubuntu/Debian
- `.rpm` for Fedora/RHEL
- AppImage for distro-agnostic distribution
- Snap / Flatpak (phase 2)

### Distribution Channels
- **Primary**: `guardhero.app/browser` (direct download)
- **Windows**: winget package (`guardhero.GuardHeroBrowser`)
- **macOS**: Homebrew cask (`brew install --cask guardhero-browser`)
- **Linux**: APT repository at `deb.guardhero.app`

---

## 11. OPi-one Integration

Guard Hero Browser can sync with a user's OPi-one device on the local network.

### Discovery
Browser scans local network for OPi-one devices via mDNS (`_guardhero._tcp.local`).

### Sync Protocol
```
Browser ←→ OPi-one (local network, HTTPS with self-signed cert pinning)

Shared data:
- Allowlist / blocklist entries
- Aggregate stats (browser-side + network-side combined view)
- Blocklist version (ensure both are on same list version)
```

### UI
In settings (`guardhero://settings#opione`):
```
OPi-one Sync
━━━━━━━━━━━━
● Connected — OPi-one (192.168.1.42)
  Network blocked today: 3,847 requests
  Browser blocked today: 421 requests
  Combined: 4,268 requests blocked

[Sync allowlists]  [View network stats]  [Disconnect]
```

---

## 12. Privacy Architecture Principles

These are non-negotiable design constraints for every feature decision:

1. **No data leaves the device without explicit user action.** Stats, blocklists, AI model inference — all local.
2. **No accounts required.** The browser works fully without any Guard Hero account.
3. **Open audit trail.** All blocklists are human-readable and stored in `~/.guardhero/lists/`. Users can inspect them.
4. **AI model is local.** The ML inference engine runs on-device. The model file ships with the browser; no API calls to Guard Hero servers for inference.
5. **Update server is the only required network connection.** And even that can be disabled in enterprise deployments.
6. **No monetization via data.** Guard Hero Browser does not sell or share browsing data. Revenue comes from Pro features and OPi-one hardware.

---

## 13. Testing Strategy

### Unit Tests
- `eagleeye-native/blocker/` — Test domain matching accuracy, false positive rate, performance benchmarks
- `eagleeye-native/ai-engine/` — Test model inference correctness, latency (target: < 5ms per URL)
- `browser-ui/` — React component tests via Vitest + Testing Library

### Integration Tests
- End-to-end: Launch browser, navigate to known tracker-heavy sites (CNN, weather.com), assert block count > 0
- OPi-one sync: Mock OPi-one server, verify sync protocol

### Privacy Audit Tests
```bash
# Run automated privacy checks
python3 tests/privacy_audit.py

# Checks:
# - No outbound connections to google.com domains on fresh launch
# - No crash report endpoints reachable
# - WebRTC leak test (should return no real IP)
# - Canvas fingerprint consistency test (should vary slightly between calls)
```

### Performance Benchmarks
- Speedometer 3.0: Target within 5% of upstream Chromium
- Page load on tracker-heavy sites: Should be **faster** than Chrome (blocking saves bandwidth)
- Memory overhead vs Chrome: Target < 10% additional RAM for EagleEye engine

---

## 14. Phase 1 Deliverables (v1.0)

| Deliverable | Description |
|---|---|
| Working Chromium fork | Ungoogled base + Guard Hero patches applied and building |
| EagleEye Native (static) | Blocklist-based blocking working in network stack |
| New Tab Page | Stats + search + top sites, Guard Hero branded |
| Toolbar Popup | Per-page tracker list, toggle |
| Branding | Icons, product name, custom scheme |
| Windows installer | NSIS installer, code signed |
| macOS DMG | Notarized, universal binary |
| Auto-updater | Omaha server + client configured |
| Privacy hardening patches | All settings from Section 3 applied |

### Out of scope for v1.0
- AI engine (ship in v1.1)
- OPi-one sync (ship in v1.2)
- Linux packages (ship in v1.1)
- Mobile (v2.0)

---

## 15. Prompting Guide for Claude

When using this document to build components with Claude, use the following prompt patterns:

### To scaffold a component:
```
Using the Guard Hero Browser spec (attached), implement [COMPONENT NAME].
Relevant section: [SECTION NUMBER].
Language: [C++ / TypeScript / React].
Output only the implementation files listed in that section.
Follow the file names and interfaces exactly as specified.
```

### To implement the EagleEye native blocker:
```
Implement `domain_matcher.h` and `domain_matcher.cc` from the Guard Hero Browser spec Section 4.
Use a Bloom filter for fast lookup + a hash map for confirmation.
Target: < 1ms lookup for 93,000 domains.
No external dependencies beyond the C++ standard library and Chromium's base/ library.
```

### To build the New Tab Page:
```
Build the Guard Hero Browser New Tab Page (Section 5.1).
React 18 + TypeScript. Mock `chrome.guardhero` API for development.
Design: dark theme, colors #0A0E1A / #00D4FF / #FF4B6E.
Include all components listed: SearchBar, StatsPanel, TopSites, QuickLinks, Clock.
```

### To generate a patch:
```
Generate a Git patch file for Guard Hero Browser that [DESCRIPTION OF CHANGE].
The patch should apply cleanly to Chromium [VERSION].
File it as patches/[category]/[number]-[name].patch.
Follow the patch format conventions in Section 9.
```

### To build the Developer Tools panel:
```
Build the Guard Hero Browser DevMode panel (Section 16).
React 18 + TypeScript. Start with the [COMPONENT NAME] from Section [16.X].
Mock chrome.guardhero.onRequestEvent for development.
All data must stay local — no external API calls.
```

### To build Gamer tools:
```
Implement [COMPONENT NAME] from the Guard Hero Browser spec Section [17.X].
For native components use C++ targeting Chromium's base/ and content/ layers.
For UI components use React 18 + TypeScript with the dark theme design tokens:
  background #0A0E1A, accent #00D4FF, alert #FF4B6E.
```
```
Write the GitHub Actions workflow for building Guard Hero Browser on [PLATFORM].
Follow the structure in Section 8 (CI/CD).
Include: Chromium sync, patch application, UI asset build, GN configuration, autoninja build, artifact upload.
```

---

## 16. Developer Tools Suite

Guard Hero Browser ships a **DevMode** side panel — activated via `Ctrl+Shift+D` or the toolbar — that houses all developer tools beyond standard Chrome DevTools. These are built as React panels injected into the browser chrome (not as extensions).

### 16.1 Request Inspector

An enhanced network monitor that surfaces Guard Hero-specific data alongside standard request info.

**What it shows beyond standard DevTools:**
- Whether each request was **blocked, allowed, or modified** by EagleEye
- What tracking data *would have been sent* (query params stripped, headers sanitized)
- CNAME chain visualization for cloaked trackers
- Request/response diff between two selected requests

**UI layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Request Inspector                    [Filter: all / blocked] │
├──────────────────┬──────────┬────────┬───────────────────────┤
│ URL              │ Type     │ Status │ Guard Hero             │
├──────────────────┼──────────┼────────┼───────────────────────┤
│ analytics.g.com  │ XHR      │ —      │ BLOCKED (AI)          │
│ cdn.example.com  │ Script   │ 200    │ ALLOWED               │
│ fbcdn.net/tr     │ Pixel    │ —      │ BLOCKED (list)        │
│ api.myapp.com    │ Fetch    │ 200    │ ALLOWED               │
└──────────────────┴──────────┴────────┴───────────────────────┘
│ Selected: analytics.g.com                                    │
│ Would have sent: { cid: "UA-xxxxx", t: "pageview", ... }    │
│ Blocked because: domain on EagleEye list (category: Analytics)│
└─────────────────────────────────────────────────────────────┘
```

**Files to implement:**
- `browser-ui/devtools/request-inspector/RequestInspector.tsx`
- `browser-ui/devtools/request-inspector/RequestRow.tsx`
- `browser-ui/devtools/request-inspector/RequestDetail.tsx`
- `browser-ui/devtools/request-inspector/useRequestStream.ts` — subscribes to `chrome.guardhero.onRequestEvent`

**New native API needed:**
```javascript
chrome.guardhero.onRequestEvent.addListener((event) => {
  // event: { url, type, decision, reason, strippedParams, cnameChain, tabId }
})
```

---

### 16.2 API Tester (Built-in REST Client)

A lightweight Postman/Insomnia alternative living in a browser side panel. No account, no sync to external servers, all data stored locally.

**Features:**
- HTTP methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- Headers editor (key-value)
- Body editor: JSON, form-data, raw, binary
- Environment variables (e.g., `{{base_url}}`, `{{auth_token}}`)
- Response viewer: JSON tree, raw, headers
- Request history (local, last 200 requests)
- Collection saving (local storage, exportable as JSON)
- **Guard Hero integration**: shows whether the request would be blocked by EagleEye before sending

**UI layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ API Tester                                    [Collections]   │
├────────┬─────────────────────────────────────┬───────────────┤
│ GET    │ https://api.example.com/users        │  [Send]       │
├────────┴─────────────────────────────────────┴───────────────┤
│ [Headers] [Body] [Auth] [Params]                              │
│ Authorization: Bearer {{auth_token}}                          │
│ Content-Type: application/json                                │
├───────────────────────────────────────────────────────────────┤
│ Response  200 OK  142ms  1.2KB                                │
│ { "users": [...] }                                            │
└───────────────────────────────────────────────────────────────┘
```

**Files to implement:**
- `browser-ui/devtools/api-tester/ApiTester.tsx`
- `browser-ui/devtools/api-tester/RequestBuilder.tsx`
- `browser-ui/devtools/api-tester/ResponseViewer.tsx`
- `browser-ui/devtools/api-tester/EnvironmentManager.tsx`
- `browser-ui/devtools/api-tester/CollectionManager.tsx`
- `browser-ui/devtools/api-tester/useRequestSender.ts` — uses `fetch()` with CORS bypass via browser-level hook

**Storage:** IndexedDB via `idb` library. Collections and history never leave the device.

---

### 16.3 Local HTTPS Proxy (mkcert integration)

Developers constantly fight self-signed cert warnings on localhost. Guard Hero Browser ships with `mkcert` logic baked in — a local certificate authority trusted by the browser automatically.

**How it works:**
1. On first DevMode activation, browser generates a local CA cert and trusts it in its own cert store (no OS-level changes needed — isolated to Guard Hero Browser).
2. User can issue certs for any local domain: `localhost`, `myapp.local`, `*.dev.local`
3. Certs are stored in `~/.guardhero/dev-certs/`
4. Browser serves a local proxy on `127.0.0.1:7890` that wraps any HTTP localhost server with HTTPS

**UI in Settings (`guardhero://settings#developer`):**
```
Local HTTPS
━━━━━━━━━━━
Local CA: Active (created 2026-01-15)
[Regenerate CA]  [Export CA cert]

Issued certificates:
  localhost          Valid until 2027-01-15
  myapp.local        Valid until 2027-01-15
  [+ Issue new cert]
```

**Files to implement:**
- `browser-ui/settings/developer/LocalHttpsManager.tsx`
- Native: `chrome/browser/guardhero/dev_cert_manager.h/.cc` — wraps BoringSSL (already in Chromium) for cert generation and trust injection

---

### 16.4 JavaScript Scratchpad

A persistent REPL panel that runs JS in the context of the current page — more convenient than the DevTools console for iterative testing.

**Features:**
- Monaco editor (same as VS Code) for the input pane
- Output pane with syntax-highlighted results
- **Persistent across page navigations** (unlike DevTools console which clears)
- Snippets library: save and name reusable scripts
- `page.` helper namespace: `page.query()`, `page.fetch()`, `page.storage()` shorthand utilities
- Execution context toggle: page context vs isolated context

**Files to implement:**
- `browser-ui/devtools/scratchpad/Scratchpad.tsx`
- `browser-ui/devtools/scratchpad/MonacoPane.tsx` — Monaco Editor integration
- `browser-ui/devtools/scratchpad/OutputPane.tsx`
- `browser-ui/devtools/scratchpad/SnippetManager.tsx`
- `browser-ui/devtools/scratchpad/pageHelpers.js` — injected into page context

---

### 16.5 Cookie and Storage Manager

A visual, fully editable inspector for cookies, localStorage, sessionStorage, and IndexedDB — surfaced in one place with Guard Hero context (flags cookies set by known trackers).

**Features:**
- Tree view: Cookies / LocalStorage / SessionStorage / IndexedDB / Cache Storage
- Inline edit, delete, add for all storage types
- Export all storage as JSON
- Import: restore from JSON export (useful for testing authenticated states)
- Guard Hero flag: cookies from known tracker domains highlighted in red
- **Bulk delete**: "Delete all tracker cookies" one-click action

**Files to implement:**
- `browser-ui/devtools/storage-manager/StorageManager.tsx`
- `browser-ui/devtools/storage-manager/CookieTable.tsx`
- `browser-ui/devtools/storage-manager/LocalStorageView.tsx`
- `browser-ui/devtools/storage-manager/StorageExporter.ts`

---

### 16.6 Tracker Audit Report

A shareable, exportable privacy report for any page — useful for developers auditing their own sites or security researchers.

**Triggered by:** Right-click menu "Generate Guard Hero Privacy Report" or `guardhero://audit?url=<url>`

**Report contains:**
- Total trackers detected
- Breakdown by category: Analytics, Advertising, Social, Fingerprinting, CNAME-cloaked
- Each tracker: domain, category, data that would have been sent, severity score
- Fingerprinting surface: Canvas, WebGL, fonts, screen, battery, network APIs exposed
- Third-party requests as percentage of total requests
- Page weight saved by blocking (bytes)
- Exportable as JSON or PDF

**Files to implement:**
- `browser-ui/audit/AuditReport.tsx` — rendered at `guardhero://audit`
- `browser-ui/audit/TrackerBreakdown.tsx`
- `browser-ui/audit/FingerprintSurface.tsx`
- `browser-ui/audit/ReportExporter.ts`
- Native: `chrome/browser/guardhero/audit_runner.h/.cc` — triggers a headless page load with full instrumentation

---

### 16.7 Header Editor

Modify request and response headers without an extension. Lives in DevMode panel.

**Use cases:**
- Test API behavior with different `Authorization`, `Accept`, or `User-Agent` headers
- Simulate different locales via `Accept-Language`
- Override `Content-Security-Policy` during development
- Add custom headers to every request to a specific domain

**Features:**
- Rule-based: match URL pattern, then add/modify/remove header
- Request headers and response headers both editable
- Rules scoped to: current tab / all tabs / specific domain
- Rules export/import as JSON

**Files to implement:**
- `browser-ui/devtools/header-editor/HeaderEditor.tsx`
- `browser-ui/devtools/header-editor/RuleBuilder.tsx`
- Native hook: `chrome/browser/guardhero/header_modifier.h/.cc` — hooks into `WebRequestAPI` to apply rules

---

### 16.8 DevMode Settings (`guardhero://settings#developer`)

Consolidated developer settings page:

```
Developer Tools
━━━━━━━━━━━━━━━
[x] Enable DevMode panel (Ctrl+Shift+D)
[x] Request Inspector
[x] API Tester
[x] JavaScript Scratchpad
[x] Cookie and Storage Manager
[x] Header Editor
[ ] Show Guard Hero annotations in standard DevTools

Local HTTPS
━━━━━━━━━━━
[x] Enable local CA
[Manage certificates]

Experimental
━━━━━━━━━━━━
[ ] Show AI confidence scores in Request Inspector
[ ] Enable response diff tool (beta)
```

---

## 17. Gamer Tools Suite

Guard Hero Browser wins gamers on two fronts: **performance** (the browser does not compete with the game for resources) and **ad-free streaming** (Twitch and YouTube work the way they should). Features are deliberately minimal — gamers do not want a browser trying to be a gaming platform.

### 17.1 Performance Mode

A single toggle that reconfigures the browser for maximum resource efficiency while gaming.

**What it changes when activated:**

| Resource | Normal mode | Performance mode |
|---|---|---|
| Background tab JS | Runs normally | Throttled to 1% CPU budget |
| Background tab rendering | Active | Suspended (frozen) |
| Unused tab memory | Kept in RAM | Discarded after 5 min |
| Hardware acceleration | Standard | Forced on |
| Browser UI animations | Enabled | Disabled |
| Browser process priority | Normal | Lowered (yields to game process) |
| Prefetch / preload | Enabled | Disabled |

**Activation:**
- Keyboard shortcut: `Ctrl+Shift+G` (toggleable)
- Toolbar button turns amber when active
- Auto-activation option: detect when a full-screen application is running (via OS API)

**Files to implement:**
- `browser-ui/performance/PerformanceModeToggle.tsx`
- Native: `chrome/browser/guardhero/performance_mode.h/.cc`
  - Hooks into `TabManager` to freeze/discard background tabs
  - Sets process priority via `SetPriorityClass` (Windows) / `setpriority` (POSIX)
  - Disables `NetworkPredictionOptions`

---

### 17.2 Ad-Free Video Streaming

Pre-tuned, maintained blocklists specifically targeting video ad injection on platforms gamers use most.

**Platforms targeted:** Twitch, YouTube, Kick.com, Facebook Gaming

**Technical approach:**
These platforms use server-side ad insertion (SSAI) which evades simple domain blocking. Guard Hero's layered approach:

1. **Domain blocking**: Block known ad CDN domains (first line of defense)
2. **URL pattern matching**: Identify ad manifest segments by URL pattern in HLS/DASH streams
3. **M3U8 rewriting**: For Twitch, intercept and rewrite playlist manifests to remove ad segments
4. **Fallback muting**: If an ad segment plays anyway, mute audio and show "Ad skipped" overlay

**Files to implement:**
- `eagleeye-native/video-blocker/twitch_ad_blocker.h/.cc` — M3U8 manifest interceptor
- `eagleeye-native/video-blocker/youtube_ad_blocker.h/.cc` — YouTube-specific request patterns
- `patches/eagleeye/015-video-ad-blocker.patch` — hooks into network service response handler
- `browser-ui/newtab/VideoBlockerStatus.tsx` — shows video ads blocked count in NTP stats

**Blocklist maintenance:** Video ad blocking breaks frequently. Maintain a dedicated `video-ads` blocklist with a 24-hour update cycle, separate from the main list.

---

### 17.3 Picture-in-Picture Plus (PiP+)

An enhanced PiP mode that floats a video window over any application, including games running in windowed or borderless-windowed mode.

**Improvements over Chrome's built-in PiP:**

| Feature | Chrome PiP | Guard Hero PiP+ |
|---|---|---|
| Stays on top of other apps | Yes | Yes |
| Resize | Limited | Free resize with snap-to-corner |
| Opacity control | No | 20%–100% slider |
| Keyboard shortcut | No | Configurable (default: `Alt+P`) |
| Remember position/size | No | Yes, per-site |
| Corner snapping | No | Snaps to any screen corner |
| Works on all video sites | No (site must allow) | Yes, force-enabled |

**Activation:** Right-click any video "Open in PiP+" or press `Alt+P`

**Files to implement:**
- `browser-ui/pip/PipPlusOverlay.tsx` — floating overlay with resize handle, opacity slider, snap controls
- Native: `chrome/browser/guardhero/pip_plus.h/.cc` — extends `PictureInPictureWindowManager`
- `patches/ui/035-pip-plus.patch`

---

### 17.4 Download Manager

A built-in download manager designed for large file downloads without disrupting active gaming sessions.

**Features:**
- **Speed throttling**: Cap download speed (e.g., max 5 MB/s) so gaming isn't disrupted
- **Scheduled downloads**: Queue a download to start at a specified time
- **Parallel segments**: Split large files into segments for faster total download
- **Pause/resume**: Persist across browser restarts
- **File integrity**: SHA256 verification after download completes, with optional hash comparison
- Queue management: prioritize, reorder, cancel

**Files to implement:**
- `browser-ui/downloads/DownloadManager.tsx`
- `browser-ui/downloads/DownloadQueue.tsx`
- `browser-ui/downloads/SpeedThrottleControl.tsx`
- `browser-ui/downloads/ScheduleModal.tsx`
- Native: `chrome/browser/guardhero/download_throttler.h/.cc` — wraps `DownloadManager` with rate limiting

---

### 17.5 Resource Usage HUD

A minimal toggleable overlay showing browser resource consumption, so gamers can verify the browser is not impacting game performance.

**Displayed (compact, configurable corner):**
```
GH Browser
CPU  1.2%
RAM  312 MB
NET  2.1 MB/s down
```

- Updates every 2 seconds
- Click to expand: full per-tab resource breakdown
- Color coding: green (CPU < 5%) / yellow / red (CPU > 15%)
- Auto-hides when browser is not the focused window

**Files to implement:**
- `browser-ui/hud/ResourceHud.tsx`
- Native: `chrome/browser/guardhero/resource_monitor.h/.cc` — polls `ProcessMetrics` and tab memory usage

---

### 17.6 Gamer Mode Settings (`guardhero://settings#gaming`)

```
Gaming
━━━━━━
[x] Enable Performance Mode shortcut (Ctrl+Shift+G)
[ ] Auto-enable Performance Mode when full-screen app detected
Background tab behavior in Performance Mode:
  (o) Suspend after 5 minutes
  ( ) Suspend immediately
  ( ) Never suspend

Ad-Free Streaming
━━━━━━━━━━━━━━━━━
[x] Block Twitch ads
[x] Block YouTube ads
[x] Block Kick.com ads
[ ] Block Facebook Gaming ads

Picture-in-Picture+
━━━━━━━━━━━━━━━━━━
[x] Enable PiP+ (replaces standard PiP)
Shortcut: [Alt+P]
Default opacity: 80%
Default corner: Bottom-right

Download Manager
━━━━━━━━━━━━━━━
[x] Enable built-in download manager
Speed limit while gaming: 5 MB/s  (0 = unlimited)
[ ] Show download HUD in toolbar

Resource HUD
━━━━━━━━━━━━
[ ] Show resource usage overlay
Update interval: 2 seconds
```

---

## 18. Phase Roadmap (Updated)

| Version | Focus | Key Deliverables |
|---|---|---|
| **v1.0** | Core privacy browser | Ungoogled base, EagleEye native (static lists), NTP, toolbar popup, Windows + macOS installers, auto-updater |
| **v1.1** | Developer audience | Request Inspector, API Tester, JS Scratchpad, Cookie Manager, Header Editor, local HTTPS proxy |
| **v1.2** | Gamer audience | Performance Mode, Ad-Free Streaming (Twitch/YouTube), PiP+, Download Manager, Resource HUD |
| **v1.3** | AI + ecosystem | EagleEye AI engine, OPi-one sync, Tracker Audit Report |
| **v2.0** | Mobile | iOS + Android (Chromium mobile fork) |

---

## 18. Phase Roadmap (Updated)

| Version | Focus | Key Deliverables |
|---|---|---|
| **v1.0** | Core privacy browser | Ungoogled base, EagleEye native (static lists), NTP, toolbar popup, Windows + macOS installers, auto-updater |
| **v1.1** | Developer audience | Request Inspector, API Tester, JS Scratchpad, Cookie Manager, Header Editor, local HTTPS proxy |
| **v1.2** | Gamer audience | Performance Mode, Ad-Free Streaming (Twitch/YouTube), PiP+, Download Manager, Resource HUD |
| **v1.3** | AI Tools — core | AI Side Panel, Local Model Integration (Ollama/LM Studio), Privacy Shield for AI, Page Summarizer |
| **v1.4** | AI Tools — advanced | AI Session Manager, Prompt Library, AI Request Inspector, Tab Semantic Search, Reading Mode + AI |
| **v1.5** | Ecosystem | EagleEye AI engine, OPi-one sync, Tracker Audit Report |
| **v2.0** | Mobile | iOS + Android (Chromium mobile fork) |

---

## 20. AI Tools Suite

Guard Hero Browser's core differentiator for AI power users is captured in one line:

> **"The only browser that lets you use AI without becoming the training data."**

EagleEye already blocks telemetry from ad networks. The AI Tools Suite extends that story to AI services themselves: Guard Hero shows you exactly what each AI tool receives, flags third-party calls made by AI interfaces, and supports routing prompts to fully local models where nothing ever leaves the machine.

### Target user
Developers, researchers, and knowledge workers who use AI tools (Claude, ChatGPT, Copilot, Perplexity, Gemini, Ollama) for multiple hours per day and are frustrated by: context loss between sessions, copy-paste friction between browser and AI, and uncertainty about what data AI services collect.

---

### 20.1 AI Side Panel

A persistent, collapsible side panel giving instant access to AI models from any page. Eliminates the copy-paste loop between browser content and external AI tools.

**Core interaction:**
1. User selects text on any page
2. Presses `Alt+A` (configurable)
3. AI Side Panel opens with selected text pre-loaded as context
4. User types a prompt; response streams inline
5. Panel stays open while user continues browsing

**Supported model providers (configurable):**
- Claude (Anthropic API)
- ChatGPT (OpenAI API)
- Gemini (Google API)
- Perplexity API
- Any OpenAI-compatible API endpoint (covers Groq, Together, Mistral, etc.)
- Local models via Ollama or LM Studio (see Section 20.3)

**Panel layout:**
```
┌─────────────────────────────────┐
│ AI Side Panel     [Claude ▾] [x]│
├─────────────────────────────────┤
│ Context (from page selection):  │
│ "The Omaha update protocol is   │
│  an open-source..."             │
│                          [Clear]│
├─────────────────────────────────┤
│                                 │
│ Summarize this in 3 bullets     │
│                                 │
│ ─────────────────────────────── │
│ Response:                       │
│ • Omaha is Google's open-source │
│   update protocol...            │
│ • Used by Chrome, adaptable...  │
│ • Guard Hero uses it for...     │
│                                 │
├─────────────────────────────────┤
│ [Ask follow-up...]   [Copy] [+] │
│                    [Save prompt]│
└─────────────────────────────────┘
```

**Panel modes:**
- **Chat mode** — standard multi-turn conversation
- **Page mode** — full page content sent as context automatically (respects token limits, truncates intelligently)
- **Selection mode** — only selected text sent as context
- **Code mode** — syntax-aware; detects code blocks and wraps them correctly

**Files to implement:**
- `browser-ui/ai-panel/AiSidePanel.tsx` — main panel shell
- `browser-ui/ai-panel/ModelSelector.tsx` — dropdown with configured providers
- `browser-ui/ai-panel/ContextPane.tsx` — shows what context is loaded, allows editing
- `browser-ui/ai-panel/ChatThread.tsx` — streaming message display
- `browser-ui/ai-panel/PromptInput.tsx` — input bar with keyboard shortcuts
- `browser-ui/ai-panel/useAiStream.ts` — unified streaming client for all providers
- `browser-ui/ai-panel/providers/` — one file per provider (claude.ts, openai.ts, gemini.ts, ollama.ts, generic.ts)

**Native integration:**
- `chrome/browser/guardhero/ai_panel_manager.h/.cc` — manages panel lifecycle, text selection capture, keyboard shortcut registration
- Panel is injected as a browser-level side panel (same mechanism as Chrome's built-in Reading List panel), not a content script — so it works on every page including chrome:// URLs

**API key storage:**
Keys are stored in the browser's encrypted profile store (`chrome/browser/guardhero/ai_credentials_store.h/.cc`), never in localStorage or plaintext. Keys are never transmitted anywhere except directly to the model provider's endpoint.

---

### 20.2 Privacy Shield for AI

An extension of EagleEye that specifically monitors AI tool interfaces and shows users exactly what data is being sent to AI providers.

**What it monitors:**
- Every API call made by AI web interfaces (chat.openai.com, claude.ai, gemini.google.com, etc.)
- Tokens sent per request (estimated from request body size)
- Third-party calls made by the AI interface itself (analytics, telemetry, CDNs)
- Whether the AI interface uses persistent identifiers (cookies, fingerprinting)
- Whether conversations are sent to analytics endpoints separate from the AI API

**Toolbar indicator:**
When the user is on an AI tool interface, the Guard Hero shield shows an "AI" badge:
- Green: No unexpected third-party calls detected
- Yellow: Analytics present (e.g., Amplitude on ChatGPT)
- Red: Sensitive data patterns detected in outbound requests

**Popup panel (AI tab):**
```
┌──────────────────────────────────────┐
│ Guard Hero — AI Privacy Shield       │
├──────────────────────────────────────┤
│ You are on: chat.openai.com          │
│                                      │
│ This session:                        │
│   Tokens sent (est.):  ~4,200        │
│   API calls:           12            │
│   Blocked trackers:    3             │
│                                      │
│ Third-party calls:                   │
│   analytics.openai.com   ALLOWED     │
│   amplitude.com          BLOCKED     │
│   sentry.io              ALLOWED     │
│                                      │
│ Privacy rating: B+                   │
│ [Details]  [Block all analytics]     │
└──────────────────────────────────────┘
```

**Privacy rating system (A–F):**
Computed per AI service based on: number of third-party analytics calls, use of fingerprinting APIs, presence of persistent identifiers, data retention policy (sourced from Guard Hero's maintained service database).

**Files to implement:**
- `browser-ui/ai-shield/AiPrivacyPanel.tsx` — popup tab for AI tool pages
- `browser-ui/ai-shield/TokenEstimator.tsx` — displays estimated tokens sent
- `browser-ui/ai-shield/ThirdPartyList.tsx` — list of third-party calls with block toggles
- `browser-ui/ai-shield/PrivacyRating.tsx` — A–F grade with breakdown
- Native: `chrome/browser/guardhero/ai_shield_monitor.h/.cc` — hooks into network layer to intercept and analyze requests on known AI service domains
- `eagleeye-native/lists/ai-services.txt` — maintained list of AI service domains and their known third-party dependencies

---

### 20.3 Local Model Integration

Guard Hero Browser natively detects and integrates with locally running AI models, enabling fully private AI workflows where no data leaves the machine.

**Supported local runtimes:**
- **Ollama** — auto-detected at `http://localhost:11434`
- **LM Studio** — auto-detected at `http://localhost:1234`
- **llama.cpp server** — configurable endpoint
- Any OpenAI-compatible local API

**Auto-discovery:**
On browser startup and periodically, Guard Hero pings known local ports. If a local model server is found, it appears automatically in the AI Side Panel model selector with a lock icon indicating "Local — no data leaves your device."

```
Model selector:
  [Claude 3.5 Sonnet    ▾]
  ─────────────────────
  Cloud Models
    Claude 3.5 Sonnet
    GPT-4o
    Gemini 1.5 Pro
  ─────────────────────
  Local Models (detected)
  🔒 llama3.2:3b (Ollama)
  🔒 mistral-7b (LM Studio)
  ─────────────────────
  [+ Add custom endpoint]
```

**Privacy indicator:**
When a local model is selected, the AI Side Panel shows a persistent "LOCAL — PRIVATE" badge. The Guard Hero shield shows a closed padlock. No network requests are made to any external server for inference.

**Model management UI (`guardhero://settings#ai`):**
```
Local AI Models
━━━━━━━━━━━━━━━
Ollama detected at localhost:11434
  Available models:
    llama3.2:3b     2.0 GB   [Use] [Default]
    mistral:7b      4.1 GB   [Use]
    codellama:13b   7.3 GB   [Use]
  [Open Ollama dashboard]

LM Studio: Not detected
  [Configure custom endpoint]

Custom endpoints:
  [+ Add OpenAI-compatible endpoint]
```

**Files to implement:**
- `browser-ui/ai-panel/providers/ollama.ts` — Ollama API client (streaming)
- `browser-ui/ai-panel/providers/lmstudio.ts` — LM Studio API client
- `browser-ui/ai-panel/providers/local-generic.ts` — OpenAI-compatible local API client
- `browser-ui/settings/ai/LocalModelManager.tsx` — settings UI
- Native: `chrome/browser/guardhero/local_model_discovery.h/.cc` — background service that pings local ports and reports available models

---

### 20.4 Page Summarizer

One-shortcut page summarization using the user's configured AI model. Replaces extension-based summarizers (Summarize, TLDR This, etc.).

**Activation:** `Alt+S` on any page, or right-click "Summarize with Guard Hero AI"

**Behavior:**
1. Guard Hero extracts page content (strips nav, ads, footers — same engine as Reader Mode)
2. Sends to configured model with a summarization prompt
3. Streams result into a floating overlay (dismissable, copyable)
4. If local model is configured as default, the entire operation is local

**Summary formats (user selects):**
- **3-bullet TL;DR** — default, ultra-brief
- **Executive summary** — 2–3 paragraphs
- **Key facts** — numbered list of claims/data points
- **Q&A** — generates 5 questions and answers from the content
- **ELI5** — plain language explanation

**Overlay UI:**
```
┌─────────────────────────────────────────────┐
│ Page Summary                    [Claude] [x] │
├─────────────────────────────────────────────┤
│ TL;DR                                        │
│ • Chromium's network stack intercepts        │
│   requests before they reach the OS...       │
│ • URLRequestInterceptor is the correct       │
│   hook point for EagleEye native...          │
│ • Rebase cadence is the #1 operational risk  │
│   for Chromium forks...                      │
├─────────────────────────────────────────────┤
│ [3 Bullets] [Summary] [Facts] [Q&A] [ELI5]  │
│ [Copy]  [Save to Session]  [Open in Panel]   │
└─────────────────────────────────────────────┘
```

**Files to implement:**
- `browser-ui/summarizer/SummaryOverlay.tsx`
- `browser-ui/summarizer/FormatSelector.tsx`
- `browser-ui/summarizer/useSummarize.ts` — calls `useAiStream` with summarization prompt + extracted page content
- Native: `chrome/browser/guardhero/page_content_extractor.h/.cc` — extracts readable text from DOM (based on Readability algorithm, already used in Firefox Reader Mode; a clean-room implementation is needed)

---

### 20.5 AI Session Manager

Organizes AI conversations across all tools into a searchable, taggable, exportable archive. No other browser offers this today.

**The problem it solves:**
AI chat history is siloed per tool. A user's conversation about a project in Claude is separate from their conversation about the same project in ChatGPT. Sessions expire. There's no cross-tool search. Guard Hero Browser becomes the layer that owns session continuity.

**How it works:**
- When the user visits a supported AI tool (Claude.ai, ChatGPT, Gemini, Perplexity), Guard Hero injects a lightweight content script that captures conversation turns as they happen
- Conversations are stored locally in `~/.guardhero/ai-sessions/` as structured JSON
- Never synced to any server — purely local
- Accessible at `guardhero://ai-sessions`

**Supported tools for session capture:**
- Claude.ai
- chat.openai.com (ChatGPT)
- gemini.google.com
- perplexity.ai
- Any conversation started in the Guard Hero AI Side Panel (natively captured)

**Session Manager UI (`guardhero://ai-sessions`):**
```
┌────────────────────────────────────────────────────────────┐
│ AI Session Manager                [Search...]   [+ New]    │
├──────────────┬─────────────────────────────────────────────┤
│ All          │ Guard Hero Browser Spec Discussion          │
│ Claude.ai    │ Claude.ai · 3 hours ago · 42 turns          │
│ ChatGPT      │ Tags: [browser] [chromium] [project]        │
│ Gemini       │ "How does URLRequestInterceptor work in..." │
│ Side Panel   ├─────────────────────────────────────────────┤
│              │ Twitch Ad Blocking Research                 │
│ Tags         │ Perplexity · Yesterday · 18 turns           │
│  browser     │ Tags: [research] [ads]                      │
│  project     │ "What techniques does twitchAdSolutions..." │
│  research    ├─────────────────────────────────────────────┤
│  code        │ Rust async patterns                         │
│              │ ChatGPT · 2 days ago · 67 turns             │
└──────────────┴─────────────────────────────────────────────┘
```

**Features:**
- Full-text search across all sessions and all tools
- Tag sessions manually or auto-tag via AI (local model)
- Export session as Markdown, JSON, or PDF
- Link sessions together ("continue this conversation" across tools)
- Pin important sessions
- Auto-archive sessions older than N days (configurable)

**Files to implement:**
- `browser-ui/ai-sessions/SessionManager.tsx` — main `guardhero://ai-sessions` page
- `browser-ui/ai-sessions/SessionList.tsx`
- `browser-ui/ai-sessions/SessionDetail.tsx`
- `browser-ui/ai-sessions/SessionSearch.tsx`
- `browser-ui/ai-sessions/SessionExporter.ts`
- Content scripts per supported tool:
  - `browser-ui/ai-sessions/capture/claude-capture.ts`
  - `browser-ui/ai-sessions/capture/chatgpt-capture.ts`
  - `browser-ui/ai-sessions/capture/gemini-capture.ts`
  - `browser-ui/ai-sessions/capture/perplexity-capture.ts`
- Native: `chrome/browser/guardhero/ai_session_store.h/.cc` — SQLite-backed local session storage

**Storage format (`~/.guardhero/ai-sessions/<session-id>.json`):**
```json
{
  "id": "sess_abc123",
  "title": "Guard Hero Browser Spec Discussion",
  "tool": "claude.ai",
  "created_at": "2026-01-15T14:23:00Z",
  "updated_at": "2026-01-15T17:41:00Z",
  "tags": ["browser", "chromium", "project"],
  "turns": [
    {
      "role": "user",
      "content": "How does URLRequestInterceptor work?",
      "timestamp": "2026-01-15T14:23:12Z"
    },
    {
      "role": "assistant",
      "content": "URLRequestInterceptor is a Chromium interface...",
      "timestamp": "2026-01-15T14:23:15Z"
    }
  ]
}
```

---

### 20.6 Prompt Library

A browser-native saved prompt manager accessible from any AI interface via keyboard shortcut.

**The problem:** Power users maintain prompts in Notion, text files, or just their memory. There's no standard way to reuse prompts across tools.

**Activation:** `Alt+P` in any text input on an AI tool page (or in the AI Side Panel)

**UI — floating command palette style:**
```
┌──────────────────────────────────────────┐
│ Prompt Library          [Search prompts] │
├──────────────────────────────────────────┤
│ Recent                                   │
│  > Summarize this as 3 bullets           │
│  > Explain this code step by step        │
│  > Rewrite this more concisely           │
├──────────────────────────────────────────┤
│ Saved                                    │
│  [Code] Explain this code step by step   │
│  [Code] Find bugs in this code           │
│  [Write] Rewrite more concisely          │
│  [Write] Make this more formal           │
│  [Research] Summarize key claims         │
│  [Custom] ..............................  │
├──────────────────────────────────────────┤
│ [+ New prompt]              [Manage all] │
└──────────────────────────────────────────┘
```

**Features:**
- Select a prompt to insert it into the active AI text input
- Prompts support `{{variables}}` — selecting a prompt with variables opens a quick-fill dialog
- Organize prompts by tag/category
- Import/export as JSON
- Community prompt packs (curated by Guard Hero, installed locally — no cloud dependency)
- Works in: AI Side Panel, claude.ai, ChatGPT, Gemini, any `<textarea>` on AI tool pages

**Prompt template example with variables:**
```
Analyze the following {{content_type}} and provide:
1. A one-sentence summary
2. Three key insights
3. One potential concern

Content: {{selected_text}}
```

**Files to implement:**
- `browser-ui/prompt-library/PromptPalette.tsx` — floating command palette
- `browser-ui/prompt-library/PromptEditor.tsx` — create/edit prompt with variable support
- `browser-ui/prompt-library/VariableFillDialog.tsx` — fills `{{variables}}` before inserting
- `browser-ui/prompt-library/PromptManager.tsx` — full management page at `guardhero://prompts`
- `browser-ui/prompt-library/usePromptInserter.ts` — injects prompt text into active input element
- Native: `chrome/browser/guardhero/prompt_store.h/.cc` — encrypted local storage for prompts

---

### 20.7 AI Request Inspector

An extension of the developer Request Inspector (Section 16.1) with AI-specific analysis. Shows developers exactly what their AI API calls cost, contain, and expose.

**Additional columns in Request Inspector when an AI API is detected:**

| Column | Description |
|---|---|
| Model | Detected model name (e.g., `claude-sonnet-4`) |
| Input tokens (est.) | Estimated from request body character count |
| Output tokens (est.) | Estimated from response body |
| Cost (est.) | Calculated from provider's published pricing |
| System prompt | Whether a system prompt is present (collapsed by default) |
| PII detected | Flags if request body contains patterns matching email, phone, credit card, API keys |

**PII detection:**
Guard Hero scans outbound AI API request bodies for common PII patterns using local regex — no content is sent anywhere. If a potential API key, password pattern, SSN, or credit card number is detected in a prompt being sent to a cloud AI, a warning is shown:

```
Warning: Possible API key detected in prompt
Pattern: sk-...xxxx
Destination: api.openai.com
[Block request]  [Allow once]  [Allow always]
```

**Files to implement:**
- `browser-ui/devtools/request-inspector/AiRequestColumns.tsx` — additional columns for AI requests
- `browser-ui/devtools/request-inspector/PiiWarningBanner.tsx`
- `browser-ui/devtools/request-inspector/TokenCostEstimator.ts` — pricing table per provider, updated with blocklist updates
- Native: `chrome/browser/guardhero/pii_detector.h/.cc` — fast regex scan of request bodies for known PII patterns

---

### 20.8 Tab Semantic Search

Find any open or recently closed tab using natural language — not just title/URL matching.

**Activation:** `Ctrl+K` (replaces or augments the standard tab search)

**How it works:**
- When a tab is opened and has been active for > 5 seconds, Guard Hero extracts its readable text content (same extractor as Page Summarizer, Section 20.4)
- Content is embedded locally using a tiny embedding model (all-MiniLM-L6-v2, ~22MB, runs via ONNX Runtime bundled with the browser)
- Embeddings stored locally in `~/.guardhero/tab-index/`
- On search, query is embedded and cosine similarity computed against stored tab embeddings

**Search UI:**
```
┌──────────────────────────────────────────────────┐
│  Find tab...                                      │
│  > that article about chromium rebase process     │
├──────────────────────────────────────────────────┤
│  Open tabs                                        │
│  [Chrome] REBASING.md — guardhero-browser         │
│  [Chrome] Ungoogled Chromium — GitHub             │
│                                                   │
│  Recent (closed)                                  │
│  [Closed 2h ago] Chromium Build Instructions      │
└──────────────────────────────────────────────────┘
```

**Privacy:** All embedding and search is local. No content is sent to any server. The embedding model runs entirely on-device via ONNX Runtime.

**Files to implement:**
- `browser-ui/tab-search/TabSearchPalette.tsx`
- `browser-ui/tab-search/TabResult.tsx`
- Native: `chrome/browser/guardhero/tab_semantic_indexer.h/.cc`
  - Hooks into `TabStripModel` to detect tab activation
  - Calls page content extractor on active tab
  - Runs embedding via ONNX Runtime (`third_party/onnxruntime/`)
  - Stores embeddings in LevelDB (already in Chromium)
- `chrome/browser/guardhero/tab_semantic_search.h/.cc` — cosine similarity search over stored embeddings

**Embedding model:**
- Model: `all-MiniLM-L6-v2` (Apache 2.0 license)
- Format: ONNX
- Size: ~22MB
- Output: 384-dimensional float vector
- Bundled in browser at: `resources/guardhero/models/tab-embed.onnx`

---

### 20.9 Reading Mode + AI

An enhanced Reader Mode that combines distraction-free reading with instant AI Q&A on the current article.

**Activation:** Click reader icon in omnibox (same as standard browser) or `Alt+R`

**Enhancements over standard Reader Mode:**
- AI Q&A panel alongside the article: ask questions about what you're reading
- **Highlight and explain**: select any passage, press `Alt+E` — AI explains it in plain language
- **Fact check mode**: AI identifies factual claims in the article and flags confidence level
- **Related questions**: AI generates 5 questions the article answers, displayed at the bottom
- Works with local models — entire session can be private

**Layout:**
```
┌──────────────────────────────────┬────────────────────┐
│                                  │  Ask about this    │
│  Article Title                   │  article           │
│  ─────────────────               │                    │
│  Lorem ipsum article text with   │  > What is the     │
│  clean typography, no ads,       │    main argument?  │
│  no distractions...              │                    │
│                                  │  The author argues │
│  [Selected text highlighted]     │  that...           │
│                                  │                    │
│                                  │  [Ask follow-up]   │
└──────────────────────────────────┴────────────────────┘
```

**Files to implement:**
- `browser-ui/reader/ReaderMode.tsx` — full reader page at `guardhero://reader`
- `browser-ui/reader/ArticleQA.tsx` — AI Q&A side panel within reader
- `browser-ui/reader/HighlightExplainer.tsx` — floating explainer for selected text
- `browser-ui/reader/FactCheckOverlay.tsx` — claim highlighting with confidence indicators
- Native: `chrome/browser/guardhero/reader_mode_bridge.h/.cc` — integrates with Chromium's `dom_distiller` component

---

### 20.10 AI Tools Settings (`guardhero://settings#ai`)

```
AI Side Panel
━━━━━━━━━━━━━
[x] Enable AI Side Panel (Alt+A)
Default model: [Claude 3.5 Sonnet ▾]
Panel position: [Right ▾]

Model Providers
━━━━━━━━━━━━━━━
Claude (Anthropic)
  API Key: [••••••••••••••sk-ant]  [Edit]
  Status: Connected

OpenAI
  API Key: [Not configured]        [Add]

Local Models
━━━━━━━━━━━━
Ollama: Detected at localhost:11434
  llama3.2:3b  · mistral:7b  · codellama:13b
  [Manage models]

LM Studio: Not detected
  [Configure endpoint]

Privacy Shield for AI
━━━━━━━━━━━━━━━━━━━━━
[x] Show AI privacy badge on AI tool pages
[x] Block analytics on AI tool pages
[x] Warn if PII detected in AI requests
[ ] Block all third-party calls on AI tool pages

AI Session Manager
━━━━━━━━━━━━━━━━━━
[x] Capture sessions from Claude.ai
[x] Capture sessions from ChatGPT
[x] Capture sessions from Gemini
[x] Capture sessions from Perplexity
Auto-archive after: [90 days ▾]
Storage used: 42 MB  [Clear all sessions]

Page Summarizer
━━━━━━━━━━━━━━━
[x] Enable (Alt+S)
Default format: [3 Bullets ▾]
Model: [Same as default ▾]

Tab Semantic Search
━━━━━━━━━━━━━━━━━━
[x] Enable semantic tab search (Ctrl+K)
[ ] Index closed tabs (uses more disk)
Index size: 8.2 MB  [Rebuild index]

Prompt Library
━━━━━━━━━━━━━━
[x] Enable prompt palette (Alt+P on AI pages)
[Manage prompts →]
[x] Install Guard Hero community prompt pack
```

---

### 20.11 AI Tools — Repository Additions

Add to the repository structure from Section 2:

```
guardhero-browser/
├── browser-ui/
│   ├── ai-panel/               # AI Side Panel (Section 20.1)
│   │   ├── providers/          # One file per model provider
│   │   └── ...
│   ├── ai-shield/              # Privacy Shield for AI (Section 20.2)
│   ├── ai-sessions/            # Session Manager (Section 20.5)
│   │   └── capture/            # Per-tool content scripts
│   ├── prompt-library/         # Prompt Library (Section 20.6)
│   ├── tab-search/             # Semantic Tab Search (Section 20.8)
│   ├── summarizer/             # Page Summarizer (Section 20.4)
│   └── reader/                 # Reading Mode + AI (Section 20.9)
├── eagleeye-native/
│   └── lists/
│       └── ai-services.txt     # AI service domains + known third parties
├── resources/
│   └── guardhero/
│       └── models/
│           ├── tab-embed.onnx  # Tab semantic search embedding model
│           └── models.json     # Model manifest + checksums
└── patches/
    └── ai/
        ├── 040-ai-panel-sidebar.patch
        ├── 041-tab-semantic-indexer.patch
        ├── 042-reader-mode-bridge.patch
        └── 043-pii-detector-hook.patch
```

---

### 20.12 Prompting Guide Additions (AI Tools)

When using this spec to build AI tool components with Claude:

```
Build [COMPONENT] from Guard Hero Browser spec Section [20.X].
React 18 + TypeScript.
All AI calls go through useAiStream.ts — do not make fetch() calls directly to AI APIs.
All data (sessions, prompts, embeddings) must be stored locally — no external sync.
Mock chrome.guardhero APIs for development using the mock definitions in
browser-ui/mocks/chrome-guardhero.ts.
```

**To implement the Ollama provider:**
```
Implement browser-ui/ai-panel/providers/ollama.ts from Guard Hero Browser spec Section 20.3.
It must:
- Auto-detect Ollama at http://localhost:11434/api/tags
- List available models
- Stream completions via http://localhost:11434/api/chat (Ollama chat API)
- Return an async generator that yields string chunks
- Handle connection errors gracefully with a user-friendly message
```

**To implement session capture for Claude.ai:**
```
Implement browser-ui/ai-sessions/capture/claude-capture.ts from Section 20.5.
This is a content script that runs on claude.ai.
It must:
- Use MutationObserver to detect new conversation turns in the DOM
- Extract role (human/assistant) and content text
- Post turns to chrome.guardhero.aiSessions.appendTurn() native API
- Be resilient to DOM structure changes (use semantic selectors, not brittle class names)
- Never send captured content anywhere except the local native API
```

---

## 21. Key References

| Resource | URL |
|---|---|
| Ungoogled Chromium | github.com/ungoogled-software/ungoogled-chromium |
| Chromium source | chromium.googlesource.com/chromium/src |
| Chromium build docs | chromium.googlesource.com/chromium/src/+/main/docs/get_the_code.md |
| GN build system | gn.googlesource.com/gn |
| depot_tools | chromium.googlesource.com/chromium/tools/depot_tools |
| Omaha updater | github.com/google/omaha |
| Sparkle (macOS updates) | github.com/sparkle-project/Sparkle |
| Brave's patches (reference) | github.com/brave/brave-core |
| URLRequestInterceptor docs | source.chromium.org (search: URLRequestInterceptor) |
| Chrome Extension APIs | developer.chrome.com/docs/extensions/reference |
| Ollama API docs | github.com/ollama/ollama/blob/main/docs/api.md |
| LM Studio API docs | lmstudio.ai/docs/api |
| ONNX Runtime | onnxruntime.ai |
| all-MiniLM-L6-v2 model | huggingface.co/sentence-transformers/all-MiniLM-L6-v2 |
| Chromium dom_distiller | source.chromium.org (search: dom_distiller) |
| Chromium Side Panel API | source.chromium.org (search: side_panel) |
| Anthropic API docs | docs.anthropic.com |
| OpenAI API docs | platform.openai.com/docs |

---

*Document version: 1.2 — Generated for Guard Hero (guardhero.app)*
*Intended audience: Claude (AI assistant) + engineering team*
*Last updated: 2026*
*Changelog:*
*  v1.0 — Initial spec: core browser, EagleEye native, NTP, installer, auto-updater*
*  v1.1 — Added developer tools suite (Section 16), gamer tools suite (Section 17), updated roadmap*
*  v1.2 — Added AI tools suite (Section 20): AI Side Panel, Privacy Shield for AI, Local Model*
*          Integration, Page Summarizer, AI Session Manager, Prompt Library, AI Request Inspector,*
*          Tab Semantic Search, Reading Mode + AI. Updated roadmap (Section 18) and references.*
