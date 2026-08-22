#!/usr/bin/env bash
# Cross-platform Python launcher for AI log hooks.
# Prefer the Windows Python launcher because Microsoft Store aliases can appear
# on PATH without providing a usable Python executable.
# Designed to be called as: bash scripts/_pyrun.sh <script> [args...]
# Hooks must never block the parent AI or Git process when Python is absent.
set -u

if [ -x ".venv/Scripts/python.exe" ]; then
  PY=".venv/Scripts/python.exe"
elif command -v py >/dev/null 2>&1; then
  PY="py -3"
elif command -v python3 >/dev/null 2>&1 && python3 --version >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1 && python --version >/dev/null 2>&1; then
  PY=python
else
  PY=""
  shopt -s nullglob 2>/dev/null || true
  for cand in \
    /c/Users/*/AppData/Local/Programs/Python/Python*/python.exe \
    "/c/Program Files/Python"*/python.exe \
    "/c/Program Files (x86)/Python"*/python.exe \
    /c/Python*/python.exe; do
    if [ -x "$cand" ]; then PY="$cand"; break; fi
  done
  shopt -u nullglob 2>/dev/null || true
  [ -n "$PY" ] || exit 0
fi

# shellcheck disable=SC2086
exec $PY "$@"
