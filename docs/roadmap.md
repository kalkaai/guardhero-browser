# Guard Hero Browser — Product Roadmap

> **Last updated:** May 2026 | **Spec version:** 1.2 | **Status:** MVP patches complete — build infrastructure ready for Chromium sync

---

## Overview

Guard Hero Browser is a privacy-first Chromium fork built on Ungoogled Chromium, with native ad/tracker blocking (EagleEye), a developer tools suite, a gamer tools suite, and an AI tools suite. This roadmap tracks the full release trajectory from MVP test build through v2.0 (mobile).

---

## Release Philosophy

- **Rebase within 72 hours** of any Chromium security release — non-negotiable for a privacy product.
- **Blocklist updates every 6 hours** — no browser restart required.
- **Feature releases monthly** — never sacrifice rebase cadence for feature work.
- **No data leaves the device** without explicit user action — every feature is evaluated against this constraint.

---

## MVP — Developer Test Build
**Target: 4–6 weeks | Focus: Validate core blocking + user reaction**

The MVP is not a public release. It's a manual-install test build distributed to 10–15 developers to answer two questions before investing in distribution infrastructure:

1. **Does EagleEye block reliably without breaking sites?** False positive rate is the #1 risk — discover it here, not at launch.
2. **Does the stats panel create a "wow" moment?** Seeing "42 trackers blocked" needs to feel meaningful, not like noise.

Developers are the right test audience: they'll tolerate a manual install, use a range of work-critical sites (internal tools, SaaS, APIs), and give precise feedback about what breaks.

### What's in the MVP

**1. EagleEye Native Blocking (static only)**
- [x] Fork Ungoogled Chromium; establish `guardhero-browser/` repo structure
- [x] Set up `depot_tools` + `gclient` pipeline for Chromium source sync (`.gclient` + `DEPS`)
- [x] Define patch organization (`patches/core/`, `patches/eagleeye/`, `patches/privacy/`, `patches/ui/`)
- [x] Implement `build/apply_gh_patches.py`
- [x] `eagleeye-native/blocker/domain_matcher.h/.cc` — Bloom filter + hash map, <1ms lookup for 93K+ domains
- [x] `eagleeye-native/blocker/url_analyzer.h/.cc` — strip tracking query params
- [x] `eagleeye-native/blocker/blocklist_manager.h/.cc` — load and parse blocklist from disk
- [ ] `eagleeye-native/blocker/request_interceptor.h/.cc` — hook into `URLRequestInterceptor`
- [x] `010-add-interceptor-interface.patch` + `011-register-eagleeye-in-network-service.patch`
- [x] Bundle initial blocklist seed (287 curated domains); `build/generate_blocklist.py` fetches 93K+ from EasyPrivacy + uBlock at build time
- [x] `chrome.guardhero.getSessionStats()` + `chrome.guardhero.getPageStats(tabId)` native bridge APIs (mock; native bridge in v1.0)

**2. New Tab Page (stats-focused)**
- [x] React 18 + TypeScript + Vite NTP, bundled at build time
- [x] `<StatsPanel />` — session blocked count, animated, pulling from `chrome.guardhero.getSessionStats()`
- [x] `<SearchBar />` — submits to browser address bar
- [x] `<Clock />` — date/time display
- [x] Dark theme: `#0A0E1A` bg, `#00D4FF` accent, `#FF4B6E` blocked indicator
- [ ] Local font loading (no Google Fonts CDN)

**3. Toolbar Popup**
- [x] `<ShieldToggle />` — per-site blocking on/off
- [x] `<TrackerList />` — scrollable blocked requests for current page, pulling from `chrome.guardhero.getPageStats()`
- [x] `<AllowSiteButton />` — add domain to allowlist
- [ ] Toolbar shield: green (active) / grey (paused/allowlisted)
- [x] `012-add-toolbar-button.patch`

**4. Minimal Branding**
- [x] `001-branding-product-name.patch` — product name "Guard Hero Browser" (compile-time)
- [x] `002-custom-url-schemes.patch` — register `guardhero://` URL scheme
- [x] `003-remove-google-branding.patch` — suppress all Chromium/Google branding in UI
- [x] Guard Hero shield icon — `resources/guardhero/icons/shield.svg` + `build/generate_icons.py` (rasterizes to 16/32/48/64/128/256px + .icns/.ico)

