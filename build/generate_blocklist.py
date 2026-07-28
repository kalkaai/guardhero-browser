#!/usr/bin/env python3
"""
generate_blocklist.py — Fetch, merge, and deduplicate tracker domain lists
for Guard Hero's EagleEye blocking engine.

Sources (ABP/uBlock filter format):
  - EasyPrivacy       (tracker-focused)
  - EasyList          (ad network domains extracted)
  - uBlock Origin     (combined privacy list)

Output: eagleeye-native/lists/blocklist.txt
  One domain per line, sorted, deduplicated, with section headers.

Usage:
  python3 build/generate_blocklist.py                  # fetch + write
  python3 build/generate_blocklist.py --dry-run        # fetch, print stats, don't write
  python3 build/generate_blocklist.py --output /tmp/bl.txt
  python3 build/generate_blocklist.py --source easyprivacy  # single source
"""

import argparse
import hashlib
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ── Source definitions ────────────────────────────────────────────────────────

SOURCES = {
    "easyprivacy": {
        "url": "https://easylist.to/easylist/easyprivacy.txt",
        "description": "EasyPrivacy — tracker and analytics blocking",
    },
    "easylist": {
        "url": "https://easylist.to/easylist/easylist.txt",
        "description": "EasyList — advertising networks",
    },
    "ublock-privacy": {
        "url": "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt",
        "description": "uBlock Origin — privacy filters",
    },
    "ublock-badware": {
        "url": "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt",
        "description": "uBlock Origin — badware / malware domains",
    },
    "disconnect-tracking": {
        "url": "https://raw.githubusercontent.com/nicowillis/disconnect/master/services.json",
        "description": "Disconnect tracking protection list",
        "format": "disconnect-json",
    },
}

# Known-safe domains that should never be blocked (allowlist guard)
NEVER_BLOCK = frozenset({
    "google.com", "googleapis.com", "gstatic.com",  # CDN — removing breaks sites
    "cloudflare.com", "cloudflare.net",
    "fastly.net", "fastly.com",
    "akamaihd.net", "akamai.net",
    "jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com",
    "fonts.gstatic.com",  # Google Fonts CDN (users may rely on it)
    "github.com", "github.io", "githubusercontent.com",
    "wikipedia.org", "wikimedia.org",
    "archive.org",
})

GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"
RESET  = "\033[0m"
BOLD   = "\033[1m"


def fetch(url: str, timeout: int = 30) -> str | None:
    """Fetch a URL and return the body as text, or None on failure."""
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "GuardHeroBlocklistGenerator/1.0"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except Exception as exc:
        print(f"  {RED}FETCH ERROR{RESET}: {url}\n    {exc}")
        return None


def parse_abp(content: str) -> set[str]:
    """
    Parse ABP/uBlock format filter list and extract pure domain entries.

    Handles:
      ||doubleclick.net^         → doubleclick.net
      ||ads.example.com^$third-party  → ads.example.com
    Skips:
      ## rules (cosmetic)
      @@whitelist rules
      /regex/ rules
      Rules with path components
    """
    domains: set[str] = set()
    for line in content.splitlines():
        line = line.strip()
        # Skip comments, empty, cosmetic, whitelist, and options-only lines
        if not line or line.startswith(("!", "[", "#", "@@", "##", "#@#")):
            continue
        # Only handle ||domain^ pattern (domain-level block)
        if not line.startswith("||"):
            continue
        # Strip leading ||
        line = line[2:]
        # Strip trailing ^ and any options
        if "^" in line:
            line = line[: line.index("^")]
        # Skip if it contains path separators or wildcards
        if "/" in line or "*" in line or "?" in line:
            continue
        # Must look like a domain
        domain = line.lower().strip(".")
        if domain and "." in domain and len(domain) < 128:
            domains.add(domain)
    return domains


def parse_disconnect_json(content: str) -> set[str]:
    """Parse Disconnect services.json format."""
    import json
    domains: set[str] = set()
    try:
        data = json.loads(content)
        categories = data.get("categories", {})
        for category_name, services in categories.items():
            if category_name.lower() in ("content",):
                continue  # Skip CDN/content category
            for service in services:
                for service_name, service_data in service.items():
                    if isinstance(service_data, dict):
                        for url_list in service_data.values():
                            if isinstance(url_list, list):
                                for url in url_list:
                                    d = url.lower().strip("/").strip(".")
                                    if d and "." in d:
                                        domains.add(d)
    except Exception:
        pass
    return domains


