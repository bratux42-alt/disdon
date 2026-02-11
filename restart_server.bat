@echo off
taskkill /F /IM python.exe
echo Starting server...
python server.py
pause
