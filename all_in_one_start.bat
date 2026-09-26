@echo off
title Huettencup 2026 - All-In-One Studio ^& TV Player
color 0E

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch_huettencup.ps1"
