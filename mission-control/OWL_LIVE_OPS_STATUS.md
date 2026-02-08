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

## 2026-02-08 06:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- Neuer Host-Dispatcher `scripts/owl-dispatcher.mjs` implementiert:
  - Polling auf `commandQueue.takeNextQueued` (Locking bereits über atomaren Statuswechsel in Convex)
  - Simulierter Connector mit Live-Events (`commandQueue.appendRunEvent`)
  - Abschluss über `commandQueue.setRunState` als `done` oder `failed`
  - Fail-Simulation über Prompt-Marker `[fail]` / `[error]` für reproduzierbaren Retry-Test
- Neue NPM-Workflows ergänzt:
  - `npm run owl:dispatcher`
  - `npm run dev:ops` (Web + Convex + Dispatcher parallel)
- README um Dispatcher-Start und `--once`-Smoke-Run erweitert.

### Kurztest
- `npm run check` im Ordner `mission-control` ausgeführt.
- `npm run owl:dispatcher -- --help` ausgeführt (CLI-Parameter validiert).

### Nächster Schritt (07:00)
- Simulierten Connector durch echten OpenClaw-Connector ersetzen (Main/Subagent-Start + sessionKey-Rückkanal) und erste echte Steuerbefehle `stop/retry/prio` end-to-end über Dashboard nachweisen.

## 2026-02-08 07:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- `scripts/owl-dispatcher.mjs` auf **echten OpenClaw-Connector** umgestellt:
  - startet `openclaw agent --local --json --message <prompt>` statt Dry-Run
  - optionales Scope-Routing über Env-Variablen (`OWL_MAIN_AGENT_ID`, `OWL_SUBAGENT_AGENT_ID`, `OWL_HYBRID_AGENT_ID`)
  - schreibt `sessionKey`/Agent-Zuordnung zurück in `commandQueue` (`attachRunSession`)
  - streamt stdout/stderr als Live-Events in `agentRunEvents`
  - unterstützt `stop` end-to-end durch Prozessabbruch bei manuellem Cancel
- Neue Convex-Endpunkte in `convex/commandQueue.ts`:
  - `getRunContext` (Run-/Command-Status für Connector-Polling)
  - `attachRunSession` (Rückkanal für sessionKey + Agent-Label)
- Dashboard (`src/app/page.tsx`) um erste Live-Steuerung erweitert:
  - `Stop` für laufende Runs
  - `Retry` für `done|failed|canceled`
  - `Priorisieren` für `queued`

### Kurztest
- `npm run check` im Ordner `mission-control` ausgeführt (**grün**, nur bekannte Warnungen in `convex/_generated/*`).
- `npm run owl:dispatcher -- --help` ausgeführt (neue Connector-Optionen validiert).

### Nächster Schritt (08:00)
- End-to-End-Smoketest mit echtem Queue-Run auf `localhost:3000` (inkl. Nachweis `queued -> running -> done`, anschließend `retry`-Pfad) und ergänzende UI-Anzeige für `sessionKey/resultLink` klickbar machen.
