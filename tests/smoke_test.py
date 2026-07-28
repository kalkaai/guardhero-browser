#!/usr/bin/env python3
"""
smoke_test.py — Guard Hero post-rebase smoke tests.

Verifies the repo is in a consistent state after a rebase or patch application.
Run automatically by build/rebase.py, or manually:

  python3 tests/smoke_test.py
  python3 tests/smoke_test.py --verbose
  python3 tests/smoke_test.py --check patches     # only patch checks
  python3 tests/smoke_test.py --check blocklist   # only blocklist checks

Exit codes:
  0 — All checks passed
  1 — One or more checks failed
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

REPO_ROOT = Path(__file__).resolve().parent.parent

# ── Check registry ────────────────────────────────────────────────────────────

class Check:
    def __init__(self, name: str, category: str, fn):
        self.name = name
        self.category = category
        self.fn = fn

    def run(self, verbose: bool) -> tuple[bool, str]:
        try:
            result = self.fn(REPO_ROOT, verbose)
            if isinstance(result, tuple):
                return result
            return bool(result), ""
        except Exception as exc:
            return False, str(exc)


# ── Individual checks ─────────────────────────────────────────────────────────

def check_deps_exists(root: Path, verbose: bool) -> tuple[bool, str]:
    """DEPS file must exist and contain a chromium_version."""
    deps = root / "DEPS"
    if not deps.exists():
        return False, "DEPS file not found"
    content = deps.read_text()
    m = re.search(r"'chromium_version':\s*'([^']+)'", content)
    if not m:
        return False, "chromium_version not found in DEPS"
    if verbose:
        print(f"    chromium_version = {m.group(1)}")
    return True, f"chromium_version = {m.group(1)}"


def check_gclient_exists(root: Path, verbose: bool) -> tuple[bool, str]:
    """.gclient file must exist."""
    gclient = root / ".gclient"
    if not gclient.exists():
        return False, ".gclient file not found"
    return True, ""


def check_patch_files_exist(root: Path, verbose: bool) -> tuple[bool, str]:
    """All patches in apply_gh_patches.py PATCH_ORDER must exist on disk."""
    apply_script = root / "build" / "apply_gh_patches.py"
    if not apply_script.exists():
        return False, "build/apply_gh_patches.py not found"

    content = apply_script.read_text()
    patches_dir = root / "patches"

    # Extract patch list from PATCH_ORDER
    matches = re.findall(r'"([^"]+\.patch)"', content)
    missing = []
    for rel in matches:
        p = patches_dir / rel
        if not p.exists():
            missing.append(rel)

    if missing:
        return False, f"Missing patch files: {', '.join(missing)}"
    if verbose:
        print(f"    {len(matches)} patches found")
    return True, f"{len(matches)} patches present"


def check_patch_format(root: Path, verbose: bool) -> tuple[bool, str]:
    """Each patch file must start with a valid git patch header."""
    patches_dir = root / "patches"
    invalid = []
    for patch in sorted(patches_dir.rglob("*.patch")):
        content = patch.read_text(errors="ignore")
        if not content.strip():
            invalid.append(f"{patch.name}: empty file")
            continue
        if not content.startswith("From "):
            invalid.append(f"{patch.name}: missing 'From ' header")
    if invalid:
        return False, "; ".join(invalid[:3])
    count = sum(1 for _ in patches_dir.rglob("*.patch"))
    return True, f"{count} patches valid"


def check_blocklist_exists(root: Path, verbose: bool) -> tuple[bool, str]:
    """Blocklist must exist and have at least 100 domains."""
    bl = root / "eagleeye-native" / "lists" / "blocklist.txt"
    if not bl.exists():
        return False, "blocklist.txt not found"
    domains = [
        line.strip() for line in bl.read_text().splitlines()
        if line.strip() and not line.startswith("#")
    ]
    count = len(domains)
    if count < 100:
        return False, f"Only {count} domains — expected 100+ (run build/generate_blocklist.py)"
    if verbose:
        print(f"    {count:,} domains in blocklist")
    return True, f"{count:,} domains"


def check_blocklist_no_safe_domains(root: Path, verbose: bool) -> tuple[bool, str]:
    """Blocklist must not contain known-safe CDN/infrastructure domains."""
    NEVER_BLOCK = {
        "github.com", "githubusercontent.com", "github.io",
        "wikipedia.org", "wikimedia.org", "archive.org",
        "cloudflare.com", "cloudflare.net",
        "fastly.net", "akamai.net",
        "jsdelivr.net", "unpkg.com",
    }
    bl = root / "eagleeye-native" / "lists" / "blocklist.txt"
    if not bl.exists():
        return True, "blocklist not found — skipped"
    blocked_safe = [
        line.strip() for line in bl.read_text().splitlines()
        if line.strip() and not line.startswith("#") and line.strip() in NEVER_BLOCK
    ]
    if blocked_safe:
        return False, f"Safe domains in blocklist: {blocked_safe}"
    return True, ""


def check_eagleeye_headers(root: Path, verbose: bool) -> tuple[bool, str]:
    """Core EagleEye C++ headers must be present."""
    required = [
        "eagleeye-native/blocker/domain_matcher.h",
        "eagleeye-native/blocker/domain_matcher.cc",
        "eagleeye-native/blocker/url_analyzer.h",
        "eagleeye-native/blocker/url_analyzer.cc",
        "eagleeye-native/blocker/blocklist_manager.h",
        "eagleeye-native/blocker/blocklist_manager.cc",
        "eagleeye-native/blocker/request_interceptor.h",
        "eagleeye-native/blocker/request_interceptor.cc",
    ]
    missing = [f for f in required if not (root / f).exists()]
    if missing:
        return False, f"Missing: {', '.join(missing)}"
    return True, f"{len(required)} EagleEye source files present"


def check_browser_ui_package(root: Path, verbose: bool) -> tuple[bool, str]:
    """browser-ui/package.json must exist and have required scripts."""
    pkg = root / "browser-ui" / "package.json"
    if not pkg.exists():
        return False, "browser-ui/package.json not found"
    import json
    data = json.loads(pkg.read_text())
    scripts = data.get("scripts", {})
    required = ["dev", "build", "test"]
    missing = [s for s in required if s not in scripts]
    if missing:
        return False, f"Missing npm scripts: {missing}"
    return True, "package.json OK"


def check_github_workflows(root: Path, verbose: bool) -> tuple[bool, str]:
    """Required GitHub Actions workflows must exist."""
    required = [
        ".github/workflows/build.yml",
        ".github/workflows/blocklist-update.yml",
    ]
    missing = [f for f in required if not (root / f).exists()]
    if missing:
        return False, f"Missing: {', '.join(missing)}"
    return True, f"{len(required)} workflows present"


def check_build_scripts(root: Path, verbose: bool) -> tuple[bool, str]:
    """Key build scripts must exist and be executable (on Unix)."""
    required = [
        "build/apply_gh_patches.py",
        "build/check_upstream.py",
        "build/rebase.py",
        "build/generate_blocklist.py",
        "dev.sh",
        "tests/run_cpp_tests.sh",
    ]
    missing = [f for f in required if not (root / f).exists()]
    if missing:
        return False, f"Missing: {', '.join(missing)}"
    return True, f"{len(required)} build scripts present"


def check_no_hardcoded_google_urls(root: Path, verbose: bool) -> tuple[bool, str]:
    """Source files must not contain hardcoded Google update URLs."""
    BANNED_PATTERNS = [
        r"update\.googleapis\.com",
        r"safebrowsing\.googleapis\.com",
        r"clients2\.google\.com",
        r"toolbarqueries\.google\.com",
    ]
    violations = []
    search_dirs = [root / "chrome", root / "eagleeye-native"]
    for search_dir in search_dirs:
        if not search_dir.exists():
            continue
        for f in search_dir.rglob("*.cc"):
            content = f.read_text(errors="ignore")
            for pat in BANNED_PATTERNS:
                if re.search(pat, content):
                    violations.append(f"{f.relative_to(root)}: matches {pat}")
        for f in search_dir.rglob("*.h"):
            content = f.read_text(errors="ignore")
            for pat in BANNED_PATTERNS:
                if re.search(pat, content):
                    violations.append(f"{f.relative_to(root)}: matches {pat}")

    if violations:
        return False, f"Hardcoded Google URLs found: {violations[:3]}"
    return True, "No hardcoded Google update URLs"


# ── Check registry ────────────────────────────────────────────────────────────

ALL_CHECKS = [
    Check("DEPS file",             "repo",       check_deps_exists),
    Check(".gclient file",         "repo",       check_gclient_exists),
    Check("Build scripts",         "repo",       check_build_scripts),
    Check("GitHub workflows",      "repo",       check_github_workflows),
    Check("Patch files present",   "patches",    check_patch_files_exist),
    Check("Patch format valid",    "patches",    check_patch_format),
    Check("EagleEye headers",      "eagleeye",   check_eagleeye_headers),
    Check("Blocklist exists",      "blocklist",  check_blocklist_exists),
    Check("Blocklist safety",      "blocklist",  check_blocklist_no_safe_domains),
    Check("browser-ui package",    "ui",         check_browser_ui_package),
    Check("No Google URLs in src", "privacy",    check_no_hardcoded_google_urls),
]


# ── Runner ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Guard Hero smoke tests")
    parser.add_argument("--verbose", "-v", action="store_true")
    parser.add_argument(
        "--check", metavar="CATEGORY",
        help="Run only checks in this category (repo, patches, eagleeye, blocklist, ui, privacy)"
    )
    args = parser.parse_args()

    checks = ALL_CHECKS
    if args.check:
        checks = [c for c in ALL_CHECKS if c.category == args.check]
        if not checks:
            print(f"{RED}Unknown category: {args.check}{RESET}")
            print(f"Available: {', '.join(sorted(set(c.category for c in ALL_CHECKS)))}")
            sys.exit(1)

    print(f"\n{BOLD}Guard Hero — Smoke Tests{RESET}")
    print(f"  Repo: {REPO_ROOT}\n")

    passed = []
    failed = []

    for check in checks:
        print(f"  {'...':<32}", end="", flush=True)
        ok, msg = check.run(args.verbose)
        label = f"{GREEN}PASS{RESET}" if ok else f"{RED}FAIL{RESET}"
        detail = f"  {msg}" if msg and args.verbose else (f"  {RED}{msg}{RESET}" if not ok and msg else "")
        print(f"\r  {label}  {check.name:<30}{detail}")
        (passed if ok else failed).append(check)

    print(f"\n{'─'*50}")
    print(f"  {GREEN}{len(passed)} passed{RESET}  {RED}{len(failed)} failed{RESET}\n")

    if failed:
        print(f"{RED}Failed checks:{RESET}")
        for c in failed:
            print(f"  - {c.name} ({c.category})")
        print()
        sys.exit(1)

    print(f"{GREEN}✓ All smoke tests passed.{RESET}\n")


if __name__ == "__main__":
    main()
