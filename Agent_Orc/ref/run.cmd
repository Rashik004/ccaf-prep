@echo off
REM Windows launcher: double-click, or run  run.cmd "your research topic"
setlocal
cd /d "%~dp0"

where node >nul 2>nul || (echo Node.js 20.12+ is required: https://nodejs.org & pause & exit /b 1)

if not exist node_modules (
  echo Installing dependencies...
  call npm install || (pause & exit /b 1)
)

if not exist .env (
  copy .env.example .env >nul
  echo Created .env - add your ANTHROPIC_API_KEY to it, then run again.
  notepad .env
  exit /b 1
)

call npm start -- %*
if "%~1"=="" pause
