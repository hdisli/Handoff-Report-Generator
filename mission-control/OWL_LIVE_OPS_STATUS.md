# Owl Live Ops Cockpit – Sprint-Status

## 2026-02-08 19:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- **Dispatcher-Live-Rückkanal erweitert:** neues Convex-Heartbeat-Modell `dispatcherHeartbeats` in `convex/schema.ts` für Online/Offline- und Zustands-Tracking (`idle|polling|running|error`).
- Neue Endpunkte in `convex/commandQueue.ts`:
  - `dispatcherHeartbeat` (upsert pro Dispatcher)
  - `dispatcherStatus` (liefert Heartbeat + `isOnline`/`ageMs`)
- `scripts/owl-dispatcher.mjs` sendet jetzt Heartbeats:
  - beim Start (polling),
  - im Idle-Polling (keine Queue),
  - beim Run-Start/-Fortschritt,
  - bei Fehlern inkl. Fehlermeldung.
- Dashboard (`src/app/page.tsx`) zeigt im Owl-Statusbereich jetzt den **echten Dispatcher-Health-Status** (online/offline + state + letzte Meldung), damit sichtbar ist, ob `localhost:3000` wirklich Ausführung triggern kann.

### Kurztest
- `npm run check` im Ordner `mission-control` ausgeführt: **grün**.
- `npm run owl:mvp:verify` ausgeführt ohne laufendes Backend: erwartete, klare Diagnose „Convex nicht erreichbar … starte `npm run dev:ops`“ bestätigt.

### Nächster Schritt (20:00)
- Heartbeat-basierte Warnlogik im Dashboard ergänzen (z. B. UI-Warnbanner bei >20s ohne Heartbeat) und anschließend E2E-Nachweis mit laufendem `dev:ops` (Queue-Eintrag -> Dispatcher online -> Run done).

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

## 2026-02-08 08:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- Dispatcher-Bugfix für echte Convex-HTTP-Aufrufe umgesetzt:
  - Funktionspfade in `scripts/owl-dispatcher.mjs` von Dot-Notation auf Convex-Notation (`commandQueue:...`) korrigiert.
- Connector robuster gemacht, damit echte Runs ohne zusätzliche Konfiguration starten:
  - Default-Agent-Mapping ergänzt (`main -> main`, `subagent/hybrid -> swarm-automation`), ENV-Overrides bleiben möglich.
- Dashboard-UI in `src/app/page.tsx` erweitert:
  - `sessionKey` (falls vorhanden) sichtbar als Badge,
  - `resultLink` klickbar direkt in der Command-Queue.
- README-Hinweise ergänzt (Standalone-Dispatcher mit `NEXT_PUBLIC_CONVEX_URL`, Standard-Agent-Mapping).

### Kurztest
- `npm run check` im Ordner `mission-control` ausgeführt (**grün**, nur bekannte Warnungen in `convex/_generated/*`).
- Lokaler E2E-Smoketest (mit laufendem `npx convex dev`) durchgeführt:
  1. `npx convex run commandQueue:enqueue ...` (Smoke-Command)
  2. `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210 npm run owl:dispatcher -- --once --timeoutMs 180000`
  3. Ergebnis via `npx convex run commandQueue:list '{"status":"all","limit":3}'` geprüft: Status `done`, inkl. Retry-Pfad (`retryCount: 1`) nach initialem erwartbarem Agent-Parameter-Fehler.

### Nächster Schritt (09:00)
- Control-Bar um `pause/resume` im Dashboard ergänzen und im Dispatcher den Pause-Pfad aktiv berücksichtigen (Polling + Event-Feedback), damit die MVP-Steuerung vollständig ist.

## 2026-02-08 09:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- Dashboard-Control-Bar in `src/app/page.tsx` erweitert:
  - `Pause`-Button für laufende Runs (`running`)
  - `Resume`-Button für pausierte Runs (`paused`)
  - bestehende Controls (`stop/retry/prioritize`) bleiben unverändert verfügbar.
- Dispatcher `scripts/owl-dispatcher.mjs` um aktiven Pause-/Resume-Pfad ergänzt:
  - Polling auf `commandQueue:getRunContext` erkennt `paused`/`running`
  - laufender OpenClaw-Prozess wird mit `SIGSTOP` pausiert und mit `SIGCONT` fortgesetzt
  - Live-Event-Feedback wird in `agentRunEvents` geschrieben (`Run pausiert` / `Run fortgesetzt`).
- README/Changelog aktualisiert, damit der neue Steuerpfad dokumentiert ist.

### Kurztest
- `npm run check` im Ordner `mission-control` ausgeführt.
- Ergebnis: **grün** (Typecheck/Lint ohne neue Fehler).

