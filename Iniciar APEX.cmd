@echo off
cd /d "%~dp0"
echo APEX - Conexion por IP para tu red Wi-Fi privada
node bridge/server.mjs --lan
pause
