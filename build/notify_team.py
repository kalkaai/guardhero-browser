#!/usr/bin/env python3
"""
notify_team.py — Post a Slack webhook notification if Guard Hero is behind
Chromium stable. Reads SLACK_WEBHOOK_URL from environment.

Usage:
  python3 build/notify_team.py
  python3 build/notify_team.py --force   # Post even if up to date
"""

import argparse
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"


def post_slack(webhook_url: str, message: dict) -> bool:
    """POST a message payload to a Slack webhook. Returns True on success."""
    payload = json.dumps(message).encode("utf-8")
    req = urllib.request.Request(
        webhook_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as exc:
        print(f"{RED}Slack POST failed: {exc}{RESET}")
        return False


def build_behind_message(pinned: str, latest: str, days_since_release: int | None = None) -> dict:
    urgency_emoji = "🔴" if (pinned.split(".")[0] != latest.split(".")[0]) else "🟡"
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{urgency_emoji} Guard Hero Browser — Chromium Update Required",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Current pinned:*\n`{pinned}`"},
                {"type": "mrkdwn", "text": f"*Chromium stable:*\n`{latest}`"},
            ],
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    "Guard Hero is behind Chromium stable. "
                    "Security patches may be missing.\n\n"
                    "*Required action:*\n"
                    f"```python3 build/rebase.py --target-version={latest}```"
                ),
            },
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": "Guard Hero CI · check_upstream · <https://github.com/guardhero/guardhero-browser/actions|View CI>",
                }
            ],
        },
    ]
    return {"blocks": blocks}


def build_uptodate_message(version: str) -> dict:
    return {
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"✅ Guard Hero Browser is up to date with Chromium stable `{version}`.",
                },
            }
        ]
    }


def read_pinned_version(repo_root: Path) -> str | None:
    deps_path = repo_root / "DEPS"
    if not deps_path.exists():
        return None
    content = deps_path.read_text()
    m = re.search(r"'chromium_version':\s*'([^']+)'", content)
    return m.group(1) if m else None


def fetch_latest_stable() -> str | None:
    import urllib.request
    try:
        url = "https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Linux&num=1"
        req = urllib.request.Request(url, headers={"User-Agent": "GuardHeroBrowser/notify"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            if data and isinstance(data, list):
                return data[0].get("version")
    except Exception:
        pass
    return None


def version_tuple(v: str) -> tuple[int, ...]:
    try:
        return tuple(int(x) for x in v.split("."))
    except ValueError:
        return (0,)


def main():
    parser = argparse.ArgumentParser(description="Notify Slack if Guard Hero is behind Chromium")
    parser.add_argument("--force", action="store_true", help="Post message even if up to date")
    parser.add_argument("--pinned", help="Override pinned version (for testing)")
    parser.add_argument("--latest", help="Override latest version (for testing)")
    args = parser.parse_args()

    webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook_url:
        print(f"{RED}ERROR: SLACK_WEBHOOK_URL environment variable is not set.{RESET}")
        print("Export it before running:")
        print("  export SLACK_WEBHOOK_URL='https://hooks.slack.com/services/...'")
        sys.exit(1)

    repo_root = Path(__file__).resolve().parent.parent

    pinned = args.pinned or read_pinned_version(repo_root)
    latest = args.latest or fetch_latest_stable()

    if not pinned:
        print(f"{YELLOW}Could not determine pinned version.{RESET}")
        pinned = "unknown"

    if not latest:
        print(f"{RED}Could not fetch latest Chromium stable version.{RESET}")
        sys.exit(2)

    print(f"  Pinned : {pinned}")
    print(f"  Latest : {latest}")

    is_behind = version_tuple(pinned) < version_tuple(latest)

    if is_behind or args.force:
        if is_behind:
            print(f"\n{YELLOW}Guard Hero is behind — posting Slack alert...{RESET}")
            msg = build_behind_message(pinned, latest)
        else:
            print(f"\nForce flag set — posting up-to-date message...")
            msg = build_uptodate_message(latest)

        ok = post_slack(webhook_url, msg)
        if ok:
            print(f"{GREEN}Slack notification sent.{RESET}")
        else:
            print(f"{RED}Failed to send Slack notification.{RESET}")
            sys.exit(1)
    else:
        print(f"\n{GREEN}Guard Hero is up to date. No notification needed.{RESET}")


if __name__ == "__main__":
    main()
