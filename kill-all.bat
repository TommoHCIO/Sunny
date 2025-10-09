@echo off
taskkill /F /IM node.exe /T
timeout /t 2
echo All Node.js processes killed
