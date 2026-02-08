#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC_FILE="$ROOT/swarm/sources/satisfying_sources.txt"
RAW_DIR="$ROOT/assets/raw"
NORM_DIR="$ROOT/assets/normalized"

mkdir -p "$RAW_DIR" "$NORM_DIR"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg fehlt. Bitte zuerst installieren."
  exit 1
fi

if [ ! -f "$SRC_FILE" ]; then
  echo "Quelle fehlt: $SRC_FILE"
  exit 1
fi

echo "[1/3] Download startet..."
idx=1
while IFS= read -r line; do
  url="${line%%#*}"
  url="$(echo "$url" | xargs)"
  [ -z "$url" ] && continue

  out="$RAW_DIR/clip_${idx}.mp4"
  echo "  - $url"
  curl -L --fail --silent --show-error "$url" -o "$out"
  idx=$((idx+1))
done < "$SRC_FILE"

echo "[2/3] Normalize (1080x1920, 30fps)..."
for f in "$RAW_DIR"/*.mp4; do
  [ -e "$f" ] || { echo "Keine Rohclips gefunden."; exit 1; }
  b="$(basename "$f" .mp4)"
  out="$NORM_DIR/${b}_norm.mp4"

  ffmpeg -y -i "$f" \
    -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30" \
    -c:v libx264 -pix_fmt yuv420p -preset medium -crf 20 \
    -c:a aac -b:a 128k \
    "$out" >/dev/null 2>&1
done

echo "[3/3] Fertig. Normalisierte Clips: $NORM_DIR"
ls -1 "$NORM_DIR"