def is_valid_domain(domain: str) -> bool:
    """Basic validation — must look like a real domain."""
    if not domain or len(domain) > 253:
        return False
    if domain in NEVER_BLOCK:
        return False
    # Must have at least one dot and no invalid chars
    parts = domain.split(".")
    if len(parts) < 2:
        return False
    for part in parts:
        if not part or not re.match(r'^[a-z0-9\-]+$', part):
            return False
    return True


def main():
    parser = argparse.ArgumentParser(description="Generate Guard Hero EagleEye blocklist")
    parser.add_argument(
        "--output", default=None,
        help="Output path (default: eagleeye-native/lists/blocklist.txt)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Fetch and process but do not write output"
    )
    parser.add_argument(
        "--source", choices=list(SOURCES.keys()), default=None,
        help="Fetch only one source (default: all)"
    )
    parser.add_argument(
        "--min-domains", type=int, default=50_000,
        help="Warn if output has fewer than this many domains (default: 50000)"
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    output_path = Path(args.output) if args.output else \
                  repo_root / "eagleeye-native" / "lists" / "blocklist.txt"

    sources_to_fetch = (
        {args.source: SOURCES[args.source]} if args.source else SOURCES
    )

    print(f"\n{BOLD}Guard Hero — EagleEye Blocklist Generator{RESET}")
    print(f"  Output: {output_path}\n")

    all_domains: set[str] = set()
    source_stats: dict[str, int] = {}

    for source_id, source_info in sources_to_fetch.items():
        url = source_info["url"]
        fmt = source_info.get("format", "abp")
        desc = source_info["description"]

        print(f"  {CYAN}Fetching{RESET} {source_id} — {desc}")
        print(f"    {url}")
        content = fetch(url)
        if not content:
            print(f"    {YELLOW}Skipped (fetch failed){RESET}")
            source_stats[source_id] = 0
            continue

        if fmt == "disconnect-json":
            raw = parse_disconnect_json(content)
        else:
            raw = parse_abp(content)

        valid = {d for d in raw if is_valid_domain(d)}
        new = valid - all_domains
        all_domains |= valid
        source_stats[source_id] = len(new)
        print(f"    {GREEN}+{len(new):,} new domains{RESET} ({len(valid):,} total in source)")

    # Apply NEVER_BLOCK guard
    all_domains -= NEVER_BLOCK

    print(f"\n{BOLD}Total unique domains: {len(all_domains):,}{RESET}")

    if len(all_domains) < args.min_domains:
        print(f"{YELLOW}WARNING: Only {len(all_domains):,} domains — expected {args.min_domains:,}+{RESET}")
        print("         Some sources may have failed. Check network connectivity.")

    if args.dry_run:
        print(f"\n{YELLOW}Dry run — not writing output{RESET}")
        return

    # Build output
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines = [
        "# EagleEye Blocklist",
        "# Guard Hero Browser — https://guardhero.app",
        "# Format: one domain per line",
        f"# Generated: {now}",
        f"# Total domains: {len(all_domains):,}",
        "# Sources:",
    ]
    for source_id, count in source_stats.items():
        lines.append(f"#   {source_id}: +{count:,} domains")
    lines.append("")
    lines.extend(sorted(all_domains))
    lines.append("")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Only write if content changed (avoid spurious git diffs)
    new_content = "\n".join(lines)
    if output_path.exists():
        old_hash = hashlib.sha256(output_path.read_bytes()).hexdigest()
        new_hash = hashlib.sha256(new_content.encode()).hexdigest()
        if old_hash == new_hash:
            print(f"{GREEN}No changes — blocklist is already up to date{RESET}")
            return

    output_path.write_text(new_content, encoding="utf-8")
    print(f"{GREEN}✓ Written: {output_path}{RESET}")
    print(f"  {len(all_domains):,} domains, {len(new_content):,} bytes")


if __name__ == "__main__":
    main()
