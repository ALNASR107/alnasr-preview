#!/usr/bin/env bash
# يُشغَّل تلقائيًا عند إقلاع الموبايل عبر Termux:Boot
sleep 25
termux-wake-lock 2>/dev/null || true
cd "$HOME/amanah-next" 2>/dev/null || exit 0
mkdir -p logs
nohup bash termux/2-start.sh >> logs/boot.log 2>&1 &
