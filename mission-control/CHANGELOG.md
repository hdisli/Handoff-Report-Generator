# Changelog

## 2026-02-08

### Added
- `handoff-report` erkennt jetzt automatische Risiko-Signale (z. B. Schema-/Config-/Dependency-Änderungen, große Diffs) für schnellere PR-Reviews.
- Optionaler Smoke-Check via `--smoke-cmd`, damit Handoffs direkt ein kurzes Test-Ergebnis mitführen.
- Owl Live Ops MVP Phase 1: neues Convex-Datenmodell (`commandQueue`, `agentRuns`, `agentRunEvents`, `controlActions`) inkl. Status-/Audit-Felder für echte Agent-Runs.
- Neue Convex-Bridge-Basics in `convex/commandQueue.ts`: Queue-Ingestion, Dispatcher-Locking (`takeNextQueued`), Live-Run-Events, Statusabschluss und Control-Aktionen (pause/resume/stop/retry/prioritize).
- Neuer Host-Dispatcher `scripts/owl-dispatcher.mjs` für End-to-End-Bridge: Queue-Polling, simulierter Connector und Live-Status-Rückkanal (`queued -> running -> done/failed`).
- Echte OpenClaw-Connector-Bridge im Dispatcher (`openclaw agent --local --json`) inkl. sessionKey-Rückkanal, stdout/stderr-Liveevents und Stop-Unterstützung.
- Neue Convex-Endpunkte `getRunContext` + `attachRunSession` für Run-Steuerung/Rückkanal.
- Dashboard-Run-Steuerung für `pause/resume/stop`, `retry`, `prioritize` in der Command-Queue.
- Dispatcher verarbeitet `pause/resume` jetzt aktiv über Prozesssignale (SIGSTOP/SIGCONT) und schreibt dazu Live-Feedback-Events.
- Neue Scripts `npm run owl:dispatcher`, `npm run owl:e2e:smoke` und `npm run dev:ops` (Web + Convex + Dispatcher).
- Live-Agent-Karten im Dashboard (main/subagent/hybrid) mit Scope-Status + aktiver Run-Anzahl als schneller Main/Subagent-Überblick.
- Neues Convex-Live-Snapshot `commandQueue.liveOpsSnapshot` + „Owl Body Status“-Widget im Dashboard (Globalstatus + Queue-Zähler + aktive Runs) als kompakter Live-Rückkanal.
- Neues Verifikationsscript `scripts/owl-mvp-verify.mjs` + npm-Command `owl:mvp:verify`, das MVP-DoD-Kriterien direkt gegen den aktuellen Convex-Run-Verlauf prüft.
- `owl:mvp:verify` unterstützt jetzt `--waitForBackendMs`, damit Verifikation auch direkt beim Hochfahren von Convex robust automatisiert werden kann.
- Neues Script `scripts/owl-pr-readiness.mjs` + npm-Command `owl:pr:ready` als PR-Blocker-Check (Working Tree, Upstream, GitHub-Auth) mit klaren Next-Commands.
- Neues Dispatcher-Heartbeat-Modell (`dispatcherHeartbeats`) inkl. Convex-Endpunkten `dispatcherHeartbeat` und `dispatcherStatus` für Online/Offline-Health des echten Connectors.
- `owl:e2e:smoke` schreibt jetzt einen Markdown-Report (`outputs/owl-e2e-latest.md`) mit Event-Trace für Erstlauf + Retry.
- Dispatcher-Selftest (`--selftest`) für die interne Link-Erkennung ergänzt, inkl. Priorisierung von GitHub-PR/Issue-URLs.
- Neuer Dispatcher-Read-only-Modus (`--readOnly` / `OWL_READ_ONLY_MODE=true`) für sichere Beobachtung ohne Queue-Konsum.

### Updated
- README um die neue Handoff-/Smoke-Check-Nutzung ergänzt.
- Owl-Dispatcher auf Convex-HTTP-Funktionspfade (`commandQueue:...`) korrigiert und mit Default-Agent-Mapping (`main` / `swarm-automation`) robuster gemacht.
- Command-Queue-UI zeigt jetzt `sessionKey` und klickbaren `resultLink` für schnellere Nachverfolgung.
- Dispatcher + Smoke-Test laden `.env.local` automatisch (Fallback `CONVEX_URL`) und bleiben beim Start-Race gegen Convex robust (Polling-Fehler führen nicht mehr zum Prozessabbruch).
- Dashboard-Priorisierung für `queued` Commands ohne `runId` repariert: neuer Mutationspfad `prioritizeQueuedCommand`; Audit-Trail (`controlActions`) speichert zusätzlich optional `commandId`.
- Dashboard-Live-Timeline zeigt jetzt zusätzlich einen sichtbaren Audit-Trail für Control-Aktionen (`pause/resume/stop/retry/prioritize`) inkl. Filter auf den aktuell ausgewählten Run.
- `owl:mvp:verify` liefert bei nicht erreichbarem Convex-Backend nun eine klare, handlungsorientierte Fehlermeldung (inkl. Start-Hinweis) statt unklarem Stacktrace.
- Dashboard zeigt im Owl-Body zusätzlich den Dispatcher-Health (online/offline, state, letzte Meldung) als Live-Indikator für die echte Queue->Run-Bridge.
- Live-Timeline kann jetzt auch als globaler Stream laufen (ohne ausgewählten Run) inkl. Scope-/Severity-Filter und Scope-Badge pro Event.
- `owl:e2e:smoke` validiert jetzt die Pflicht-Eventkette (`dispatch -> connector -> stdout/stderr -> done`) für beide Läufe statt nur Endstatus.
- Dispatcher setzt `resultLink` jetzt bevorzugt auf externen Nachweis-Link aus dem Agent-Output (z. B. GitHub-PR) und fällt erst dann auf Session-Link zurück.

## 2026-02-07

### Added
- `npm run dev:all` startet Next.js und Convex parallel (ein Terminal statt zwei).
- `npm run dev:web` und `npm run dev:backend` für gezieltes lokales Starten.
- `npm run typecheck` und `npm run check` (Lint + Typecheck) für schnellere Qualitätsprüfung vor Commits.

### Updated
- README-Startanleitung und Workflow-Kommandos dokumentiert.
