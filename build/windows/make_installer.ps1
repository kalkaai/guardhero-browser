#Requires -Version 5.1
<#
.SYNOPSIS
    Guard Hero Browser — Windows NSIS installer builder.

.DESCRIPTION
    Stages the built Chrome output from out\Release\, runs the NSIS compiler
    to produce GuardHeroBrowser-Setup-x64.exe, and optionally signs the
    installer if $env:CODE_SIGNING_CERT is set.

.PARAMETER BuildDir
    Path to the Chromium build output directory. Defaults to "out\Release".

.PARAMETER OutputDir
    Where to place the final installer. Defaults to "dist\windows".

.PARAMETER Version
    Product version string. Defaults to "1.0.0".

.EXAMPLE
    .\make_installer.ps1
    .\make_installer.ps1 -BuildDir "out\Release" -Version "1.0.1"
#>

[CmdletBinding()]
param(
    [string]$BuildDir   = "out\Release",
    [string]$OutputDir  = "dist\windows",
    [string]$Version    = "1.0.0"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Constants ─────────────────────────────────────────────────────────────────
$PRODUCT_NAME     = "Guard Hero Browser"
$EXE_NAME         = "guardhero-browser.exe"
$INSTALLER_NAME   = "GuardHeroBrowser-Setup-x64.exe"
$NSI_SCRIPT       = "installer\windows\guardhero.nsi"
$STAGING_DIR      = "dist\windows\staging"

# Binaries that must be present in the build output
$REQUIRED_BINARIES = @(
    "chrome.exe",
    "chrome.dll",
    "chrome_elf.dll",
    "chrome_100_percent.pak",
    "chrome_200_percent.pak",
    "resources.pak",
    "icudtl.dat",
    "v8_context_snapshot.bin",
    "snapshot_blob.bin"
)

# ── Helpers ───────────────────────────────────────────────────────────────────
function Write-Step([string]$msg) {
    Write-Host "`n==> $msg" -ForegroundColor Cyan
}

function Write-Success([string]$msg) {
    Write-Host "    [OK] $msg" -ForegroundColor Green
}

function Write-Fail([string]$msg) {
    Write-Host "    [FAIL] $msg" -ForegroundColor Red
    exit 1
}

function Require-Command([string]$cmd) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Fail "$cmd not found on PATH. Please install it and retry."
    }
}

# ── Resolve paths relative to repo root ───────────────────────────────────────
$RepoRoot = (Resolve-Path "$PSScriptRoot\..\.." -ErrorAction SilentlyContinue).Path
if (-not $RepoRoot) {
    $RepoRoot = (Get-Location).Path
}
$BuildDir   = Join-Path $RepoRoot $BuildDir
$OutputDir  = Join-Path $RepoRoot $OutputDir
$StagingDir = Join-Path $RepoRoot $STAGING_DIR
$NsiScript  = Join-Path $RepoRoot $NSI_SCRIPT

# ── Step 1: Validate build output ─────────────────────────────────────────────
Write-Step "Validating build output in: $BuildDir"

if (-not (Test-Path $BuildDir)) {
    Write-Fail "Build directory not found: $BuildDir`nRun: autoninja -C out\Release chrome"
}

foreach ($bin in $REQUIRED_BINARIES) {
    $binPath = Join-Path $BuildDir $bin
    if (-not (Test-Path $binPath)) {
        Write-Fail "Required binary missing: $binPath"
    }
    Write-Success $bin
}

# ── Step 2: Create staging directory ─────────────────────────────────────────
Write-Step "Creating staging directory: $StagingDir"

if (Test-Path $StagingDir) {
    Remove-Item $StagingDir -Recurse -Force
}
New-Item -ItemType Directory -Path $StagingDir | Out-Null

$SubDirs = @("", "locales", "swiftshader")
foreach ($sub in $SubDirs) {
    $path = if ($sub) { Join-Path $StagingDir $sub } else { $StagingDir }
    New-Item -ItemType Directory -Path $path -Force | Out-Null
}
Write-Success "Staging structure created"

# ── Step 3: Copy binaries ─────────────────────────────────────────────────────
Write-Step "Copying binaries to staging"

# Core binaries (rename chrome.exe → guardhero-browser.exe)
foreach ($bin in $REQUIRED_BINARIES) {
    $src  = Join-Path $BuildDir $bin
    $dest = if ($bin -eq "chrome.exe") {
        Join-Path $StagingDir $EXE_NAME
    } else {
        Join-Path $StagingDir $bin
    }
    Copy-Item $src $dest -Force
}

# Copy locales
$LocalesSrc = Join-Path $BuildDir "locales"
if (Test-Path $LocalesSrc) {
    Copy-Item "$LocalesSrc\*" (Join-Path $StagingDir "locales") -Recurse -Force
}

# Copy SwiftShader (WebGL fallback)
$SwiftSrc = Join-Path $BuildDir "swiftshader"
if (Test-Path $SwiftSrc) {
    Copy-Item "$SwiftSrc\*" (Join-Path $StagingDir "swiftshader") -Recurse -Force
}

# Write version file
$Version | Out-File -FilePath (Join-Path $StagingDir "VERSION") -Encoding utf8

Write-Success "Binaries staged"

# ── Step 4: Run NSIS ──────────────────────────────────────────────────────────
Write-Step "Building installer with NSIS"

Require-Command "makensis"

if (-not (Test-Path $NsiScript)) {
    Write-Fail "NSI script not found: $NsiScript"
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$InstallerPath = Join-Path $OutputDir $INSTALLER_NAME

$NsisArgs = @(
    "/DVERSION=$Version",
    "/DSTAGING_DIR=$StagingDir",
    "/DOUTPUT_PATH=$InstallerPath",
    "/DPRODUCT_NAME=$PRODUCT_NAME",
    $NsiScript
)

Write-Host "    Running: makensis $NsisArgs"
$proc = Start-Process -FilePath "makensis" -ArgumentList $NsisArgs -Wait -PassThru -NoNewWindow
if ($proc.ExitCode -ne 0) {
    Write-Fail "makensis exited with code $($proc.ExitCode)"
}
Write-Success "Installer built: $InstallerPath"

# ── Step 5: Code signing (optional) ──────────────────────────────────────────
Write-Step "Code signing"

if ($env:CODE_SIGNING_CERT) {
    Write-Host "    CODE_SIGNING_CERT is set — signing installer..."
    Require-Command "signtool"

    $SignArgs = @(
        "sign",
        "/f", $env:CODE_SIGNING_CERT,
        "/t", "http://timestamp.digicert.com",
        "/fd", "sha256",
        "/d", "$PRODUCT_NAME $Version",
        $InstallerPath
    )

    if ($env:CODE_SIGNING_PASSWORD) {
        $SignArgs += @("/p", $env:CODE_SIGNING_PASSWORD)
    }

    $proc = Start-Process -FilePath "signtool" -ArgumentList $SignArgs `
        -Wait -PassThru -NoNewWindow
    if ($proc.ExitCode -ne 0) {
        Write-Fail "signtool exited with code $($proc.ExitCode)"
    }
    Write-Success "Installer signed"
} else {
    Write-Host "    CODE_SIGNING_CERT not set — skipping code signing" -ForegroundColor Yellow
    Write-Host "    To sign: set CODE_SIGNING_CERT=<path-to-.pfx> and re-run"
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " Guard Hero Browser installer ready!" -ForegroundColor Green
Write-Host " Output: $InstallerPath" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
