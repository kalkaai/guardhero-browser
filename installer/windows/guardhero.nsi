; Guard Hero Browser — NSIS Installer Script
; Output: GuardHeroBrowser-Setup-x64.exe
;
; Usage:
;   makensis guardhero.nsi
;   makensis /DSILENT=1 guardhero.nsi   (silent install build)
;
; The installer supports:
;   /S          Silent installation
;   /D=<path>   Installation directory override
;
; Code signing must be applied after build:
;   signtool.exe sign /fd sha256 /tr http://timestamp.digicert.com
;                     /td sha256 /f cert.pfx /p <password>
;                     GuardHeroBrowser-Setup-x64.exe

;─────────────────────────────────────────────────────────────────────────────
; Configuration
;─────────────────────────────────────────────────────────────────────────────
!define PRODUCT_NAME        "Guard Hero Browser"
!define PRODUCT_SHORT_NAME  "GuardHeroBrowser"
!define PRODUCT_VERSION     "1.0.0"
!define PRODUCT_PUBLISHER   "Guard Hero"
!define PRODUCT_WEB_SITE    "https://guardhero.app"
!define PRODUCT_SUPPORT     "https://guardhero.app/support"
!define PRODUCT_EXE         "guardhero.exe"
!define PRODUCT_ICON        "guardhero.ico"
!define UNINSTALL_KEY       "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_SHORT_NAME}"
!define APP_REG_KEY         "Software\${PRODUCT_SHORT_NAME}"

; Default install directory
!define DEFAULT_INSTALL_DIR "$PROGRAMFILES64\${PRODUCT_NAME}"

;─────────────────────────────────────────────────────────────────────────────
; NSIS settings
;─────────────────────────────────────────────────────────────────────────────
Name              "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile           "GuardHeroBrowser-Setup-x64.exe"
InstallDir        "${DEFAULT_INSTALL_DIR}"
InstallDirRegKey  HKLM "${UNINSTALL_KEY}" "InstallLocation"
RequestExecutionLevel admin
SetCompressor     /SOLID lzma
SetCompressorDictSize 32
Unicode           True

;─────────────────────────────────────────────────────────────────────────────
; Modern UI 2
;─────────────────────────────────────────────────────────────────────────────
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

; MUI settings
!define MUI_ABORTWARNING
!define MUI_ICON       "${PRODUCT_ICON}"
!define MUI_UNICON     "${PRODUCT_ICON}"
!define MUI_WELCOMEFINISHPAGE_BITMAP "installer_banner.bmp"  ; 164x314 px
!define MUI_FINISHPAGE_RUN           "$INSTDIR\${PRODUCT_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT      "Launch Guard Hero Browser"
!define MUI_FINISHPAGE_LINK          "Visit guardhero.app"
!define MUI_FINISHPAGE_LINK_LOCATION "${PRODUCT_WEB_SITE}"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP       "installer_header.bmp"  ; 150x57 px

; Installer pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Languages
!insertmacro MUI_LANGUAGE "English"

;─────────────────────────────────────────────────────────────────────────────
; Version information (embedded in the exe)
;─────────────────────────────────────────────────────────────────────────────
VIProductVersion  "1.0.0.0"
VIAddVersionKey   /LANG=${LANG_ENGLISH} "ProductName"      "${PRODUCT_NAME}"
VIAddVersionKey   /LANG=${LANG_ENGLISH} "ProductVersion"   "${PRODUCT_VERSION}"
VIAddVersionKey   /LANG=${LANG_ENGLISH} "CompanyName"      "${PRODUCT_PUBLISHER}"
VIAddVersionKey   /LANG=${LANG_ENGLISH} "LegalCopyright"   "© 2025 Guard Hero"
VIAddVersionKey   /LANG=${LANG_ENGLISH} "FileDescription"  "${PRODUCT_NAME} Installer"
VIAddVersionKey   /LANG=${LANG_ENGLISH} "FileVersion"      "1.0.0.0"

