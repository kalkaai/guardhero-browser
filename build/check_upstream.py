#!/usr/bin/env python3
"""
check_upstream.py — Compare Guard Hero's pinned Chromium version against
the current Chromium stable release.

Exit codes:
  0  — Up to date
  1  — Behind (prints alert)
  2  — Could not fetch upstream version
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

OMAHA_URL = "https://omahaproxy.appspot.com/all.json"
CHROMIUM_RELEASES_URL = "https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Linux&num=1"


def fetch_latest_stable() -> str | None:
    """Fetch the latest Chromium stable version string."""
    # Try chromiumdash first (more reliable)
    try:
        req = urllib.request.Request(
            CHROMIUM_RELEASES_URL,
            headers={"User-Agent": "GuardHeroBrowser/check_upstream"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            if data and isinstance(data, list):
                return data[0].get("version")
    except Exception:
        pass

    # Fallback to omahaproxy
    try:
        req = urllib.request.Request(
            OMAHA_URL,
            headers={"User-Agent": "GuardHeroBrowser/check_upstream"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            for platform in data:
                if platform.get("os") == "linux":
                    for version_info in platform.get("versions", []):
                        if version_info.get("channel") == "stable":
                            return version_info.get("version")
    except Exception:
        pass

    return None


def read_pinned_version(repo_root: Path) -> str | None:
    """Read the Chromium version currently pinned in DEPS."""
    deps_path = repo_root / "DEPS"
    if not deps_path.exists():
        return None
    content = deps_path.read_text()
    m = re.search(r"'chromium_version':\s*'([^']+)'", content)
    return m.group(1) if m else None


def version_tuple(v: str) -> tuple[int, ...]:
    """Convert '130.0.6723.116' → (130, 0, 6723, 116)."""
    try:
        return tuple(int(x) for x in v.split("."))
    except ValueError:
        return (0,)


def main():
    repo_root = Path(__file__).resolve().parent.parent

    print(f"\n{BOLD}Guard Hero — Upstream Chromium Check{RESET}")

    pinned = read_pinned_version(repo_root)
    if pinned:
        print(f"  Pinned version : {pinned}")
    else:
        print(f"  {YELLOW}Could not read pinned version from DEPS{RESET}")

    print(f"  Fetching latest Chromium stable ...", end=" ", flush=True)
    latest = fetch_latest_stable()

    if not latest:
        print(f"{RED}FAILED{RESET}")
        print(f"\n{RED}Could not fetch upstream Chromium version.{RESET}")
        print("Check network connectivity and try again.\n")
        sys.exit(2)

    print(f"{GREEN}{latest}{RESET}")

    if not pinned:
        print(f"\n{YELLOW}Cannot compare — pinned version unknown.{RESET}\n")
        sys.exit(0)

    pinned_t = version_tuple(pinned)
    latest_t = version_tuple(latest)

    if pinned_t >= latest_t:
        print(f"\n{GREEN}✓ Guard Hero is up to date (pinned={pinned}, stable={latest}){RESET}\n")
        sys.exit(0)
    else:
        # Calculate how many minor/patch versions behind
        behind_major = latest_t[0] - pinned_t[0]
        print(f"\n{RED}{'='*50}{RESET}")
        print(f"{RED}⚠  GUARD HERO IS BEHIND CHROMIUM STABLE{RESET}")
        print(f"{RED}{'='*50}{RESET}")
        print(f"  Current pinned : {YELLOW}{pinned}{RESET}")
        print(f"  Latest stable  : {GREEN}{latest}{RESET}")
        if behind_major > 0:
            print(f"  {RED}CRITICAL: {behind_major} major version(s) behind!{RESET}")
        print()
        print("Action required:")
        print(f"  python3 build/rebase.py --target-version={latest}")
        print()
        sys.exit(1)


if __name__ == "__main__":
    main()
