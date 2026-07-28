#!/usr/bin/env python3
"""
apply_gh_patches.py — Apply Guard Hero patches on top of Chromium source.

Usage:
  python3 build/apply_gh_patches.py [--patches-dir patches/] [--src-dir src/]
  python3 build/apply_gh_patches.py --dry-run
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

PATCH_ORDER = [
    # core — branding, schemes, defaults
    "core/001-branding-product-name.patch",
    "core/002-custom-url-schemes.patch",
    "core/003-remove-google-branding.patch",
    "core/004-default-settings.patch",
    # eagleeye — native blocking engine
    "eagleeye/010-add-interceptor-interface.patch",
    "eagleeye/011-register-eagleeye-in-network-service.patch",
    "eagleeye/012-add-toolbar-button.patch",
    "eagleeye/014-eagleeye-redirect-job.patch",
    # privacy — hardening beyond ungoogled
    "privacy/020-disable-safe-browsing-ui.patch",
    "privacy/021-canvas-fingerprint-noise.patch",
    "privacy/022-block-battery-api.patch",
    "privacy/023-disable-uma-metrics.patch",
    "privacy/024-disable-webrtc-nonproxied-udp.patch",
    # ui — NTP, settings
    "ui/030-newtab-page-override.patch",
    "ui/031-settings-page-additions.patch",
    # ai — AI tools integration
    "ai/040-ai-panel-sidebar.patch",
    "ai/041-tab-semantic-indexer.patch",
    "ai/042-reader-mode-bridge.patch",
    "ai/043-pii-detector-hook.patch",
]

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"
BOLD = "\033[1m"


def run(cmd: list[str], cwd: str | None = None, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=check)


def check_patch(patch_path: str, src_dir: str, dry_run: bool = False) -> bool:
    """Check whether a patch can be applied cleanly."""
    cmd = ["git", "apply", "--check", patch_path]
    result = run(cmd, cwd=src_dir, check=False)
    return result.returncode == 0


def apply_patch(patch_path: str, src_dir: str) -> tuple[bool, str]:
    """Apply a single patch. Returns (success, error_message)."""
    cmd = ["git", "apply", "--whitespace=fix", patch_path]
    result = run(cmd, cwd=src_dir, check=False)
    if result.returncode != 0:
        return False, result.stderr.strip()
    return True, ""


def main():
    parser = argparse.ArgumentParser(description="Apply Guard Hero patches to Chromium source")
    parser.add_argument("--patches-dir", default="patches", help="Path to patches directory")
    parser.add_argument("--src-dir", default="src", help="Path to Chromium source directory")
    parser.add_argument("--dry-run", action="store_true", help="Check patches without applying")
    parser.add_argument("--stop-on-error", action="store_true", help="Abort on first failure")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    patches_dir = repo_root / args.patches_dir
    src_dir = repo_root / args.src_dir

    if not patches_dir.exists():
        print(f"{RED}ERROR: patches directory not found: {patches_dir}{RESET}")
        sys.exit(1)

    if not src_dir.exists():
        print(f"{RED}ERROR: Chromium source directory not found: {src_dir}{RESET}")
        print("Run: gclient sync --with_branch_heads --with_tags")
        sys.exit(1)

    mode = "DRY RUN" if args.dry_run else "APPLYING"
    print(f"\n{BOLD}Guard Hero Patch Manager — {mode}{RESET}")
    print(f"  Patches dir : {patches_dir}")
    print(f"  Chromium src: {src_dir}\n")

    applied = []
    failed = []
    skipped = []

    for rel_path in PATCH_ORDER:
        patch_path = patches_dir / rel_path
        if not patch_path.exists():
            print(f"  {YELLOW}SKIP{RESET}  {rel_path}  (file not found)")
            skipped.append(rel_path)
            continue

        if args.dry_run:
            ok = check_patch(str(patch_path), str(src_dir))
            status = f"{GREEN}CLEAN{RESET}" if ok else f"{RED}CONFLICT{RESET}"
            print(f"  {status}  {rel_path}")
            if not ok:
                failed.append(rel_path)
        else:
            print(f"  Applying {rel_path} ...", end=" ", flush=True)
            ok, err = apply_patch(str(patch_path), str(src_dir))
            if ok:
                print(f"{GREEN}OK{RESET}")
                applied.append(rel_path)
            else:
                print(f"{RED}FAILED{RESET}")
                if args.verbose or True:
                    for line in err.splitlines():
                        print(f"    {line}")
                failed.append(rel_path)
                if args.stop_on_error:
                    print(f"\n{RED}Aborting due to --stop-on-error{RESET}")
                    break

    print(f"\n{BOLD}Summary{RESET}")
    if not args.dry_run:
        print(f"  Applied : {GREEN}{len(applied)}{RESET}")
    print(f"  Skipped : {YELLOW}{len(skipped)}{RESET}")
    print(f"  Failed  : {RED}{len(failed)}{RESET}")

    if failed:
        print(f"\n{RED}Conflicts requiring manual resolution:{RESET}")
        for f in failed:
            print(f"  - {f}")
        print("\nTo resolve: edit the target file, then run:")
        print("  git add <file> && git am --continue")
        sys.exit(1)

    print(f"\n{GREEN}All patches applied successfully.{RESET}\n")


if __name__ == "__main__":
    main()
