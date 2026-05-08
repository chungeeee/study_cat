; Custom NSIS for StudyCat installer.
; Replaces the default finish page so we can add a "Windows 시작 시 자동 실행"
; checkbox alongside the existing "Run app" checkbox.

!macro customFinishPage
  !ifndef HIDE_RUN_AFTER_FINISH
    Function StartApp
      ${if} ${isUpdated}
        StrCpy $1 "--updated"
      ${else}
        StrCpy $1 ""
      ${endif}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd

    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif

  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Windows 시작 시 자동 실행"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION RegisterAutoStart

  !insertmacro MUI_PAGE_FINISH
!macroend

Function RegisterAutoStart
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
    "StudyCat" '"$INSTDIR\StudyCat.exe"'
FunctionEnd

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "StudyCat"
!macroend
