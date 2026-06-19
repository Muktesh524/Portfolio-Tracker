@echo off
REM Start script for the Portfolio Dashboard Backend (Windows)
REM Usage: start.bat

echo.
echo ========================================
echo Portfolio Dashboard Backend
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.9+ from https://www.python.org/
    pause
    exit /b 1
)

echo [INFO] Python found:
python --version

REM Check if requirements are installed
python -c "import fastapi" >nul 2>&1
if errorlevel 1 (
    echo.
    echo [INFO] Installing dependencies...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
)

echo [OK] Dependencies installed
echo.
echo ========================================
echo.
echo [INFO] Backend starting...
echo.
echo  API Server:  http://localhost:8000
echo  Swagger UI:  http://localhost:8000/docs
echo  ReDoc:       http://localhost:8000/redoc
echo.
echo Press Ctrl+C to stop the server
echo.
echo ========================================
echo.

python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

pause
