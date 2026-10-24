@echo off
title Huettencup 2026 - TV Screen Neustart
color 0B

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0restart_tv.ps1"
