@echo off
setlocal
REM Starts RouteMesh (API + web UI) and opens the browser.
REM The first run creates a local virtual environment (.venv_local) and installs requirements.
cd /d "%~dp0"

if not exist ".venv_local\Scripts\python.exe" (
  echo [setup] Creating virtual environment .venv_local ...
  python -m venv .venv_local || (echo [error] Python 3 is required. & exit /b 1)
  ".venv_local\Scripts\python.exe" -m pip install --upgrade pip
  ".venv_local\Scripts\python.exe" -m pip install -r requirements.txt || (echo [error] Dependency install failed. & exit /b 1)
)

where ollama >nul 2>nul
if errorlevel 1 (
  echo [warn] Ollama not found on PATH. Install it from https://ollama.com and run: ollama pull qwen2.5:1.5b
)

start "" "http://127.0.0.1:8000/ui/"
".venv_local\Scripts\python.exe" -m uvicorn serve:app --host 127.0.0.1 --port 8000
