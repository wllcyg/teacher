@echo off
chcp 65001 > nul
echo =========================================
echo starting pipeline...
echo =========================================
cd /d "%~dp0"
uv run python -m rss_pipeline.workflow
echo.
echo =========================================
echo finished
echo =========================================
pause