;─────────────────────────────────────────────────────────────────────────────
; Installer section
;─────────────────────────────────────────────────────────────────────────────
Section "Guard Hero Browser" SecMain
  SectionIn RO  ; Required section — cannot be deselected

  SetOutPath "$INSTDIR"

  ; ── Core browser files ──────────────────────────────────────────────────
  File /r "..\..\out\Release\*.*"

  ; ── Resources (WebUI assets, blocklists) ──────────────────────────────
  SetOutPath "$INSTDIR\resources\guardhero"
  File /r "..\..\resources\guardhero\*.*"

  ; ── Write uninstaller ─────────────────────────────────────────────────
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; ── Registry: Add/Remove Programs entry ───────────────────────────────
  WriteRegStr   HKLM "${UNINSTALL_KEY}" "DisplayName"          "${PRODUCT_NAME}"
  WriteRegStr   HKLM "${UNINSTALL_KEY}" "DisplayVersion"        "${PRODUCT_VERSION}"
  WriteRegStr   HKLM "${UNINSTALL_KEY}" "Publisher"             "${PRODUCT_PUBLISHER}"
  WriteRegStr   HKLM "${UNINSTALL_KEY}" "URLInfoAbout"          "${PRODUCT_WEB_SITE}"
  WriteRegStr   HKLM "${UNINSTALL_KEY}" "URLUpdateInfo"         "https://updates.guardhero.app"
  WriteRegStr   HKLM "${UNINSTALL_KEY}" "InstallLocation"       "$INSTDIR"
  WriteRegStr   HKLM "${UNINSTALL_KEY}" "UninstallString"       "$INSTDIR\Uninstall.exe"
  WriteRegStr   HKLM "${UNINSTALL_KEY}" "DisplayIcon"           "$INSTDIR\${PRODUCT_EXE}"
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoModify"              1
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoRepair"              1
  ; Estimated install size (bytes)
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "EstimatedSize" "$0"

  ; ── Registry: App registration ────────────────────────────────────────
  WriteRegStr HKLM "${APP_REG_KEY}" "InstallDir"  "$INSTDIR"
  WriteRegStr HKLM "${APP_REG_KEY}" "Version"     "${PRODUCT_VERSION}"

  ; ── Registry: Default browser capability ──────────────────────────────
  ; Registers Guard Hero as a browser option (user must still choose via Settings)
  WriteRegStr HKLM "Software\Clients\StartMenuInternet\${PRODUCT_SHORT_NAME}" "" "${PRODUCT_NAME}"
  WriteRegStr HKLM "Software\Clients\StartMenuInternet\${PRODUCT_SHORT_NAME}\Capabilities" \
              "ApplicationName"        "${PRODUCT_NAME}"
  WriteRegStr HKLM "Software\Clients\StartMenuInternet\${PRODUCT_SHORT_NAME}\Capabilities" \
              "ApplicationDescription" "Privacy-first browser that fights back."
  WriteRegStr HKLM "Software\Clients\StartMenuInternet\${PRODUCT_SHORT_NAME}\shell\open\command" \
              "" '"$INSTDIR\${PRODUCT_EXE}" "%1"'
  WriteRegStr HKLM "Software\RegisteredApplications" \
              "${PRODUCT_SHORT_NAME}" \
              "Software\Clients\StartMenuInternet\${PRODUCT_SHORT_NAME}\Capabilities"

  ; ── Start Menu shortcut ───────────────────────────────────────────────
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortCut  "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" \
                  "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\${PRODUCT_EXE}" 0
  CreateShortCut  "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall.lnk" \
                  "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0

  ; ── Desktop shortcut (optional) ──────────────────────────────────────
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" \
                 "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\${PRODUCT_EXE}" 0

SectionEnd

;─────────────────────────────────────────────────────────────────────────────
; Uninstaller section
;─────────────────────────────────────────────────────────────────────────────
Section "Uninstall"

  ; Kill running instances
  ExecWait 'taskkill /f /im "${PRODUCT_EXE}"' $0

  ; Remove files
  RMDir /r "$INSTDIR"

  ; Remove shortcuts
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall.lnk"
  RMDir  "$SMPROGRAMS\${PRODUCT_NAME}"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"

  ; Remove registry entries
  DeleteRegKey HKLM "${UNINSTALL_KEY}"
  DeleteRegKey HKLM "${APP_REG_KEY}"
  DeleteRegKey HKLM "Software\Clients\StartMenuInternet\${PRODUCT_SHORT_NAME}"
  DeleteRegValue HKLM "Software\RegisteredApplications" "${PRODUCT_SHORT_NAME}"

  ; Remove user data (optional — prompt first)
  MessageBox MB_YESNO \
    "Do you want to remove your Guard Hero Browser profile data (bookmarks, settings, history)?" \
    IDNO skip_userdata
    RMDir /r "$LOCALAPPDATA\GuardHeroBrowser"
  skip_userdata:

SectionEnd

;─────────────────────────────────────────────────────────────────────────────
; Functions
;─────────────────────────────────────────────────────────────────────────────
Function .onInit
  ; Enforce 64-bit Windows
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "Guard Hero Browser requires a 64-bit version of Windows."
    Abort
  ${EndIf}

  ; Check Windows version (require Windows 10+)
  ${If} ${AtMostWin8.1}
    MessageBox MB_ICONSTOP "Guard Hero Browser requires Windows 10 or later."
    Abort
  ${EndIf}

  ; Check for existing installation
  ReadRegStr $0 HKLM "${UNINSTALL_KEY}" "UninstallString"
  ${If} $0 != ""
    MessageBox MB_OKCANCEL \
      "${PRODUCT_NAME} is already installed. Click OK to reinstall, or Cancel to abort." \
      IDOK continue_install
    Abort
    continue_install:
  ${EndIf}
FunctionEnd

Function .onInstSuccess
  ; Launch auto-updater service
  ExecShell "open" "$INSTDIR\guardhero_updater.exe" "/install" SW_HIDE
FunctionEnd
