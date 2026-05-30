@echo off
echo ============================================
echo  HIKR Enhancements - Firefox Build
echo ============================================
echo.

call npm run build:firefox
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [FEHLER] Build fehlgeschlagen!
  pause
  exit /b 1
)

echo.
echo ============================================
echo  Ergebnis liegt in: dist-firefox\
echo  Zum Laden in Firefox:
echo    1. about:debugging oeffnen
echo    2. "Dieser Firefox" klicken
echo    3. "Temporaere Erweiterung laden..."
echo    4. dist-firefox\manifest.json auswaehlen
echo ============================================
echo.
pause
