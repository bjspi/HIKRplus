@echo off
setlocal

cd /d "%~dp0"

if not exist node_modules (
  echo Installing npm dependencies...
  call npm install
  if errorlevel 1 exit /b %errorlevel%
)

echo Building HIKR Chrome Extension...
call npm run build
if errorlevel 1 (
  echo.
  echo *** BUILD FAILED with exit code %errorlevel% ***
  echo Press any key to close...
  pause >nul
  exit /b %errorlevel%
)

echo.
echo Build complete.
echo Load this folder as unpacked Chrome extension:
echo %CD%\dist
echo.
pause

endlocal
