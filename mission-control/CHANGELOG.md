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

### Updated
- README um die neue Handoff-/Smoke-Check-Nutzung ergänzt.
- Owl-Dispatcher auf Convex-HTTP-Funktionspfade (`commandQueue:...`) korrigiert und mit Default-Agent-Mapping (`main` / `swarm-automation`) robuster gemacht.
- Command-Queue-UI zeigt jetzt `sessionKey` und klickbaren `resultLink` für schnellere Nachverfolgung.
- Dispatcher + Smoke-Test laden `.env.local` automatisch (Fallback `CONVEX_URL`) und bleiben beim Start-Race gegen Convex robust (Polling-Fehler führen nicht mehr zum Prozessabbruch).

## 2026-02-07

### Added
- `npm run dev:all` startet Next.js und Convex parallel (ein Terminal statt zwei).
- `npm run dev:web` und `npm run dev:backend` für gezieltes lokales Starten.
- `npm run typecheck` und `npm run check` (Lint + Typecheck) für schnellere Qualitätsprüfung vor Commits.

### Updated
- README-Startanleitung und Workflow-Kommandos dokumentiert.
