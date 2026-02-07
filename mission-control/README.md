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
npx convex dev
npm run dev
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

## Hinweise

Nach Schema-Änderungen bitte `npx convex dev` laufen lassen, damit Indizes/Typen aktualisiert werden.
