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
- `npm run dev:web` startet nur das Frontend.
- `npm run dev:backend` startet nur Convex.
- `npm run check` führt Lint + Typecheck als Schnellprüfung vor Commits aus.
- `npm run handoff` erzeugt einen kompakten Handoff-Report (Diff, Review-Fokus, TODOs) im Terminal.
- `npm run handoff:write` schreibt denselben Report nach `HANDOFF_REPORT.md` (praktisch für PR-Beschreibungen).

## Hinweise

Nach Schema-Änderungen bitte `npm run dev:backend` (oder `npm run dev:all`) laufen lassen, damit Indizes/Typen aktualisiert werden.
