@echo off
REM Start CV Parser Service (Flask) in development mode
cd /d %~dp0
set FLASK_APP=src.app
set FLASK_ENV=development
python -m flask run --host=0.0.0.0 --port=5001