**5. Hardened Defaults (compile-time, no UI needed for MVP)**
- [x] `004-default-settings.patch` — block 3rd-party cookies, disable sync, DuckDuckGo default
- [x] `020-disable-safe-browsing-ui.patch` — disable Safe Browsing and remove its UI
- [x] `023-disable-uma-metrics.patch` — disable UMA, crash reporting, Finch/Variations seed fetch
- [x] `024-disable-webrtc-nonproxied-udp.patch` — set kDefaultPublicInterfaceOnly, block mDNS ICE candidates

### What's NOT in the MVP

- Code-signed installer (manual install is fine for developer testers)
- Auto-updater (distribute new builds manually during test period)
- Full settings page (hardcoded defaults are sufficient)
- CNAME uncloaking (add in v1.0)
- Canvas fingerprint noise (add in v1.0)
- Allowlist/blocklist editor UI (allow via JS console for now)
- Top Sites grid, QuickLinks (NTP can be minimal)

### MVP Success Criteria

| Metric | Target |
|---|---|
| False positive rate (sites broken by blocking) | < 2% of tester-reported sites |
| Stats panel engagement | Testers notice and mention the counter unprompted |
| Blocking effectiveness on tracker-heavy sites | > 20 requests blocked on CNN, weather.com, YouTube |
| Performance vs Chrome on Speedometer 3.0 | Within 10% (looser than v1.0 target) |
| Tester willingness to keep using it | > 60% after 2 weeks |

### MVP Distribution

- macOS `.app` bundle (unsigned — testers approve via System Preferences)
- Windows `.exe` (unsigned — testers run via right-click "Run anyway")
- Distributed via direct link to testers; no public download page
- Feedback: structured Google Form + async Slack/Discord channel

---

## v1.0 — Core Privacy Browser
**Target: Q3 2026 | Focus: Foundational privacy & public distribution**

This release takes everything validated in the MVP and wraps it into a shippable, installable product. Establishes Guard Hero as a credible Brave alternative with meaningful privacy improvements and a clean first-run experience.

### Infrastructure & Base
*(Repo structure and base patches started in MVP — these complete the production build pipeline)*

- [ ] Implement `build/rebase.py --target-version=X` — automated rebase assist script
- [ ] Implement `build/check_upstream.py` — detects when Guard Hero is behind Chromium stable
- [ ] Set up self-hosted build runners (Windows x64, macOS arm64)
- [ ] GitHub Actions CI: build, patch-apply, smoke test on every push to `main` and `release/*`
- [ ] Weekly scheduled rebase-check workflow

### Privacy Hardening Patches (Section 3)
*(Core defaults set in MVP — these add the remaining hardening layer)*

- [x] `021-canvas-fingerprint-noise.patch` — add subtle canvas noise (Brave approach)
- [x] `022-block-battery-api.patch` — block Battery API fingerprinting vector
- [ ] Disable translation service
- [ ] Force spell check to local-only
- [ ] Default DNS over HTTPS to Cloudflare 1.1.1.1 (user-changeable)
- [ ] Use CRLSets only; disable live OCSP requests
- [ ] Block font enumeration
- [ ] Block Network Information API
- [ ] Set `hyperlink_auditing_enabled: false` (compile-time default)
- [ ] Set `allow_cross_origin_auth_prompt: false` (compile-time default)

### EagleEye Native — Production Hardening
*(Core blocker shipped in MVP — these complete the production-grade implementation)*

- [ ] `eagleeye-native/blocker/cname_resolver.h/.cc` — detect CNAME-cloaked trackers
- [ ] Hot-reload blocklists from disk without browser restart
- [ ] `chrome/browser/guardhero/eagleeye_interceptor.cc` — production implementation (harden from MVP prototype)
- [ ] 6-hour lightweight blocklist update pipeline
- [ ] `chrome.guardhero.getAllTimeStats()` — all-time and monthly stats bridge API
- [ ] Toolbar shield: red+number state for threats detected (pulsing animation)

### Browser UI — Completion
*(MVP shipped StatsPanel, SearchBar, Clock, basic popup — these complete the NTP and popup)*

- [x] `<TopSites />` — favicon grid via `chrome.topSites.get()`
- [x] `<QuickLinks />` — EagleEye, OPi-one, Settings
- [ ] NTP all-time + monthly stats (session stats shipped in MVP)
- [x] `<ReportButton />` — false positive feedback form in popup
- [ ] Toolbar shield red+number state

### Branding (Section 6)
*(MVP used minimal icons — full asset set required for public launch)*

