@echo off
setlocal
"%~dp0runtime\win-x64\node.exe" "%~dp0lib\cli.cjs" %*
exit /b %errorlevel%