### Nächster Schritt (10:00)
- E2E-Nachweis für vollständige MVP-Definition-of-Done dokumentieren: ein echter Run inkl. Pause/Resume/Stop/Retry als reproduzierbarer Testablauf mit klaren Schritten für Hasan (inkl. PR-Referenz).

## 2026-02-08 10:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- Neuer automatischer Smoke-Test `scripts/owl-e2e-smoke.mjs`:
  - führt die Bridge reproduzierbar durch: `enqueue -> done -> retry -> done`
  - nutzt echten Dispatcher (`scripts/owl-dispatcher.mjs --once`) statt Mock
  - validiert final `status=done` und `retryCount >= 1`
- Neues Test-/Abnahme-Dokument `OWL_LIVE_OPS_E2E.md` mit vollständigem manuellen E2E-Ablauf für:
  - `queued -> running -> done`
  - `pause/resume`
  - `stop`
  - `retry`
  - inkl. klarer MVP-DoD-Checkliste
- NPM-Script hinzugefügt:
  - `npm run owl:e2e:smoke`
- README + CHANGELOG für den neuen E2E-Nachweis aktualisiert.

### Kurztest
- `npm run check` im Ordner `mission-control` ausgeführt (**grün**).
- `npm run owl:e2e:smoke -- --help` ausgeführt (CLI-Interface des Smoke-Tests validiert).

### Nächster Schritt (11:00)
- Vollständigen lokalen End-to-End-Lauf mit laufendem `dev:ops` aufzeichnen (Output-Snippets + ggf. Screenshot) und anschließend PR finalisieren (Link in Status/Abschlussmeldung an Hasan).

## 2026-02-08 11:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- `scripts/owl-dispatcher.mjs` robuster gemacht, damit `npm run dev:ops` stabil hochfährt:
  - lädt `.env.local` automatisch (kein manueller ENV-Export mehr nötig),
  - akzeptiert zusätzlich `CONVEX_URL` als Fallback,
  - behandelt frühe Convex-Startfehler im Polling als Warnung statt Prozessabbruch.
- `scripts/owl-e2e-smoke.mjs` ebenfalls mit automatischem `.env.local`-Load + `CONVEX_URL`-Fallback ausgestattet.
- README + CHANGELOG aktualisiert (neues Verhalten dokumentiert).

### Kurztest
- `npm run check` ausgeführt (**grün**, nur bekannte Warnungen in `convex/_generated/*`).
- `npm run dev:ops` gestartet: Next + Convex + Dispatcher laufen parallel, Dispatcher bleibt trotz initialem `ECONNREFUSED` aktiv und pollt weiter.
- Voller Smoke-Lauf erfolgreich:
  - `npm run owl:e2e:smoke -- --dispatcherTimeoutMs 240000 --waitTimeoutMs 240000`
  - Ergebnis: `enqueue -> done -> retry -> done` mit `retryCount=1`.
  - Run-Beispiel: `run_1770544926157_2oak6upw` (Retry: `run_1770544932728_f3jq64wy`).

### Nächster Schritt (12:00)
- PR-Finalisierung: Branch pushen, PR-Link erzeugen und in die Sprint-Fertigmeldung für Hasan aufnehmen; danach verbleibende MVP-Lücken gegen DoD gegentesten (insb. manuelle UI-Steuerpfade als Nachweis-Screens).

## 2026-02-08 12:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- Dashboard in `src/app/page.tsx` um **Live-Agent-Karten** erweitert (main/subagent/hybrid):
  - zeigt pro Scope den letzten Run mit Status-Badge,
  - zeigt aktive Run-Anzahl (`running|paused`) pro Scope,
  - bringt damit den in der Spezifikation geforderten Live-Blick auf Main + Subagents direkt neben die Timeline.
- Keine Backend-Migration nötig: Karten nutzen bestehende `commandQueue`-Daten, daher sofort mit laufendem Dispatcher wirksam.

### Kurztest
- `npm run check` im Ordner `mission-control` ausgeführt (**grün**, nur bekannte Warnungen in `convex/_generated/*`).
- UI-Sanity: Bei laufendem/pausiertem Run wechselt Status-Badge in den Karten ohne Refresh.

### Nächster Schritt (13:00)
- PR wirklich final öffnen (inkl. Link), MVP-DoD final abhaken und dann den stündlichen Sprint-Cron sauber deaktivieren.

## 2026-02-08 13:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- Neuer Live-Rückkanal für den globalen Cockpit-Zustand implementiert:
  - `convex/commandQueue.ts`: neue Query `liveOpsSnapshot` liefert `globalStatus` (`idle|thinking|coding|blocked`), Status-Zähler (`queued/running/paused/done/failed/canceled`) und aktive Run-Anzahl.
