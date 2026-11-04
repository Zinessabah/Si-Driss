@echo off
setlocal enabledelayedexpansion

:: ==============================================================================
:: Script de démarrage universel Windows - Si Driss
:: ==============================================================================

title Si Driss - Demarrage de la plateforme

set "SCRIPT_DIR=%~dp0"
if exist "%SCRIPT_DIR%package.json" (
  set "PROJECT_DIR=%SCRIPT_DIR%"
) else if exist "%SCRIPT_DIR%Si-Driss\package.json" (
  set "PROJECT_DIR=%SCRIPT_DIR%Si-Driss\"
) else (
  echo [ERREUR] Impossible de trouver le dossier du projet Si-Driss.
  pause
  exit /b 1
)

cd /d "%PROJECT_DIR%"

echo ================================================================
echo    SI DRISS - PLATEFORME UNIVERSELLE 2EME BAC BIOF
echo ================================================================

:: Verification Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERREUR] Node.js n'est pas installe. Rendez-vous sur https://nodejs.org/
  pause
  exit /b 1
)

:: Verification .env
if not exist ".env" (
  if exist ".env.example" (
    echo [INFO] Creation du fichier .env depuis .env.example...
    copy .env.example .env >nul
  )
)

:: Verification node_modules
if not exist "node_modules\" (
  echo [INFO] Installation des dependances (npm install)...
  call npm install
)

set "MODE=%~1"
if "%MODE%"=="" set "MODE=dev"

echo.
echo [LANCEMENT] Demarrage de Si Driss sur http://localhost:3000 ...
echo [INFO] Appuyez sur Ctrl+C pour arreter le serveur.
echo ----------------------------------------------------------------

start http://localhost:3000

if "%MODE%"=="prod" (
  echo [INFO] Compilation de production...
  call npm run build
  set NODE_ENV=production
  call npm start
) else if "%MODE%"=="docker" (
  docker compose up
) else (
  call npm run dev
)

