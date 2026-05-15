@echo off
setlocal
cd /d "%~dp0"

echo ======================================
echo        ALMALAKI POS V6 LAUNCHER
echo ======================================
where npm >nul 2>nul
if errorlevel 1 (
  echo npm / Node.js not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist ".setup-complete" (
  echo First run detected. Installing packages...
  call cd backend ^&^& npm install
  if errorlevel 1 goto fail
  call cd frontend ^&^& npm install
  if errorlevel 1 goto fail
  echo Migrating local data to Firebase...
  call cd backend ^&^& npm run migrate
  if errorlevel 1 goto fail
  echo ok> .setup-complete
)

start "Almalaki Backend" cmd /k "cd /d %~dp0backend && npm run dev"
start "Almalaki Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
exit /b 0

:fail
echo Setup failed. Check the error above.
pause
exit /b 1