- Dashboard (`src/app/page.tsx`) um **Owl Body Status** ergänzt:
  - farbiger Live-Indikator aus dem Snapshot (rot=blocked, amber=coding, blau=thinking, grau=idle),
  - kompakte Echtzeit-Zähler für Queue/Run-Status,
  - aktive Runs direkt sichtbar ohne manuellen Timeline-Wechsel.
- Dokumentation aktualisiert:
  - `CHANGELOG.md` um Snapshot+Widget ergänzt.

### Kurztest
- `npm run check` im Ordner `mission-control` ausgeführt (**grün**, nur bekannte Warnungen in `convex/_generated/*`).
- UI-Sanity: Bei statuswechselnden Runs aktualisiert sich das Owl-Status-Widget ohne Refresh über Convex-Livequery.

### Nächster Schritt (14:00)
- PR-Link final liefern, MVP-DoD in `OWL_LIVE_OPS_E2E.md` final abhaken und bei bestätigter Fertigstellung den stündlichen Sprint-Cron deaktivieren.

## 2026-02-08 14:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- Neuer MVP-DoD-Checker implementiert: `scripts/owl-mvp-verify.mjs`.
  - prüft direkt aus Convex-Daten den aktuellen Erfüllungsstand der DoD-Kriterien:
    - realer Run vorhanden,
    - Live-Events vorhanden,
    - Stop+Retry nachweisbar,
    - Pause+Resume nachweisbar,
    - Ergebnis-Link + Summary vorhanden.
  - Ausgabe als Klartext oder JSON (`--json`) für Review-/CI-Nutzung.
- NPM-Command ergänzt: `npm run owl:mvp:verify`.
- Doku aktualisiert:
  - `README.md` (neues Workflow-Kommando)
  - `OWL_LIVE_OPS_E2E.md` (neuer Abschnitt „DoD-Status automatisch verifizieren“)
  - `CHANGELOG.md`.

### Kurztest
- `npm run owl:mvp:verify -- --help` ausgeführt (CLI-Interface validiert).
- `npm run check` ausgeführt (**grün**, nur bekannte Warnungen in `convex/_generated/*`).

### Blocker
- PR-Link kann aktuell nicht erzeugt werden, da `gh` lokal nicht authentifiziert ist (`gh auth login`/`GH_TOKEN` fehlt).
- Cron-Deaktivierung erfolgt direkt nach erfolgreicher PR-Erstellung + finaler MVP-Bestätigung.

### Nächster Schritt (15:00)
- GitHub-Auth herstellen, Branch pushen, PR-Link erzeugen, danach bei bestätigter MVP-Fertigstellung den Sprint-Cron `6ae8f4f2-164b-4b68-ae67-3bec243dcbb2` deaktivieren.

## 2026-02-08 15:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- Neuer PR-Blocker-Checker `scripts/owl-pr-readiness.mjs` implementiert:
  - prüft Branch/Remote, Working-Tree-Status, Upstream-Sync und `gh auth status`,
  - liefert klare Next-Commands für `push` + `gh pr create`,
  - optional JSON-Ausgabe via `--json` (für Skript-/CI-Weiterverarbeitung),
  - optional harter Exit bei Blockern via `--strict`.
- NPM-Command ergänzt: `npm run owl:pr:ready`.
- Doku aktualisiert:
  - `README.md` (Workflow-Kommando ergänzt)
  - `CHANGELOG.md`.

### Kurztest
- `npm run owl:pr:ready` ausgeführt: zeigt reproduzierbar die aktuellen Blocker (`gh` nicht eingeloggt, uncommitted changes) inkl. konkreter Next-Commands.
- `npm run check` ausgeführt (**grün**, nur bekannte Warnungen in `convex/_generated/*`).

### Blocker
- PR-Link weiterhin blockiert durch fehlende GitHub-Authentifizierung auf diesem Host (`gh auth login` oder `GH_TOKEN`).
- Cron-Deaktivierung erfolgt sofort nach erfolgreicher PR-Erstellung + finaler MVP-Fertigmeldung.

### Nächster Schritt (16:00)
- Priorisierungs-Lücke im Dashboard schließen (queued Commands müssen auch ohne `runId` priorisierbar sein) und Audit-Trail dafür sauber mit `commandId` erfassen.

## 2026-02-08 16:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- Priorisierungs-Bridge für **queued Commands ohne Run** geschlossen:
  - neue Convex-Mutation `commandQueue:prioritizeQueuedCommand` in `convex/commandQueue.ts`
  - erlaubt Priorisierung direkt über `commandId`, auch wenn noch keine `runId` existiert.
