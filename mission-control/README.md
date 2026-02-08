# Mission Control Dashboard

Next.js + Convex Dashboard mit drei Kernfunktionen:

1. **Aktivitätsfeed** – protokolliert Aktionen/Aufgaben
2. **Wochenkalender** – zeigt geplante Aufgaben in Wochenansicht
3. **Globale Suche** – durchsucht Aktivitäten, Aufgaben und Dokumente

## Stack

- Next.js (App Router, TypeScript)
- Convex (DB + Backend Functions)
- Tailwind CSS

## Start

```bash
npm install
npm run dev:all
```

Dann `.env.local` anlegen:

```bash
NEXT_PUBLIC_CONVEX_URL=<deine_convex_url>
```

Öffne dann: http://localhost:3000

## Wichtige Dateien

- `src/app/page.tsx` – Dashboard UI
- `convex/schema.ts` – Datenmodell
- `convex/activities.ts` – Activity Feed Queries/Mutations
- `convex/tasks.ts` – Wochenplanung
- `convex/search.ts` – globale Suche
- `convex/documents.ts` – Dokumentdaten für Search

## Phase 3 (umgesetzt)

- Rollenmodell im UI (owner/editor/viewer) mit Schreibrechten
- Suchindizes per Convex `searchIndex` für Activities/Tasks/Documents
- Agent-Event-Ingestion (`convex/events.ts`) inkl. Batch-Ingest
- Post-Queue (`convex/postQueue.ts`): approved → ready/publishing/published/failed

## Workflow-Kommandos

- `npm run dev:all` startet Next.js + Convex gemeinsam in einem Terminal.
- `npm run dev:ops` startet Next.js + Convex + Owl Dispatcher (Queue -> echter OpenClaw-Run -> Live-Status) gemeinsam.
- `npm run dev:web` startet nur das Frontend.
- `npm run dev:backend` startet nur Convex.
- `npm run check` führt Lint + Typecheck als Schnellprüfung vor Commits aus.
- `npm run owl:dispatcher -- --once` triggert genau einen Poll-Zyklus (ideal für E2E-Smoketest der Bridge).
- `npm run handoff` erzeugt einen kompakten Handoff-Report (Diff, Risiko-Signale, Review-Fokus, TODOs) im Terminal.
- `npm run handoff:write` schreibt denselben Report nach `HANDOFF_REPORT.md` (praktisch für PR-Beschreibungen).
- Optionaler Smoke-Check: `node scripts/handoff-report.mjs --smoke-cmd "npm run check"` hängt ein kurzes Pass/Fail-Ergebnis inkl. Ausgabe-Snippet an.

## Hinweise

- Dispatcher nutzt `openclaw agent --local --json` als echten Connector.
- Run-Control im Dashboard: `pause/resume/stop` für laufende Runs sowie `retry/prioritize` für abgeschlossene/queued Runs.
- Standard-Agent-Mapping ohne zusätzliche ENV-Variablen:
  - `main` → `main`
  - `subagent` / `hybrid` → `swarm-automation`
- Optional können Agent-IDs je Scope überschrieben werden:
  - `OWL_MAIN_AGENT_ID`
  - `OWL_SUBAGENT_AGENT_ID`
  - `OWL_HYBRID_AGENT_ID`
- Für Standalone-Dispatcher-Starts muss `NEXT_PUBLIC_CONVEX_URL` gesetzt sein (oder via `.env.local` geladen werden), z. B.:
  - `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210 npm run owl:dispatcher -- --once`
- Nach Schema-Änderungen bitte `npm run dev:backend` (oder `npm run dev:all`) laufen lassen, damit Indizes/Typen aktualisiert werden.
