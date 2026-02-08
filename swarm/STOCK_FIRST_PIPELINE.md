# Stock-First Pipeline (Satisfying International)

## Ziel
Aus frei nutzbarem Stock-Material schnell Shorts/Reels bauen (ohne Voiceover, mit passenden SFX).

## Ordnerstruktur
- `assets/raw/` – heruntergeladene Rohclips
- `assets/normalized/` – auf 1080x1920/30fps normalisiert
- `assets/audio/` – SFX (optional)
- `outputs/` – finale Exporte

## Ablauf
1. Quellen in `swarm/sources/satisfying_sources.txt` eintragen (eine MP4-URL pro Zeile)
2. Download + Normalize starten:
   - `bash swarm/pipeline/stock_first_run.sh`
3. Ergebnis prüfen in:
   - `assets/normalized/`
4. Danach Batch-Render (A/B-Varianten) auf Basis der normalisierten Clips.

## Lizenzregel
Nur Material nutzen, das für Social Media erlaubt ist.
Keine Veröffentlichung ohne GO von Hasan.
