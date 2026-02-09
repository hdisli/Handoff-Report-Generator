# PR Draft

## Titel
feat(collab): Auto-Review-Brief für schnellere PR-Entscheidungen

## Branch / Commit
- Branch: `feat/nightly-review-brief-generator`
- Commit: `ba6a2b9`

## Beschreibung
Diese Änderung verbessert die tägliche Zusammenarbeit im Review-Prozess, indem aus dem Diff automatisch ein **Review-Brief** erzeugt wird.

Neu im `handoff-report`:
1. **Domänen-Erkennung** (UI/UX, Backend/DB, Ops, Konfiguration, Doku)
2. **Automatischer Entscheidungsbedarf** (Review-Fragen basierend auf Risiko-Signalen + betroffenen Bereichen)
3. Neuer CLI-Parameter: `--brief-out <datei>` für einen separaten, kurz nutzbaren PR-Review-Text
4. Neuer npm-Shortcut: `npm run handoff:brief`
5. README um Nutzung ergänzt

## Nutzen für die Zusammenarbeit
- **Schnellere Reviews:** Reviewer sehen sofort, wo sie zuerst hinschauen sollen.
- **Besserer Entscheidungsfluss:** Kritische Fragen werden vorab sichtbar statt erst im Kommentar-Pingpong.
- **Höhere Übergabe-Qualität:** Copy-Paste-Block für PR-Kommentar spart Zeit und macht Übergaben konsistent.

## Testhinweise (Smoke)
```bash
cd mission-control
node scripts/handoff-report.mjs --brief-out REVIEW_BRIEF.md --smoke-cmd "node -e \"console.log('smoke ok')\""
```
Erwartung:
- Handoff-Report wird ausgegeben.
- `REVIEW_BRIEF.md` wird geschrieben.
- Smoke-Check zeigt `✅ erfolgreich`.

## Demo (Before / After)
- **Before:** Handoff-Report lieferte Diff + Risiko-Hinweise, aber keinen sofort nutzbaren Review-Kommentar mit Entscheidungsfragen.
- **After:** `REVIEW_BRIEF.md` enthält
  - priorisierte Review-Schwerpunkte pro Domäne,
  - automatische Entscheidungsfragen,
  - einen Copy-Paste-Block für den PR-Thread.

Beispielauszug aus `REVIEW_BRIEF.md`:
- "Was Reviewer zuerst prüfen sollten" mit konkreten Test-Hinweisen
- "Entscheidungen, die wir im Review klären sollten" als direkte Fragenliste

## Nächste Schritte
1. PR über Compare-Link öffnen:
   - https://github.com/hdisli/Handoff-Report-Generator/pull/new/feat/nightly-review-brief-generator
2. Draft-PR anlegen und Reviewer zuweisen.
3. Optional zweiten Smoke-Lauf mit `npm run check` ergänzen.

## Blocker
`gh pr create` war lokal nicht möglich, weil GitHub CLI hier nicht authentifiziert ist (`gh auth login` fehlt). Deshalb Branch + Commit + `PR_DRAFT.md` vorbereitet, **kein Merge nach main**.
