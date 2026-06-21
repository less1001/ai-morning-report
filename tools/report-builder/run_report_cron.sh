#!/bin/bash
# Load user shell profile if needed
source ~/.zshrc
cd "/Volumes/Samsung T7/Codex/Legacy Projects/New project 4"
"/Volumes/Samsung T7/antigravity/Hermes/venv/bin/python3" tools/report-builder/send-report-direct.py >> tools/report-builder/cron.log 2>&1
