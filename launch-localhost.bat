@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe ou n'est pas dans le PATH.
  echo Installe Node.js puis relance ce fichier.
  pause
  exit /b 1
)

start "Betrayal Box Server" cmd /k "cd /d ""%~dp0"" && node serve-local.js"

timeout /t 2 /nobreak >nul
start "" "http://localhost:5500"

endlocal
