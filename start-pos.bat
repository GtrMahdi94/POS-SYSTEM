@echo off
title Almalaki POS v8 Multi Store

echo ========================================
echo     Almalaki POS v8 Multi Store
echo ========================================
echo.

if not exist backend\node_modules (
  echo Installing backend dependencies...
  cd backend
  call npm install
  cd ..
) else (
  echo Backend dependencies already installed.
)

if not exist frontend\node_modules (
  echo Installing frontend dependencies...
  cd frontend
  call npm install
  cd ..
) else (
  echo Frontend dependencies already installed.
)

echo.
echo Starting backend...
start "Almalaki Backend" cmd /k "cd /d %~dp0backend && npm run dev"

echo Starting frontend...
start "Almalaki Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Open http://localhost:5173
pause
