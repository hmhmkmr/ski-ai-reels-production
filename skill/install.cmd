@echo off
setlocal
call "%~dp0reels.cmd" install %*
set "ski_status=%errorlevel%"
if not defined SKI_NONINTERACTIVE pause
exit /b %ski_status%
