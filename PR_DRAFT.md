# PR Draft

## Titel
Handoff-Report: Risiko-Signale + optionaler Smoke-Check

## Branch / Commit
- Branch: `feat/handoff-risk-smoke-check`
- Commit: `203e6b8`

## Beschreibung
Diese Änderung verbessert die Übergabe- und Review-Qualität im Nightly-Workflow:

1. **Automatische Risiko-Signale** im Handoff Report
   - erkennt Änderungen an Schema/Backend (`convex/`, `schema`)
   - erkennt Config-/ENV-bezogene Änderungen
   - erkennt Dependency-Änderungen (`package.json`, `package-lock.json`)
   - markiert große Diffs (>300 geänderte Zeilen)

2. **Optionaler Smoke-Check** über neuen CLI-Parameter
   - `--smoke-cmd "<kommando>"`
   - zeigt Ergebnis (Pass/Fail), Exit-Code und letzte Ausgabezeilen direkt im Report

3. **Doku aktualisiert**
   - README ergänzt (Nutzung des Smoke-Checks)
   - Changelog ergänzt

## Nutzen
Reviewer sehen sofort:
- ob ein PR potenziell riskant ist,
- ob mindestens ein Basis-Test gelaufen ist,
- und erhalten bessere Entscheidungsgrundlagen für Freigaben.

Das reduziert Rückfragen und beschleunigt Übergaben zwischen Build- und Review-Phase.

## Testhinweise
```bash
cd mission-control
node scripts/handoff-report.mjs --smoke-cmd "npm run typecheck"
```
Erwartung:
- Abschnitt **„Risiko-Signale“** ist vorhanden.
- Abschnitt **„Smoke-Check“** ist vorhanden und zeigt bei erfolgreichem Lauf `✅ erfolgreich`.

## Demo (Before / After)
- **Before:** Handoff Report enthielt nur Diff/TODO/Review-Template.
- **After:** Zusätzliche Sektionen:
  - `Risiko-Signale` (automatische Warnhinweise)
  - `Smoke-Check` (Testkommando + Status + Ausgabe-Snippet)

Beispiel aus lokalem Lauf:
- Kommando: `npm run typecheck`
- Ergebnis: `✅ erfolgreich`

## Nächste Schritte
1. PR im Browser öffnen und Draft/Review anlegen:
   - https://github.com/hdisli/Handoff-Report-Generator/pull/new/feat/handoff-risk-smoke-check
2. Reviewer zuweisen.
3. Optional zusätzlich CI-Check (`npm run check`) als zweiten Smoke-Lauf dokumentieren.

## Blocker
`gh pr create` war lokal nicht möglich, da GitHub CLI nicht authentifiziert ist (`gh auth login` erforderlich). Deshalb Branch + Commit + PR-Draft vorbereitet, **kein Merge nach main**.
