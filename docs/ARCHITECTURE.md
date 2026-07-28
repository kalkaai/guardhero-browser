# Guard Hero Browser — Architecture Overview

---

## 1. Big Picture

Guard Hero Browser is a **Chromium fork** built on top of **ungoogled-chromium**, with Guard Hero's own patch layers, native C++ blocking engine (EagleEye), and a React-based browser UI.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Guard Hero Browser                             │
│                                                                     │
│  ┌─────────────────┐  ┌───────────────────┐  ┌──────────────────┐  │
│  │  Guard Hero UI  │  │  EagleEye Native  │  │  Guard Hero      │  │
│  │  (React/TSX)    │  │  (C++ Blocker)    │  │  Patches         │  │
│  │                 │  │                   │  │                  │  │
│  │  newtab/        │  │  domain_matcher   │  │  patches/core/   │  │
│  │  popup/         │  │  url_analyzer     │  │  patches/privacy/│  │
│  │  settings/      │  │  cname_resolver   │  │  patches/ui/     │  │
│  └────────┬────────┘  └────────┬──────────┘  └──────────────────┘  │
│           │                    │                                    │
│           │  chrome.guardhero.*│                                    │
│           ▼                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 Chromium Browser (ungoogled)                 │   │
│  │  chrome/browser/  │  net/  │  content/  │  blink/renderer/  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Patch Layers

Guard Hero applies patches in this order:

```
Base Chromium source
       │
       ▼ (1) ungoogled-chromium patches
Ungoogled Chromium
       │
       ▼ (2) patches/core/      — Branding, URL schemes, default settings
       ▼ (3) patches/privacy/   — Canvas noise, battery API block, Safe Browsing off
       ▼ (4) patches/eagleeye/  — Native blocker registration, toolbar button
       ▼ (5) patches/ui/        — NTP override, settings page
       ▼ (6) patches/ai/        — AI side panel, tab indexer, reader bridge
       │
       ▼
Guard Hero Browser
```

Each patch is a standard unified diff (`.patch` file). Applied via `git apply` in `build/apply_gh_patches.py`.

### Patch naming convention:

```
NNN-description-of-change.patch
```

- `0xx` = core (branding, scheme)
- `01x` = eagleeye integration
- `02x` = privacy hardening
- `03x` = UI
- `04x` = AI tools

---

## 3. EagleEye Request Lifecycle

Every HTTP/HTTPS request passes through EagleEye before leaving the browser:

```
Browser makes network request
          │
          ▼
  EagleEyeInterceptor::MaybeInterceptRequest()
  [chrome/browser/guardhero/eagleeye_interceptor.cc]
          │
          ▼
  RequestInterceptor::Intercept()
  [eagleeye-native/blocker/request_interceptor.cc]
          │
          ├─ Step 1: User allowlist? ──────────────────────→ ALLOW
          │                                                   (pass through)
          ├─ Step 2: User blocklist? ──────────────────────→ BLOCK
          │
          ├─ Step 3: CNAME cloaking check ─────────────────→ BLOCK
          │  [eagleeye-native/blocker/cname_resolver.cc]       (if cloaked)
          │
          ├─ Step 4: Static blocklist (DomainMatcher) ─────→ BLOCK
          │  Bloom filter → hash set confirmation              (if matched)
          │  [eagleeye-native/blocker/domain_matcher.cc]
          │
          └─ Step 5: Tracking param stripping ─────────────→ MODIFY
             [eagleeye-native/blocker/url_analyzer.cc]         (redirect to
                                                                cleaned URL)
                    │
                    ▼
            ALLOW (pass to network)
```

**Performance targets:**
- Bloom filter check: < 100 ns
- Hash set confirmation: < 200 ns
- Full intercept path: < 1 ms for 93,000 domains

---

## 4. Domain Matcher — Bloom Filter + Hash Map

The `DomainMatcher` uses a two-tier lookup for speed and accuracy:

```
IsBlocked("stats.doubleclick.net")
         │
         ▼
  [Tier 1: Bloom filter]
  4 independent hash functions → 4 bit positions
  Any bit = 0 → DEFINITELY NOT blocked (O(1), < 100ns)
         │
  All bits = 1 → PROBABLY blocked
         │
         ▼
  [Tier 2: std::unordered_set<string>]
  Exact domain lookup (confirms or rejects false positive)
         │
         ▼
  If not found: check parent domains
  "stats.doubleclick.net" → "doubleclick.net" ← found!
         │
         ▼
  Return: BLOCKED
```

Bloom filter parameters:
- 15 bits per expected item
- 4 hash functions (FNV-1a + MurmurHash3 double hashing)
- False positive rate: ~0.1% (resolved by hash map)
- Size for 100,000 domains: ~190 KB

---

## 5. UI Architecture

Guard Hero's browser UI is built with **React 18 + TypeScript**, bundled with **Vite**, and served from Chromium's WebUI mechanism.

```
browser-ui/
├── newtab/     → served at guardhero://newtab
├── popup/      → served as toolbar popup WebUI bubble
└── settings/   → served at guardhero://settings
```

### How WebUI pages are loaded

1. Chromium receives a navigation to `guardhero://newtab`
2. `ChromeWebUIControllerFactory` matches the URL scheme + host
3. Routes to `GuardHeroNewTabUI` (C++ WebUI controller)
4. Controller serves the bundled React HTML/JS from `resources/guardhero/webui/newtab/`
5. React app boots; calls `chrome.guardhero.*` APIs via the JS bridge

