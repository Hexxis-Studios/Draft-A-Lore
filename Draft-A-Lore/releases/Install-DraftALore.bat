@echo off
setlocal DisableDelayedExpansion
title Draft A Lore - Create Shortcuts

set "DAL_LAUNCHER=%~dp0DraftALore.exe"
if not exist "%DAL_LAUNCHER%" (
  echo DraftALore.exe was not found next to this installer.
  echo Extract the complete Draft A Lore Windows ZIP, then try again.
  pause
  exit /b 1
)

"%DAL_LAUNCHER%" --install-shortcuts
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo Draft A Lore could not create the shortcuts.
  echo You can still open DraftALore.exe directly.
  pause
)
exit /b %RC%