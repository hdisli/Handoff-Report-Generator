# PR Draft

## Titel
feat(collab): Handoff-Report Generator für schnellere, konsistentere Reviews

## Kurzbeschreibung
Dieser PR fügt einen neuen CLI-Workflow hinzu, der automatisch einen kompakten Handoff-Report aus dem aktuellen Git-Stand erzeugt. Ziel ist bessere Zusammenarbeit bei Übergaben und Review-Qualität:

- transparenter Scope (welche Dateien geändert wurden)
- schnelle Einordnung von Risiko/Review-Fokus
- konsistente Übergabe-Checkliste
- TODO/FIXME-Sicht ohne manuelles Suchen

## Änderungen
- **Neu:** `mission-control/scripts/handoff-report.mjs`
  - erzeugt Markdown-Report mit:
    - Zeitstempel (Europe/Berlin)
    - Branch + letzter Commit
    - Diff-Statistik gegen `origin/main` (Fallback `main` / `HEAD~1`)
    - Liste geänderter Dateien
    - Review-Fokus-Checkliste
    - offene `TODO`/`FIXME`
    - nächste Schritte (Template)
- **Neu:** npm scripts in `mission-control/package.json`
  - `npm run handoff`
  - `npm run handoff:write`
- **Doku:** README um Nutzung ergänzt

## Demo (Before / After)
### Before
- Handoff musste manuell aus `git diff`, Dateiliste und eigenen Notizen zusammengebaut werden.
- Review-Kontext uneinheitlich und fehleranfälliger.

### After
- Ein Befehl liefert ein standardisiertes Handoff-Template.

Beispiel:
```bash
npm run handoff
```
Ausgabe enthält u. a.:
- `Diff gegen main: <Dateien>, +<Insertions> / -<Deletions>`
- geänderte Dateien als Liste
- Review-Fokus + nächste Schritte

Optional:
```bash
npm run handoff:write
```
Erstellt `HANDOFF_REPORT.md` für Copy/Paste in PR-Beschreibungen.

## Testhinweise (Smoke-Check)
Lokal ausgeführt:
1. `npm run handoff` ✅
2. `npm run handoff:write` ✅ (Datei erstellt)
3. `HANDOFF_REPORT.md` geprüft (Inhalt plausibel)

## Technischer Blocker
PR kann aktuell **nicht** auf GitHub erstellt werden, weil im Workspace kein Git-Remote konfiguriert ist (`git remote -v` liefert leer).

## Nächste Schritte
1. Remote setzen (z. B. `origin`) und Branch pushen
2. PR mit diesem Draft-Text eröffnen
3. Review durchführen, ggf. Folge-Commits
