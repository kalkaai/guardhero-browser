# Guard Hero Browser — Rebase Procedure

Maintaining a Chromium fork requires **rebasing** — updating our patches to apply cleanly on top of each new Chromium stable release. This is the most operationally critical procedure in the Guard Hero engineering workflow.

---

## Why Rebasing Matters

Chromium releases a new stable version approximately every 4 weeks. Each release contains security fixes. For a privacy-focused browser, shipping a version of Guard Hero built on an outdated Chromium is a trust violation — our users rely on us to protect them, and unpatched CVEs undermine that.

**Our SLA:**
- Security releases: Rebased and shipped within **48 hours**
- Regular stable releases: Within **1 week**
- Blocklist updates: Every 6 hours (automated, no rebase needed)

---

## Principles

**1. Minimize patch surface.** Every line of custom code we add is a future rebase conflict. Ask: "Can this be a build flag instead of a code patch?" before writing code.

**2. Never modify generated files.** GRD, GRDP, and other generated files change between Chromium versions. Only modify their source files.

**3. Tag each patch with the file it touches.** The patch filename includes the category and file to make triage fast.

**4. One concern per patch.** Small, focused patches are far easier to rebase than large ones.

**5. Prefer upstream solutions.** If Chromium ships a feature that replaces a patch (e.g., adds a privacy toggle), delete our patch and use theirs.

---

## Automated Rebase Check

GitHub Actions runs a rebase check every Monday at 02:00 UTC:

```yaml
schedule:
  - cron: "0 2 * * 1"
```

The check:
1. Fetches the current Chromium stable version from chromiumdash.appspot.com
2. Compares against the version pinned in `DEPS`
3. Posts a Slack alert if Guard Hero is behind

You can also run it manually:
```bash
python3 build/check_upstream.py
```

---

## Rebase Procedure

### 1. Identify the target version

Find the latest Chromium stable version:
```bash
python3 build/check_upstream.py
# Example output:
#   Pinned version : 128.0.6613.119
#   Latest stable  : 130.0.6723.116
#   ⚠  GUARD HERO IS BEHIND CHROMIUM STABLE
```

### 2. Run the automated rebase script

```bash
python3 build/rebase.py --target-version=130.0.6723.116
```

This script:
1. Updates `DEPS` with the new Chromium revision
2. Runs `gclient sync` to download the new source
3. Applies ungoogled-chromium patches
4. Applies Guard Hero patches in order
5. Runs smoke tests

### 3. Resolve patch conflicts

If the script reports conflicts:

```
  FAILED  core/001-branding-product-name.patch
  Error: patch failed: chrome/app/chromium_strings.grd:23
```

Navigate to the Chromium source and resolve:

```bash
cd src

# Apply the conflicting patch with --reject to see what failed
git apply ../patches/core/001-branding-product-name.patch --reject

# The .rej file shows what couldn't be applied automatically
# Open both the target file and the .rej file
# Manually apply the desired changes

# Once resolved:
git add chrome/app/chromium_strings.grd

# Update the patch file to reflect the new context:
git diff HEAD chrome/app/chromium_strings.grd > ../patches/core/001-branding-product-name.patch.new
mv ../patches/core/001-branding-product-name.patch.new \
   ../patches/core/001-branding-product-name.patch

# Continue applying remaining patches:
cd ..
python3 build/apply_gh_patches.py
```

### 4. Common conflict patterns

**String resource files (GRD):** Chromium often reorders strings or adds new ones. Our branding patches add strings at specific line numbers. Solution: re-locate our insertion point relative to a stable nearby string, not a line number.

**Feature flags:** Chromium frequently reorganizes feature flag files. Our privacy patches may disable features in new locations. Solution: search the new codebase for the feature name, update the patch.

**Build files (BUILD.gn, GNI):** Target names and file locations change. Solution: find the new home of the target we're modifying.

**UI code:** Chromium's Views UI code changes frequently. Our toolbar button and popup patches are the most likely to conflict here. Solution: check what changed in `chrome/browser/ui/views/toolbar/` and re-apply.

### 5. Verify the build

After resolving all conflicts:

```bash
# Full build
autoninja -C out/Release chrome

# Run Guard Hero unit tests
autoninja -C out/Release unit_tests
./out/Release/unit_tests --gtest_filter=GuardHero*

# Manual smoke test: launch and check EagleEye loads
./out/Release/chrome --enable-logging --v=1 2>&1 | grep "Guard Hero"
```

### 6. Update the changelog and tag

```bash
# Update version references
echo "1.0.1" > VERSION

# Commit
git add DEPS VERSION patches/
git commit -m "chore: rebase onto Chromium 130.0.6723.116

- Updated Chromium base from 128.0.6613.119 → 130.0.6723.116
- Resolved conflicts in core/001, privacy/021
- All 14 patches apply cleanly"

# Tag
git tag -a "v1.0.1-cr130" -m "Guard Hero 1.0.1 based on Chromium 130"
git push origin main --tags
```

### 7. Trigger CI

Push triggers the full CI build. Monitor `.github/workflows/build.yml` for build/test results before shipping.

---

## Emergency Security Rebase

If a Chromium security CVE is critical (e.g., 0-day in V8):

1. **Immediately** run `check_upstream.py` — confirm we're behind
2. Notify the team via Slack (the `notify_team.py` script does this automatically)
3. Assign one engineer to rebase ONLY — skip feature work
4. Target: **shipping within 48 hours**
5. If a critical conflict cannot be resolved in time, consider a binary patch (backport the specific CVE fix) while the full rebase completes

---

## Monitoring Drift

The `rebase-check` GitHub Actions job blocks PR merges when Guard Hero is behind. This prevents shipping new features on an outdated base.

To check drift locally at any time:
```bash
python3 build/check_upstream.py && echo "Up to date ✓" || echo "Rebase needed ⚠"
```
