#!/usr/bin/env python3
"""
rebase.py — Rebase Guard Hero patches to a new Chromium stable version.

Usage:
  python3 build/rebase.py --target-version=130.0.6723.116

Steps performed:
  1. Update DEPS file with new Chromium revision
  2. Run gclient sync
  3. Apply ungoogled-chromium patches (if present)
  4. Apply Guard Hero patches in order
  5. Run smoke tests
  6. Report patch conflicts for manual resolution
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

CHROMIUM_REVISION_MAP_URL = (
    "https://omahaproxy.appspot.com/deps.json?version={version}"
)


def run(cmd: list[str], cwd: str | None = None, check: bool = True,
        capture: bool = True) -> subprocess.CompletedProcess:
    print(f"  $ {' '.join(cmd)}")
    return subprocess.run(
        cmd, cwd=cwd,
        capture_output=capture,
        text=True,
        check=check,
    )


def update_deps(deps_path: Path, new_version: str, new_revision: str) -> None:
    """Patch the DEPS file with the new Chromium revision."""
    content = deps_path.read_text()
    # Replace chromium_version
    content = re.sub(
        r"'chromium_version':\s*'[^']+'",
        f"'chromium_version': '{new_version}'",
        content,
    )
    # Replace chromium_git revision
    content = re.sub(
        r"(chromium/src\.git@)[0-9a-f]+",
        rf"\g<1>{new_revision}",
        content,
    )
    deps_path.write_text(content)
    print(f"  {GREEN}DEPS updated{RESET}: version={new_version} rev={new_revision[:12]}...")


def fetch_revision_for_version(version: str) -> str | None:
    """Attempt to fetch the git revision for a Chromium version from omahaproxy."""
    try:
        import urllib.request
        url = CHROMIUM_REVISION_MAP_URL.format(version=version)
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read())
            return data.get("chromium_base_position") or data.get("v8_revision")
    except Exception as exc:
        print(f"  {YELLOW}Could not fetch revision automatically: {exc}{RESET}")
        return None


def run_gclient_sync(src_dir: Path) -> bool:
    print(f"\n{BOLD}Step 2: gclient sync{RESET}")
    result = subprocess.run(
        ["gclient", "sync", "--with_branch_heads", "--with_tags"],
        cwd=src_dir.parent,
        check=False,
    )
    return result.returncode == 0


def apply_patches_script(repo_root: Path, stop_on_error: bool = False) -> bool:
    print(f"\n{BOLD}Step 4: Apply Guard Hero patches{RESET}")
    cmd = [sys.executable, str(repo_root / "build" / "apply_gh_patches.py")]
    if stop_on_error:
        cmd.append("--stop-on-error")
    result = subprocess.run(cmd, cwd=repo_root, check=False)
    return result.returncode == 0


def run_smoke_tests(repo_root: Path) -> bool:
    print(f"\n{BOLD}Step 5: Smoke tests{RESET}")
    test_script = repo_root / "tests" / "smoke_test.py"
    if not test_script.exists():
        print(f"  {YELLOW}No smoke tests found at tests/smoke_test.py — skipping{RESET}")
        return True
    result = subprocess.run([sys.executable, str(test_script)], cwd=repo_root, check=False)
    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="Rebase Guard Hero to a new Chromium version")
    parser.add_argument("--target-version", required=True,
                        help="Target Chromium version, e.g. 130.0.6723.116")
    parser.add_argument("--revision",
                        help="Explicit git revision SHA (optional; auto-fetched if omitted)")
    parser.add_argument("--skip-sync", action="store_true",
                        help="Skip gclient sync (useful when already synced)")
    parser.add_argument("--skip-tests", action="store_true",
                        help="Skip smoke tests after rebasing")
    parser.add_argument("--stop-on-patch-error", action="store_true",
                        help="Abort on first patch conflict")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    deps_path = repo_root / "DEPS"
    src_dir   = repo_root / "src"

    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}Guard Hero Rebase — Target: {args.target_version}{RESET}")
    print(f"{BOLD}{'='*60}{RESET}\n")

    # Step 1: Resolve revision
    print(f"{BOLD}Step 1: Resolve Chromium revision{RESET}")
    revision = args.revision
    if not revision:
        revision = fetch_revision_for_version(args.target_version)
    if not revision:
        print(f"  {YELLOW}WARNING: Could not resolve git revision. DEPS will use placeholder.{RESET}")
        revision = "REVISION_UNKNOWN_UPDATE_MANUALLY"

    # Step 1b: Update DEPS
    if deps_path.exists():
        update_deps(deps_path, args.target_version, revision)
    else:
        print(f"  {YELLOW}DEPS file not found — skipping DEPS update{RESET}")

    # Step 2: gclient sync
    if not args.skip_sync:
        ok = run_gclient_sync(src_dir)
        if not ok:
            print(f"\n{RED}gclient sync failed. Fix errors and re-run with --skip-sync.{RESET}")
            sys.exit(1)
        print(f"  {GREEN}gclient sync complete{RESET}")
    else:
        print(f"\n{BOLD}Step 2: gclient sync{RESET}  {YELLOW}[skipped]{RESET}")

    # Step 3: Apply ungoogled-chromium patches
    print(f"\n{BOLD}Step 3: Apply ungoogled-chromium patches{RESET}")
    ug_utils = repo_root / "src" / "utils" / "patches.py"
    if ug_utils.exists():
        result = subprocess.run([sys.executable, str(ug_utils), "apply"],
                                cwd=repo_root / "src", check=False)
        if result.returncode != 0:
            print(f"  {RED}ungoogled patches failed — resolve manually{RESET}")
        else:
            print(f"  {GREEN}ungoogled patches applied{RESET}")
    else:
        print(f"  {YELLOW}ungoogled-chromium patches not found — skipping{RESET}")

    # Step 4: Guard Hero patches
    ok = apply_patches_script(repo_root, args.stop_on_patch_error)
    if not ok:
        print(f"\n{RED}Patch application had conflicts. Resolve manually then continue.{RESET}")
        print("After resolving:")
        print("  git add <files>")
        print("  python3 build/apply_gh_patches.py  (re-run to apply remaining)")
        sys.exit(2)

    # Step 5: Smoke tests
    if not args.skip_tests:
        ok = run_smoke_tests(repo_root)
        if not ok:
            print(f"\n{RED}Smoke tests failed.{RESET}")
            sys.exit(3)
    else:
        print(f"\n{BOLD}Step 5: Smoke tests{RESET}  {YELLOW}[skipped]{RESET}")

    print(f"\n{GREEN}{BOLD}Rebase to {args.target_version} complete!{RESET}")
    print("Next steps:")
    print("  1. Run full build: autoninja -C out/Release chrome")
    print("  2. Tag release: git tag -a v{args.target_version}-gh1")
    print("  3. Push: git push origin main --tags\n")


if __name__ == "__main__":
    main()