- [ ] Full Guard Hero icon set: 16, 32, 48, 64, 128, 256px
- [ ] App icon: shield with GH monogram, dark bg, cyan accent (production quality)
- [ ] Installer graphics for Windows and macOS
- [ ] `chrome/browser/ui/views/guardhero_action_button.h/.cc` — production toolbar button

### Auto-Updater (Section 7)

- [ ] Self-hosted Omaha update server at `https://updates.guardhero.app/omaha`
- [ ] Windows: Omaha client integration
- [ ] macOS: Sparkle integration
- [ ] Update response XML format implemented
- [ ] Release hosting at `https://releases.guardhero.app/browser/`
- [ ] Update cadence configured: security <48h, features monthly, blocklists every 6h

### Installer & Distribution (Section 10)

- [ ] Windows: NSIS installer → `GuardHeroBrowser-Setup-x64.exe`
  - [ ] Silent install flag `/S` for enterprise
  - [ ] Registry keys for default browser, Programs list
  - [ ] EV code signing certificate (prevents SmartScreen warnings)
- [ ] macOS: `.dmg` with `Guard Hero Browser.app`
  - [ ] Apple Developer notarization
  - [ ] Universal binary (arm64 + x86_64)
  - [ ] `.pkg` for enterprise MDM
- [ ] Distribution: `guardhero.app/browser` (primary), winget, Homebrew cask

### Settings Page — Core (Section 5.3)

- [ ] `guardhero://settings` — custom Chrome URL scheme
- [x] Privacy section: blocking level, cookie settings, fingerprinting protection
- [x] EagleEye section: blocklist management, allowlist/blocklist editor
- [x] Search section: DuckDuckGo, Brave Search, Startpage, custom
- [x] Appearance section: dark/light/system theme, NTP customization
- [x] About section: version, update status, changelog

### Testing
*(MVP gives real-world false positive data — use it to fix issues before v1.0 ships)*

**Local dev stack (3-tier)**
- [x] **Tier 1** — Vite React dev server (`./dev.sh`), all 4 panels hot-reload at `localhost:5173`, full `chrome.guardhero.*` mock API wired in
- [x] **Tier 2** — C++ unit tests via gtest (`./dev.sh test`): 28 url_analyzer + 18 domain_matcher = **46 tests, 0 failures**. Bloom filter hit path ~346ns, miss path ~245ns — both well under 1ms target
- [x] **Smoke tests** — `tests/smoke_test.py`: 11 post-rebase checks (DEPS, .gclient, patches, blocklist, EagleEye headers, CI workflows, no hardcoded Google URLs). Run automatically by `build/rebase.py`
- [x] **Tier 3** — Playwright E2E suite (`./dev.sh e2e`): 5 spec files covering Dev Launcher, New Tab Page, Popup, Settings, and DevMode panel across Chromium / Firefox / WebKit. Interactive UI mode via `./dev.sh e2e:ui`

