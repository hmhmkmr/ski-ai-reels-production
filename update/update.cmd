@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "SKI_UPDATER=%~dp0apply.cjs"
set "SKI_TARGET="
if not "%~1"=="" (
  set "SKI_TARGET=%~f1"
  goto found
)
set "SKI_SEARCH=%CD%"
:project
if exist "%SKI_SEARCH%\.agents\skills\ski-ai-reels-production\release.json" (
  set "SKI_TARGET=%SKI_SEARCH%\.agents\skills\ski-ai-reels-production"
  goto found
)
for %%I in ("%SKI_SEARCH%\..") do set "SKI_PARENT=%%~fI"
if /I "%SKI_SEARCH%"=="%SKI_PARENT%" goto user
set "SKI_SEARCH=%SKI_PARENT%"
goto project
:user
if defined CODEX_HOME if exist "%CODEX_HOME%\skills\ski-ai-reels-production\release.json" set "SKI_TARGET=%CODEX_HOME%\skills\ski-ai-reels-production"
if not defined SKI_TARGET if exist "%USERPROFILE%\.agents\skills\ski-ai-reels-production\release.json" set "SKI_TARGET=%USERPROFILE%\.agents\skills\ski-ai-reels-production"
if not defined SKI_TARGET if exist "%USERPROFILE%\.codex\skills\ski-ai-reels-production\release.json" set "SKI_TARGET=%USERPROFILE%\.codex\skills\ski-ai-reels-production"
:found
if not defined SKI_TARGET goto missing
if not exist "%SKI_TARGET%\release.json" goto missing
if not exist "%SKI_TARGET%\runtime\win-x64\node.exe" goto missing
powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $bin=Join-Path ([IO.Path]::GetTempPath()) ('ski-node-'+[guid]::NewGuid().ToString('N')+'.exe'); $n=Join-Path $env:SKI_TARGET 'runtime\win-x64\node.exe'; try {[IO.File]::Copy($n,$bin); & $bin $env:SKI_UPDATER $env:SKI_TARGET; $exitCode=$LASTEXITCODE} finally {if ([IO.File]::Exists($bin)) {[IO.File]::Delete($bin)}}; exit $exitCode"
exit /b %errorlevel%
:missing
echo Could not find an installed SKI Windows x64 package. If installed elsewhere, pass the skill folder to update.cmd. For a new PC, install the team's original Windows x64 ZIP first.
exit /b 2

