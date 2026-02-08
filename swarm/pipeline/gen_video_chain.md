# GEN_VIDEO_CHAIN (Veo Browser Worker)

## Ziel
Mehrere Segmente nacheinander generieren und anschließend zu einem Longform-Clip zusammensetzen.

## Inputs
- Nische/Thema (z. B. satisfying kinetic sand)
- Ziel-Länge (z. B. 60s)
- Segment-Länge (z. B. 10s)
- Stil/Look (international, visuell-first)

## Ordner
- `assets/chain/segments/`  (Roh-Segmente aus Veo)
- `assets/chain/audio/`     (SFX-Layer)
- `outputs/`                (Finals)

## Veo-Worker Ablauf (Browser)
1. Segment 01 mit Basis-Prompt generieren.
2. Letzte 1–2s/letzten Frame als Kontinuitätsanker für Segment 02 nutzen.
3. Für Segment N+1: Prompt mit "continue same scene/style/motion" + Referenz.
4. Alle Segmente als MP4 in `assets/chain/segments/` speichern.

## Nächste Schritte lokal
- `bash swarm/pipeline/stitch_chain.sh`
- `bash swarm/pipeline/qa_chain.sh`
