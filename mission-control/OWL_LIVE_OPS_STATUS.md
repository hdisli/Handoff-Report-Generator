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
