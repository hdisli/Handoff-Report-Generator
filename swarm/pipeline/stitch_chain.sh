#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SEG_DIR="$ROOT/assets/chain/segments"
OUT_DIR="$ROOT/outputs"
TMP_DIR="$ROOT/assets/chain/tmp"
LIST_FILE="$TMP_DIR/list.txt"
OUT_FILE="$OUT_DIR/chain_longform.mp4"

mkdir -p "$SEG_DIR" "$OUT_DIR" "$TMP_DIR"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg fehlt"; exit 1
fi

# Normalisieren + Dateiliste bauen
rm -f "$LIST_FILE"
i=1
for f in "$SEG_DIR"/*.mp4; do
  [ -e "$f" ] || { echo "Keine Segmente in $SEG_DIR"; exit 1; }
  n="$TMP_DIR/seg_$(printf '%03d' "$i").mp4"
  ffmpeg -y -i "$f" \
    -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p" \
    -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 128k "$n" >/dev/null 2>&1
  echo "file '$n'" >> "$LIST_FILE"
  i=$((i+1))
done

# Hart concat (robust, schnell)
ffmpeg -y -f concat -safe 0 -i "$LIST_FILE" -c copy "$OUT_FILE" >/dev/null 2>&1 || \
ffmpeg -y -f concat -safe 0 -i "$LIST_FILE" -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 128k "$OUT_FILE" >/dev/null 2>&1

echo "Fertig: $OUT_FILE"