### chrome.guardhero JS bridge

```
JS (React component)                    C++ (browser process)
──────────────────────────────────────────────────────────────
chrome.guardhero.getSessionStats()  →  GuardHeroApiMessageHandler
                                       ::HandleGetSessionStats()
                                               │
                                       EagleEyeInterceptor::GetStats()
                                               │
                                       ← JSON response
```

All `chrome.guardhero.*` calls are routed through Chromium's Mojo IPC mechanism. No data ever leaves the device.

---

## 6. AI Tools Architecture (v1.3+)

The AI tools suite extends Guard Hero into AI-powered browsing features while maintaining the privacy-first promise.

```
AI Side Panel (browser-ui/ai-panel/)
         │
         ▼ useAiStream.ts (unified streaming client)
         │
    ┌────┴──────────────────────────┐
    │  providers/                   │
    │  claude.ts (Anthropic API)    │
    │  openai.ts (OpenAI API)       │
    │  ollama.ts (localhost:11434)  │ ← LOCAL — no data leaves device
    │  lmstudio.ts (localhost:1234) │ ← LOCAL — no data leaves device
    └───────────────────────────────┘
         │
         ▼
  Response streams directly to panel
  Session optionally captured to ~/.guardhero/ai-sessions/
```

### Privacy Shield for AI

When the user visits an AI service interface (Claude.ai, ChatGPT, etc.):
1. `EagleEyeInterceptor` monitors all outbound requests
2. Requests to known analytics domains on AI pages are flagged
3. The toolbar badge shows "AI" with a color indicating privacy level
4. Users can see exactly what's being sent and block unwanted requests

---

## 7. Auto-Update Architecture

```
Guard Hero Browser (client)
         │
         │  POST /omaha  (Omaha v3 protocol)
         │  { appid, version, platform, channel }
         ▼
https://updates.guardhero.app/omaha
         │
         │  { status: "ok"|"noupdate", manifest... }
         ▼
Guard Hero Browser
  ├── If "ok": download installer from releases.guardhero.app
  ├── Verify SHA-256 checksum
  ├── Apply update silently (Windows) or notify user (macOS)
  └── Restart browser with new version

Guard Hero Blocklist Updater (separate, lightweight)
  ├── Runs every 6 hours
  ├── Downloads updated blocklist.txt.gz
  ├── Replaces local blocklist file
  └── Triggers BlocklistManager::Reload() — no browser restart needed
```

---

## 8. Privacy Architecture — Non-Negotiable Constraints

| Constraint | Enforcement |
|---|---|
| No data leaves device | EagleEye runs locally; AI inference local by default |
| No accounts required | Browser fully functional without login |
| Blocklists are human-readable | Stored in `~/.guardhero/lists/` as plain text |
| AI model is local | TFLite/ONNX models bundled with browser |
| Update server is only required connection | Can be disabled in enterprise |
| No monetization via data | Revenue: Pro features + OPi-one hardware |

---

## 9. File Layout Reference

```
guardhero-browser/
├── patches/              # Guard Hero-specific patches
│   ├── core/             # 001-004: Branding, URL schemes, defaults
│   ├── eagleeye/         # 010-012: Native blocker registration
│   ├── privacy/          # 020-022: Fingerprinting, API blocks
│   ├── ui/               # 030-031: NTP, settings
│   └── ai/               # 040-043: AI tools
│
├── eagleeye-native/      # C++ blocking engine
│   ├── blocker/          # Core: domain_matcher, url_analyzer, etc.
│   ├── ai-engine/        # ML tracker classifier (v1.1+)
│   ├── bridge/           # JS↔Native API bridge
│   └── lists/            # blocklist.txt, ai-services.txt
│
├── chrome/browser/guardhero/  # Chromium integration layer
│   ├── eagleeye_interceptor.h/.cc   # URLRequestInterceptor
│   ├── guardhero_action_button.h/.cc # Toolbar shield button
│   ├── guardhero_url_constants.h/.cc # guardhero:// scheme
│   └── BUILD.gn
│
├── browser-ui/           # React UI (Vite + TypeScript)
│   ├── newtab/           # NTP: Clock, SearchBar, StatsPanel, TopSites
│   ├── popup/            # Toolbar popup: ShieldToggle, TrackerList
│   ├── settings/         # Settings: all sections
│   ├── ai-panel/         # AI Side Panel + providers
│   └── mocks/            # Development mocks for chrome.guardhero
│
├── build/                # Build scripts
│   ├── apply_gh_patches.py
│   ├── rebase.py
│   ├── check_upstream.py
│   └── notify_team.py
│
├── installer/
│   ├── windows/guardhero.nsi      # NSIS installer
│   └── macos/create_dmg.sh        # DMG builder
│
├── updater/
│   ├── omaha_config.xml           # Update server config
│   └── update_response_template.xml
│
├── .github/workflows/
│   ├── build.yml                  # CI: build + rebase check
│   └── blocklist-update.yml       # Automated blocklist refresh
│
├── DEPS                  # Chromium revision pin
├── .gclient              # gclient configuration
└── docs/
    ├── BUILD.md          ← This guide
    ├── REBASING.md
    └── ARCHITECTURE.md   ← This file
```
