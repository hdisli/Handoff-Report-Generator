# Changelog

## 2026-02-08

### Added
- `handoff-report` erkennt jetzt automatische Risiko-Signale (z. B. Schema-/Config-/Dependency-Änderungen, große Diffs) für schnellere PR-Reviews.
- Optionaler Smoke-Check via `--smoke-cmd`, damit Handoffs direkt ein kurzes Test-Ergebnis mitführen.
- Owl Live Ops MVP Phase 1: neues Convex-Datenmodell (`commandQueue`, `agentRuns`, `agentRunEvents`, `controlActions`) inkl. Status-/Audit-Felder für echte Agent-Runs.
- Neue Convex-Bridge-Basics in `convex/commandQueue.ts`: Queue-Ingestion, Dispatcher-Locking (`takeNextQueued`), Live-Run-Events, Statusabschluss und Control-Aktionen (pause/resume/stop/retry/prioritize).

### Updated
- README um die neue Handoff-/Smoke-Check-Nutzung ergänzt.

## 2026-02-07

### Added
- `npm run dev:all` startet Next.js und Convex parallel (ein Terminal statt zwei).
- `npm run dev:web` und `npm run dev:backend` für gezieltes lokales Starten.
- `npm run typecheck` und `npm run check` (Lint + Typecheck) für schnellere Qualitätsprüfung vor Commits.

### Updated
- README-Startanleitung und Workflow-Kommandos dokumentiert.
