# Guard Hero Browser — DEPS
# Chromium source is fetched via gclient using this file.
# Update chromium_version and the revision in deps{} when rebasing.

use_relative_paths = True
use_relative_hooks = True

gclient_gn_args_file = 'build/config/gclient_args.gni'
gclient_gn_args = [
  'checkout_nacl',
  'checkout_pgo_profiles',
]

vars = {
  # ─── Chromium version ────────────────────────────────────────────
  # Update both values when rebasing. Use build/rebase.py to automate.
  'chromium_version': '130.0.6723.116',

  # Git revision corresponding to the version above.
  # Find via: https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Linux&num=1
  'chromium_revision': '4dac0db39f7c2b4e3b3fe7ad1fb8cbfab5c7a3a8',

  # ─── Ungoogled Chromium patches ──────────────────────────────────
  'ungoogled_chromium_revision': '130.0.6723.116-1',

  # ─── Guard Hero version ──────────────────────────────────────────
  'guardhero_version': '1.0.0',

  # ─── Repository roots ────────────────────────────────────────────
  'chromium_git': 'https://chromium.googlesource.com',
  'guardhero_git': 'https://github.com/guardhero',

  # ─── Build flags (overridable via gn args) ───────────────────────
  'checkout_nacl': False,
  'checkout_pgo_profiles': True,
}

deps = {
  # ─── Chromium source ─────────────────────────────────────────────
  'src': {
    'url': '{chromium_git}/chromium/src.git@{chromium_revision}',
    'condition': 'True',
  },

  # ─── depot_tools (build tooling) ─────────────────────────────────
  'src/third_party/depot_tools': {
    'url': '{chromium_git}/chromium/tools/depot_tools.git@main',
    'condition': 'True',
  },

  # ─── Node.js binaries (for browser-ui build) ─────────────────────
  'src/third_party/node': {
    'url': '{chromium_git}/chromium/src/third_party/node@HEAD',
    'condition': 'True',
  },
}

hooks = [
  # Verify Python version
  {
    'name': 'check_python',
    'pattern': '.',
    'action': [
      'python3', '-c',
      'import sys; assert sys.version_info >= (3, 9), "Python 3.9+ required"'
    ],
  },

  # Build browser-ui assets after sync
  {
    'name': 'build_browser_ui',
    'pattern': 'browser-ui/',
    'action': [
      'bash', '-c',
      'cd browser-ui && npm ci && npm run build',
    ],
    'condition': 'host_os == "linux" or host_os == "mac"',
  },

  # Windows variant
  {
    'name': 'build_browser_ui_win',
    'pattern': 'browser-ui/',
    'action': [
      'cmd', '/c',
      'cd browser-ui && npm ci && npm run build',
    ],
    'condition': 'host_os == "win"',
  },
]

recursedeps = [
  # Pull in Chromium's own DEPS recursively
  ['src', 'DEPS'],
]
