# Owl Live Ops Cockpit – Sprint-Status

## 2026-02-08 04:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- Convex-Schema um die MVP-Bridge-Tabellen erweitert:
  - `commandQueue`
  - `agentRuns`
  - `agentRunEvents`
  - `controlActions`
- Basis-Umsetzungslogik implementiert in `convex/commandQueue.ts`:
  - `enqueue` (Dashboard-Eingang -> Queue)
  - `list` (Queue-Ansicht)
  - `takeNextQueued` (Dispatcher nimmt atomar den nächsten Command und startet Run)
  - `appendRunEvent` + `listRunEvents` (Live-Rückkanal)
  - `setRunState` (running -> done/failed/canceled inkl. Ergebnisfelder)
  - `controlRun` (pause/resume/stop/retry/prioritize + Audit)

### Kurztest
- `npm run check` im Ordner `mission-control` ausgeführt.
- Ergebnis: **grün** (keine Errors, nur bestehende Warnungen in auto-generierten Convex-Dateien).

### Nächster Schritt (05:00)
- Dashboard-UI anbinden: Command-Erfassung, Queue-Liste, Status-Badges und Run-Event-Timeline aus den neuen Convex-Endpunkten.

## 2026-02-08 05:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- `src/app/page.tsx` um Live-Ops-MVP-UI erweitert:
  - neues Formular „Owl Live Ops · Command Queue“ (Titel, Prompt, Scope, Priorität)
  - Queue-Liste mit Status-Badges (`queued|running|paused|done|failed|canceled`), Scope/Prio-Anzeige und Ergebnis-/Fehlerzeile
  - Auswahl eines Runs aus der Queue zur Detailansicht
  - neue „Live-Timeline“ für `agentRunEvents` mit Severity-Farben und Zeitstempeln
- Convex API-Typen aktualisiert (`convex/_generated/api.d.ts`), damit `api.commandQueue.*` im Frontend typisiert verfügbar ist.

### Kurztest
- `npm run check` im Ordner `mission-control` ausgeführt.
- Ergebnis: **grün** (Typecheck erfolgreich; nur bestehende, bekannte Lint-Warnungen in `convex/_generated/*`).

### Nächster Schritt (06:00)
- Dispatcher-Basis im Host-Prozess verdrahten (Queue-Polling + Locking + Retry-Flow) und mit simuliertem Connector einen echten End-to-End-Lauf (`queued -> running -> done/failed`) über die neue UI nachweisen.
