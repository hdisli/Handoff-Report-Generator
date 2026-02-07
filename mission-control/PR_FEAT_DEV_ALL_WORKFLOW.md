# PR: Verbessertes lokales Dev-Workflow-Setup

## Ziel
Lokalen Entwicklungsablauf vereinfachen (höherer praktischer Nutzen im Alltag): weniger Terminal-Chaos, schnellere Qualitätschecks vor Commits.

## Änderungen
- `npm run dev:all` hinzugefügt:
  - startet **Next.js + Convex parallel** in einem Terminal
  - beendet beide Prozesse sauber beim Stoppen (`trap "kill 0" EXIT`)
- `npm run dev:web` und `npm run dev:backend` hinzugefügt (gezieltes Starten einzelner Teile)
- `npm run typecheck` hinzugefügt (`tsc --noEmit`)
- `npm run check` hinzugefügt (`lint + typecheck`)
- README aktualisiert (Start/Workflow-Kommandos)
- `CHANGELOG.md` ergänzt

## Warum hilfreich
- Spart bei jedem Start mindestens einen manuellen Schritt (kein zweites Terminal nötig)
- Bessere Routine vor Commits über `npm run check`
- Onboarding klarer, weil die Kommandos dokumentiert und konsistent sind

## Test/Verifikation
- `npm run check` ausgeführt
  - Ergebnis: **fehlgeschlagen aufgrund bestehender ESLint-Regelverletzung in `src/app/page.tsx`** (`react-hooks/set-state-in-effect`), nicht durch diese PR eingeführt.

## Blocker (für echten PR auf GitHub)
- Im Workspace ist **kein Git-Remote** konfiguriert (`git remote -v` leer)
- Deshalb konnte kein PR-Link erstellt werden

## Nächste Schritte sobald Remote vorhanden
```bash
git push -u origin feat/dev-all-workflow
# dann PR erstellen, z. B.:
gh pr create --base main --head feat/dev-all-workflow \
  --title "Improve local dev workflow: dev:all + check scripts" \
  --body-file mission-control/PR_FEAT_DEV_ALL_WORKFLOW.md
```