**Pre-ship validation**
- [ ] Address all false positives surfaced during MVP test period
- [ ] Privacy audit script: no outbound calls to google.com on fresh launch, no crash endpoints, WebRTC leak test, canvas fingerprint variance test
- [ ] End-to-end: launch full browser build, navigate to CNN / weather.com, assert block count > 0
- [ ] Speedometer 3.0 benchmark: target within 5% of upstream Chromium (tightened from MVP's 10% target)
- [ ] Memory overhead vs Chrome: target < 10% additional RAM for EagleEye engine

---

## v1.1 — Developer Audience
**Target: Q4 2026 | Focus: DevMode panel and power user tooling**

This release targets developers as the primary early adopter segment. Ships the full DevMode panel (`Ctrl+Shift+D`) with tools that replace or improve on common external utilities.

### DevMode Infrastructure

- [ ] `chrome/browser/guardhero/devmode_panel.h/.cc` — side panel lifecycle management
- [ ] `Ctrl+Shift+D` keyboard shortcut registration
- [ ] `chrome.guardhero.onRequestEvent` native API — streams request events to UI (mock wired in dev)
- [x] DevMode settings page: `guardhero://settings#developer`

### Request Inspector (Section 16.1)

- [x] `browser-ui/devtools/request-inspector/RequestInspector.tsx`
- [x] `browser-ui/devtools/request-inspector/RequestRow.tsx`
- [x] `browser-ui/devtools/request-inspector/RequestDetail.tsx`
- [x] `browser-ui/devtools/request-inspector/useRequestStream.ts` — subscribes to `chrome.guardhero.onRequestEvent`
- [x] EagleEye decision column: BLOCKED / ALLOWED / MODIFIED
- [x] "Would have sent" panel: shows stripped query params and sanitized headers
- [ ] CNAME chain visualization
- [x] Filter: all / blocked / allowed

### API Tester (Section 16.2)

- [x] `browser-ui/devtools/api-tester/ApiTester.tsx`
- [x] `browser-ui/devtools/api-tester/RequestBuilder.tsx` — method, URL, headers, body
- [x] `browser-ui/devtools/api-tester/ResponseViewer.tsx` — JSON tree, raw, headers
- [x] `browser-ui/devtools/api-tester/EnvironmentManager.tsx` — `{{variables}}` support
- [x] `browser-ui/devtools/api-tester/CollectionManager.tsx` — save, organize, export
- [x] `browser-ui/devtools/api-tester/useRequestSender.ts` — fetch with CORS bypass hook
- [ ] Storage: IndexedDB via `idb`; collections and history never leave device
- [ ] Request history: last 200 requests
- [ ] EagleEye pre-flight check: warn if request destination would be blocked

### JavaScript Scratchpad (Section 16.4)

- [x] `browser-ui/devtools/scratchpad/Scratchpad.tsx`
- [x] `browser-ui/devtools/scratchpad/MonacoPane.tsx` — Monaco Editor integration
- [x] `browser-ui/devtools/scratchpad/OutputPane.tsx` — syntax-highlighted results
- [x] `browser-ui/devtools/scratchpad/SnippetManager.tsx` — save and name reusable scripts
- [x] `browser-ui/devtools/scratchpad/pageHelpers.js` — `page.query()`, `page.fetch()`, `page.storage()` helpers
- [ ] Persistent across page navigations
- [ ] Execution context toggle: page context vs isolated context

### Cookie and Storage Manager (Section 16.5)

- [x] `browser-ui/devtools/storage-manager/StorageManager.tsx`
- [x] `browser-ui/devtools/storage-manager/CookieTable.tsx`
- [x] `browser-ui/devtools/storage-manager/LocalStorageView.tsx`
- [x] `browser-ui/devtools/storage-manager/StorageExporter.ts`
- [x] Tree view: Cookies / LocalStorage / SessionStorage / IndexedDB / Cache Storage
- [ ] Inline edit, delete, add for all storage types
- [ ] EagleEye flag: cookies from known tracker domains highlighted red
- [ ] Bulk delete: "Delete all tracker cookies" one-click action
- [x] Export all storage as JSON; import from JSON export

### Local HTTPS Proxy (Section 16.3)

- [x] `browser-ui/settings/developer/LocalHttpsManager.tsx`
- [ ] `chrome/browser/guardhero/dev_cert_manager.h/.cc` — wraps BoringSSL for cert generation
- [ ] Generate local CA cert on first DevMode activation (browser-isolated, no OS changes)
- [ ] Issue certs for `localhost`, `myapp.local`, `*.dev.local`
- [ ] Store certs in `~/.guardhero/dev-certs/`
- [ ] Local proxy on `127.0.0.1:7890` wrapping HTTP localhost with HTTPS

### Header Editor (Section 16.7)

- [x] `browser-ui/devtools/header-editor/HeaderEditor.tsx`
- [x] `browser-ui/devtools/header-editor/RuleBuilder.tsx`
- [ ] `chrome/browser/guardhero/header_modifier.h/.cc` — hooks into `WebRequestAPI`
- [x] Rule-based: match URL pattern → add/modify/remove header
- [x] Request and response headers both editable
- [x] Rules scoped to: current tab / all tabs / specific domain
- [x] Rules export/import as JSON

### Tracker Audit Report (Section 16.6)

- [x] `browser-ui/audit/AuditReport.tsx` — rendered at `guardhero://audit`
- [x] `browser-ui/audit/TrackerBreakdown.tsx` — by category: Analytics, Advertising, Social, Fingerprinting, CNAME-cloaked
- [x] `browser-ui/audit/FingerprintSurface.tsx` — Canvas, WebGL, fonts, screen, battery, network APIs
- [x] `browser-ui/audit/ReportExporter.ts` — export as JSON or PDF
- [ ] `chrome/browser/guardhero/audit_runner.h/.cc` — headless instrumented page load
- [ ] Right-click menu: "Generate Guard Hero Privacy Report"
- [ ] `guardhero://audit?url=<url>` routing

### Linux Distribution

- [ ] `.deb` package for Ubuntu/Debian
- [ ] `.rpm` for Fedora/RHEL
- [ ] AppImage for distro-agnostic distribution
- [ ] APT repository at `deb.guardhero.app`

---

## v1.2 — Gamer Audience
**Target: Q1 2027 | Focus: Performance and ad-free streaming**

Targets gamers on two fronts: making the browser invisible to game performance, and eliminating ads on Twitch and YouTube. Deliberately minimal — no game launcher integration, no overlays that compete with game UX.

### Performance Mode (Section 17.1)

- [ ] `browser-ui/performance/PerformanceModeToggle.tsx`
- [ ] `chrome/browser/guardhero/performance_mode.h/.cc`
  - [ ] Throttle background tab JS to 1% CPU budget
  - [ ] Suspend/freeze background tab rendering
  - [ ] Discard unused tab memory after 5 minutes
  - [ ] Force hardware acceleration on
  - [ ] Disable browser UI animations
  - [ ] Lower browser process priority: `SetPriorityClass` (Windows) / `setpriority` (POSIX)
  - [ ] Disable `NetworkPredictionOptions` (prefetch/preload)
- [ ] `Ctrl+Shift+G` keyboard shortcut (toggleable)
- [ ] Toolbar button turns amber when Performance Mode active
- [ ] Auto-activation option: detect full-screen application via OS API
- [ ] Gaming settings page: `guardhero://settings#gaming`

### Ad-Free Video Streaming (Section 17.2)

- [ ] `eagleeye-native/video-blocker/twitch_ad_blocker.h/.cc` — M3U8 manifest interceptor
- [ ] `eagleeye-native/video-blocker/youtube_ad_blocker.h/.cc` — YouTube-specific request patterns
- [ ] `patches/eagleeye/015-video-ad-blocker.patch` — hooks into network service response handler
- [ ] `browser-ui/newtab/VideoBlockerStatus.tsx` — video ads blocked count in NTP stats
- [ ] Dedicated `video-ads` blocklist with 24-hour update cycle
- [ ] Twitch: domain block + URL pattern matching + M3U8 manifest rewriting + fallback audio muting
- [ ] YouTube: domain block + URL pattern matching
- [ ] Kick.com and Facebook Gaming: domain-level blocking
- [ ] Gamer settings toggles per platform (on/off per site)

### Picture-in-Picture Plus (Section 17.3)

- [ ] `browser-ui/pip/PipPlusOverlay.tsx` — floating overlay with resize, opacity, snap controls
- [ ] `chrome/browser/guardhero/pip_plus.h/.cc` — extends `PictureInPictureWindowManager`
- [ ] `patches/ui/035-pip-plus.patch`
- [ ] Free resize with snap-to-corner
- [ ] Opacity control: 20%–100% slider
- [ ] `Alt+P` keyboard shortcut (configurable)
- [ ] Remember position/size per site
- [ ] Force-enable on all video sites (bypass site-level PiP restrictions)
- [ ] Right-click menu: "Open in PiP+"

### Download Manager (Section 17.4)

- [ ] `browser-ui/downloads/DownloadManager.tsx`
- [ ] `browser-ui/downloads/DownloadQueue.tsx`
- [ ] `browser-ui/downloads/SpeedThrottleControl.tsx`
- [ ] `browser-ui/downloads/ScheduleModal.tsx`
- [ ] `chrome/browser/guardhero/download_throttler.h/.cc` — wraps `DownloadManager` with rate limiting
- [ ] Speed throttling: configurable cap (default 5 MB/s while gaming)
- [ ] Scheduled downloads: queue to start at specified time
- [ ] Parallel segment download for large files
- [ ] Pause/resume across browser restarts
- [ ] SHA256 file integrity verification post-download
- [ ] Queue management: prioritize, reorder, cancel

### Resource Usage HUD (Section 17.5)

- [ ] `browser-ui/hud/ResourceHud.tsx`
- [ ] `chrome/browser/guardhero/resource_monitor.h/.cc` — polls `ProcessMetrics` and tab memory
- [ ] Compact corner overlay: CPU %, RAM, network down speed
- [ ] 2-second update interval (configurable)
- [ ] Click to expand: per-tab resource breakdown
- [ ] Color coding: green (<5% CPU) / yellow / red (>15% CPU)
- [ ] Auto-hide when browser is not the focused window

---

## v1.3 — AI Tools (Core)
**Target: Q2 2027 | Focus: AI Side Panel and local model integration**

Establishes Guard Hero's AI positioning: "The only browser that lets you use AI without becoming the training data." All AI processing defaults to local where possible; cloud providers require explicit opt-in and API key entry.

### AI Side Panel (Section 20.1)

- [ ] `browser-ui/ai-panel/AiSidePanel.tsx` — main panel shell
- [ ] `browser-ui/ai-panel/ModelSelector.tsx` — dropdown with configured providers
- [ ] `browser-ui/ai-panel/ContextPane.tsx` — shows loaded context, allows editing
- [ ] `browser-ui/ai-panel/ChatThread.tsx` — streaming message display
- [ ] `browser-ui/ai-panel/PromptInput.tsx` — input bar with keyboard shortcuts
- [ ] `browser-ui/ai-panel/useAiStream.ts` — unified streaming client for all providers
- [ ] Provider implementations:
  - [ ] `browser-ui/ai-panel/providers/claude.ts` — Anthropic API
  - [ ] `browser-ui/ai-panel/providers/openai.ts` — OpenAI API
  - [ ] `browser-ui/ai-panel/providers/gemini.ts` — Google Gemini API
  - [ ] `browser-ui/ai-panel/providers/ollama.ts` — Ollama (localhost:11434, streaming)
  - [ ] `browser-ui/ai-panel/providers/lmstudio.ts` — LM Studio (localhost:1234)
  - [ ] `browser-ui/ai-panel/providers/generic.ts` — any OpenAI-compatible endpoint
- [ ] `chrome/browser/guardhero/ai_panel_manager.h/.cc` — panel lifecycle, text selection capture, shortcut registration
- [ ] `chrome/browser/guardhero/ai_credentials_store.h/.cc` — encrypted API key storage
- [ ] `Alt+A` shortcut: opens panel with selected page text pre-loaded
- [ ] Panel modes: Chat, Page (full page context), Selection, Code (syntax-aware)
- [ ] Keys stored in encrypted profile store — never in localStorage or plaintext

### Privacy Shield for AI (Section 20.2)

- [ ] `browser-ui/ai-shield/AiPrivacyPanel.tsx` — popup tab on AI tool pages
- [ ] `browser-ui/ai-shield/TokenEstimator.tsx` — estimated tokens sent this session
- [ ] `browser-ui/ai-shield/ThirdPartyList.tsx` — third-party calls with per-item block toggles
- [ ] `browser-ui/ai-shield/PrivacyRating.tsx` — A–F rating with breakdown
- [ ] `chrome/browser/guardhero/ai_shield_monitor.h/.cc` — network layer intercept on AI service domains
- [ ] `eagleeye-native/lists/ai-services.txt` — AI service domains and known third-party dependencies
- [ ] Toolbar shield: AI badge, green/yellow/red states
- [ ] Privacy rating system: scored on third-party analytics, fingerprinting use, persistent identifiers, data retention policy

### Local Model Integration (Section 20.3)

- [ ] `browser-ui/settings/ai/LocalModelManager.tsx`
- [ ] `chrome/browser/guardhero/local_model_discovery.h/.cc` — background service pinging local ports
- [ ] Auto-detect Ollama at `localhost:11434/api/tags`
- [ ] Auto-detect LM Studio at `localhost:1234`
- [ ] Auto-detect llama.cpp server (user-configurable port)
- [ ] Model selector: "Local Models (detected)" section with lock icon
- [ ] "LOCAL — PRIVATE" badge in AI panel when local model selected
- [ ] Guard Hero shield shows closed padlock during local inference
- [ ] `guardhero://settings#ai` — model management UI with per-model use/default controls

### Page Summarizer (Section 20.4)

- [ ] `browser-ui/summarizer/SummaryOverlay.tsx` — floating, dismissable, copyable
- [ ] `browser-ui/summarizer/FormatSelector.tsx`
- [ ] `browser-ui/summarizer/useSummarize.ts` — calls `useAiStream` with extracted content
- [ ] `chrome/browser/guardhero/page_content_extractor.h/.cc` — Readability-based DOM text extraction (clean-room implementation)
- [ ] `Alt+S` shortcut + right-click "Summarize with Guard Hero AI"
- [ ] Summary formats: 3-bullet TL;DR, Executive summary, Key facts, Q&A, ELI5
- [ ] Works fully locally when local model is default

---

## v1.4 — AI Tools (Advanced)
**Target: Q3 2027 | Focus: Cross-tool session continuity and developer AI tooling**

### AI Session Manager (Section 20.5)

- [ ] `browser-ui/ai-sessions/SessionManager.tsx` — `guardhero://ai-sessions`
- [ ] `browser-ui/ai-sessions/SessionList.tsx`
- [ ] `browser-ui/ai-sessions/SessionDetail.tsx`
- [ ] `browser-ui/ai-sessions/SessionSearch.tsx` — full-text search across all tools
- [ ] `browser-ui/ai-sessions/SessionExporter.ts` — Markdown, JSON, PDF export
- [ ] Content scripts (per-tool session capture):
  - [ ] `capture/claude-capture.ts` — MutationObserver on claude.ai DOM
  - [ ] `capture/chatgpt-capture.ts`
  - [ ] `capture/gemini-capture.ts`
  - [ ] `capture/perplexity-capture.ts`
- [ ] `chrome/browser/guardhero/ai_session_store.h/.cc` — SQLite-backed local storage
- [ ] Storage at `~/.guardhero/ai-sessions/<session-id>.json`
- [ ] Auto-tagging via local AI model
- [ ] Pin sessions, link sessions across tools
- [ ] Auto-archive after N days (default 90, configurable)
- [ ] Guard Hero AI Side Panel conversations natively captured

### Prompt Library (Section 20.6)

- [ ] `browser-ui/prompt-library/PromptPalette.tsx` — floating command palette
- [ ] `browser-ui/prompt-library/PromptEditor.tsx` — create/edit with `{{variable}}` support
- [ ] `browser-ui/prompt-library/VariableFillDialog.tsx` — fill variables before inserting
- [ ] `browser-ui/prompt-library/PromptManager.tsx` — `guardhero://prompts` full management page
- [ ] `browser-ui/prompt-library/usePromptInserter.ts` — injects text into active input
- [ ] `chrome/browser/guardhero/prompt_store.h/.cc` — encrypted local prompt storage
- [ ] `Alt+P` on any AI tool page text input
- [ ] Works in AI Side Panel, claude.ai, ChatGPT, Gemini, any textarea on AI pages
- [ ] Community prompt packs: curated by Guard Hero, installed locally, no cloud dependency
- [ ] Import/export as JSON

### AI Request Inspector (Section 20.7)

- [ ] `browser-ui/devtools/request-inspector/AiRequestColumns.tsx` — model, input tokens, output tokens, cost, PII flag
- [ ] `browser-ui/devtools/request-inspector/PiiWarningBanner.tsx`
- [ ] `browser-ui/devtools/request-inspector/TokenCostEstimator.ts` — pricing table per provider
- [ ] `chrome/browser/guardhero/pii_detector.h/.cc` — local regex scan for API keys, SSN, credit card, email patterns
- [ ] Block / Allow once / Allow always decision for flagged requests
- [ ] Pricing table updated via blocklist update channel

### Tab Semantic Search (Section 20.8)

- [ ] `browser-ui/tab-search/TabSearchPalette.tsx`
- [ ] `browser-ui/tab-search/TabResult.tsx`
- [ ] `chrome/browser/guardhero/tab_semantic_indexer.h/.cc`
  - [ ] Hook into `TabStripModel` to detect tab activation
  - [ ] Extract readable text after 5 seconds of active tab time
  - [ ] Embed via ONNX Runtime (`third_party/onnxruntime/`)
  - [ ] Store embeddings in LevelDB
- [ ] `chrome/browser/guardhero/tab_semantic_search.h/.cc` — cosine similarity search
- [ ] Bundle `all-MiniLM-L6-v2` ONNX model (~22MB) at `resources/guardhero/models/tab-embed.onnx`
- [ ] `Ctrl+K` activation
- [ ] Search open tabs and recently closed tabs
- [ ] All embedding and search is fully local — no network calls

### Reading Mode + AI (Section 20.9)

- [ ] `browser-ui/reader/ReaderMode.tsx` — `guardhero://reader`
- [ ] `browser-ui/reader/ArticleQA.tsx` — AI Q&A side panel within reader
- [ ] `browser-ui/reader/HighlightExplainer.tsx` — `Alt+E` floating explanation for selected text
- [ ] `browser-ui/reader/FactCheckOverlay.tsx` — claim highlighting with AI confidence indicators
- [ ] `chrome/browser/guardhero/reader_mode_bridge.h/.cc` — integrates with Chromium's `dom_distiller`
- [ ] `Alt+R` shortcut + omnibox reader icon
- [ ] AI-generated related questions at article bottom
- [ ] Works fully locally when local model is default

---

## v1.5 — Ecosystem & EagleEye AI
**Target: Q4 2027 | Focus: AI-powered blocking and OPi-one sync**

### EagleEye AI Engine (Section 4)

- [ ] `eagleeye-native/ai-engine/model_loader.h/.cc` — loads quantized TFLite model
- [ ] `eagleeye-native/ai-engine/feature_extractor.h/.cc` — 32-dimensional feature vector per URL: TLD, subdomain depth, entropy, path patterns, request context
- [ ] `eagleeye-native/ai-engine/inference_engine.h/.cc` — TFLite inference, returns 0.0–1.0 confidence
- [ ] `eagleeye-native/ai-engine/feedback_loop.h/.cc` — accumulates local false-positive reports; no data leaves device
- [ ] Bundle quantized INT8 TFLite model: <5MB, threshold 0.85 for blocking
- [ ] AI confidence scores in Request Inspector (opt-in, developer settings)
- [ ] Model updates ship with browser updates

### OPi-one Sync (Section 11)

- [ ] mDNS discovery: scan local network for `_guardhero._tcp.local`
- [ ] HTTPS sync protocol with self-signed cert pinning (local network only)
- [ ] Sync: allowlist/blocklist entries, aggregate stats, blocklist version
- [ ] Settings UI: `guardhero://settings#opione`
  - [ ] Connected status display with device IP and combined stats
  - [ ] Sync allowlists, view network stats, disconnect controls
- [ ] Combined stats view: browser-side + network-side blocked request counts

### Snap / Flatpak (Linux)

- [ ] Snap package for Ubuntu ecosystem
- [ ] Flatpak for universal Linux distribution

---

## v2.0 — Mobile
**Target: 2028 | Focus: iOS and Android**

- [ ] iOS browser (Chromium mobile fork — WKWebView constraints to be evaluated)
- [ ] Android browser (Chromium mobile fork)
- [ ] EagleEye native blocking on mobile
- [ ] AI Side Panel adapted for mobile UI
- [ ] OPi-one sync on mobile
- [ ] Cross-device session continuity (AI Session Manager)

---

## Operational Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Chromium rebase conflicts | High | High | Minimize patch surface; prefer config over code; tag every patch with the file it touches; automated rebase-check CI |
| Video ad blocking breakage (Twitch/YouTube) | Very High | Medium | Dedicated `video-ads` blocklist on 24h update cycle; separate from main list |
| EagleEye AI false positive rate | Medium | Medium | Local feedback loop; conservative 0.85 threshold; user-reported corrections |
| macOS notarization delays | Low | High | Maintain Apple Developer account; budget notarization time into release schedule |
| SSAI evolution evading M3U8 rewriting | High | Medium | Treat as ongoing maintenance; fallback muting as last resort |
| Content script breakage on AI tool DOM changes | Medium | Medium | Use semantic selectors, not brittle class names; monitor AI tool DOM on each release |

---

## Patch Surface Summary

| Category | Patches | Risk at Rebase |
|---|---|---|
| Core branding | 4 | Low — touches stable files |
| EagleEye integration | 3–5 | Medium — hooks into network stack |
| Privacy hardening | 7 | Low–Medium |
| UI (NTP, PiP+, toolbar) | 4 | Medium — UI layer changes frequently |
| Video ad blocking | 1 | High — response handler changes with Chromium |
| AI tools | 4 | Medium — side panel API is newer |

**Total: ~23 patches for v1.0–v1.5.** Each patch added increases rebase burden. Prefer GN build flags and runtime configuration over source patches wherever possible.

---

## Key Dependencies & References

| Resource | URL |
|---|---|
| Ungoogled Chromium | github.com/ungoogled-software/ungoogled-chromium |
| Brave patches (reference) | github.com/brave/brave-core |
| Chromium build docs | chromium.googlesource.com/chromium/src/+/main/docs/get_the_code.md |
| Omaha updater | github.com/google/omaha |
| Sparkle (macOS) | github.com/sparkle-project/Sparkle |
| URLRequestInterceptor | source.chromium.org |
| ONNX Runtime | onnxruntime.ai |
| all-MiniLM-L6-v2 | huggingface.co/sentence-transformers/all-MiniLM-L6-v2 |
| Anthropic API | docs.anthropic.com |
| Ollama API | github.com/ollama/ollama/blob/main/docs/api.md |

---

*Roadmap generated from Guard Hero Browser Build Specification v1.2*
*For questions: guardhero.app | kaustubhtalathi@gmail.com*
