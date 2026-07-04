@echo off
title VET MANAGE - Smart Card Reader
cd /d "%~dp0"
echo Starting SmartCard Reader...
start "VET SmartCard" "java" -jar "printdaemon\JSmartCardReader.jar" 8443 001
timeout /t 3 /nobreak >nul
start "" "http://localhost:8084/smartcard/data/"
exit