- Audit-Trail robuster gemacht:
  - `controlActions` speichert jetzt optional `commandId` zusätzlich zu `runId`.
  - bestehende `controlRun`-Aktionen schreiben ebenfalls `commandId` mit.
- Dashboard-UI (`src/app/page.tsx`) angepasst:
  - „Priorisieren“-Button ist jetzt bei `queued` sichtbar, auch ohne `runId`.
  - Button ruft nun `prioritizeQueuedCommand` statt `controlRun` auf.

### Kurztest
- `npm run check` im Ordner `mission-control` ausgeführt (**grün**, nur bekannte Warnungen in `convex/_generated/*`).
- `npm run owl:mvp:verify -- --help` ausgeführt (Verify-CLI weiterhin funktionsfähig).

### Blocker
- PR-Link weiterhin blockiert durch fehlende GitHub-Authentifizierung auf diesem Host (`gh auth login` oder `GH_TOKEN`).

### Nächster Schritt (17:00)
- Nach bereitgestellter GitHub-Auth: Branch pushen, PR erstellen, Link in Abschlussmeldung setzen und anschließend den Sprint-Cron `6ae8f4f2-164b-4b68-ae67-3bec243dcbb2` deaktivieren/entfernen.

## 2026-02-08 17:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- Dashboard (`src/app/page.tsx`) um einen sichtbaren **Audit-Trail für Steueraktionen** erweitert:
  - neuer Bereich „Audit-Trail (Controls)" direkt in der Live-Timeline-Karte,
  - zeigt `pause|resume|stop|retry|prioritize` inkl. Zeitstempel, Auslöser und Grund,
  - filtert automatisch auf den aktuell ausgewählten Run (oder zeigt global die letzten Aktionen, wenn kein Run gewählt ist).
- Damit ist der in der Spezifikation geforderte Audit-Aspekt jetzt nicht nur im Backend vorhanden, sondern auch operativ im Cockpit einsehbar.

### Kurztest
- `npm run check` im Ordner `mission-control` ausgeführt (**grün** bzgl. Typecheck/Lint; unverändert nur bekannte Warnungen in `convex/_generated/*`).

### Blocker
- PR-Link weiterhin blockiert durch fehlende GitHub-Authentifizierung auf diesem Host (`gh auth login` oder `GH_TOKEN`).

### Nächster Schritt (18:00)
- Sobald GitHub-Auth vorhanden ist: Branch pushen, PR erstellen, finalen Link posten und unmittelbar danach den Sprint-Cron `6ae8f4f2-164b-4b68-ae67-3bec243dcbb2` deaktivieren/entfernen.

## 2026-02-08 18:00 (Europe/Berlin)

### Geliefert (testbarer Fortschritt)
- Verifikationspfad robuster gemacht, damit der MVP-Check beim Ops-Start nicht mehr wegen Race-Conditions scheitert:
  - `scripts/owl-mvp-verify.mjs` unterstützt jetzt `--waitForBackendMs <n>` (pollt auf Convex-Verfügbarkeit, bevor DoD geprüft wird).
  - Fehlerdiagnose verbessert: bei `ECONNREFUSED` wird jetzt eine klare Handlungsanweisung ausgegeben (z. B. `npm run dev:ops`/`npx convex dev`) statt eines rohen Stacktraces.
  - `--json` liefert auch bei Fehlern ein strukturiertes Ergebnis (`ready:false`, `error`), damit nachgelagerte Automationen den Zustand sauber auswerten können.
- Doku aktualisiert:
  - `README.md` um `--waitForBackendMs` + Diagnoseverhalten ergänzt.
  - `CHANGELOG.md` erweitert.

### Kurztest
- `npm run check` im Ordner `mission-control` ausgeführt (**grün**).
- `npm run owl:mvp:verify -- --help` ausgeführt (neue Option sichtbar).
- `npm run owl:mvp:verify -- --json` ohne laufendes Convex geprüft: erwarteter, klarer Fehlertext statt Fetch-Stacktrace.

### Blocker
- PR-Link weiterhin blockiert durch fehlende GitHub-Authentifizierung auf diesem Host (`gh auth login` oder `GH_TOKEN`).

### Nächster Schritt (19:00)
- Unmittelbar nach Auth-Freigabe: `owl:pr:ready` + Push + PR-Link erzeugen; danach bei bestätigter MVP-Fertigstellung den Sprint-Cron `6ae8f4f2-164b-4b68-ae67-3bec243dcbb2` deaktivieren.
