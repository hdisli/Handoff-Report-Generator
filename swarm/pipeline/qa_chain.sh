#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IN="$ROOT/outputs/chain_longform.mp4"

if ! command -v ffprobe >/dev/null 2>&1; then
  echo "ffprobe fehlt"; exit 1
fi

[ -f "$IN" ] || { echo "Fehlt: $IN"; exit 1; }

echo "QA REPORT"
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,avg_frame_rate -of default=noprint_wrappers=1 "$IN"

echo "\nGate:"
echo "- Datei vorhanden: OK"
echo "- 9:16 vorhanden (1080x1920 erwartet): manuell im Report prüfen"
echo "- Dauer > 30s empfohlen: manuell prüfen"
