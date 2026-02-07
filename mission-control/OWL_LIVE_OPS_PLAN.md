# Owl Live Ops Cockpit – Umsetzungsplan (Stand: 2026-02-08)

## Ziel
`localhost:3000` soll nicht nur visualisieren, sondern **aus Eingaben echte Ausführung** machen (Main-Agent + Subagents), inkl. Live-Status, Steuerung und Audit.

---

## Ist-Zustand (heute)
- Dashboard + Convex laufen.
- UI kann Tasks/Activities/Approvals speichern.
- Es gibt Event-Ingestion (`convex/events.ts`) für Activity-Feed.
- Es gibt **keine Bridge** von Dashboard-Input -> OpenClaw-Agent-Ausführung.

Konsequenz: Einträge im UI lösen aktuell keine Umsetzung durch den Agent aus.

---

## Soll-Zustand (MVP)
1. UI-Eingabe erzeugt `command` in Queue.
2. Worker/Bridge nimmt `queued` Commands, startet OpenClaw-Run.
3. Live-Status wird zurückgeschrieben (`running`, `progress`, `done|failed`).
4. Dashboard zeigt Main + Subagents live mit klaren Zuständen.
5. Steuerung im UI: pause/resume/stop/retry/priorisieren.
6. Voller Audit-Trail mit Zeitstempeln + Ergebnis/PR-Link.

---

## Datenmodell (Convex)
### Neue Tabellen
- `commandQueue`
  - `createdAt`, `createdBy`, `source`
  - `title`, `prompt`, `scope`, `priority`
  - `status`: `queued|running|paused|done|failed|canceled`
  - `assignedAgent`, `sessionKey`, `runId`
  - `resultSummary`, `resultLink`, `error`
- `agentRuns`
  - `runId`, `commandId`, `agentType` (`main|subagent`), `agentLabel`
  - `startedAt`, `endedAt`, `status`, `currentStep`
- `agentRunEvents`
  - `runId`, `ts`, `kind`, `severity`, `message`, `metadata`
- `controlActions`
  - `runId`, `action`, `triggeredBy`, `ts`, `reason`

### Statusmodell
- global: `idle|thinking|coding|testing|blocked|review|done`
- pro Run: `queued|running|paused|done|failed|canceled`

---

## Bridge/Orchestrierung (entscheidend)
## A) Command-Ingestion
- UI schreibt nur in `commandQueue` (`queued`).
- Validierung: Scope, Risk-Flag, GO-Pflicht für kritische Aktionen.

## B) Dispatcher
- zyklisch/triggerbasiert: nimmt nächsten `queued` Command.
- setzt atomar auf `running` (Lock), verhindert Doppelstart.

## C) OpenClaw-Connector
- startet Ausführung über Agent-Runs (Main/Subagent je nach Command).
- schreibt `sessionKey/runId` zurück.
- streamt Fortschritt in `agentRunEvents`.

## D) Completion
- bei Erfolg: `done` + `resultSummary` + PR-Link.
- bei Fehler: `failed` + Fehlergrund + Retry-Option.

---

## UI-Module
1. **Owl-Body** (zentral)
   - Augenfarbe = globaler Status
   - Pulsintensität = parallele Runs
   - Blocker-Indikator bei `blocked|failed`
2. **Live-Timeline**
   - Event-Stream mit Filter (all/main/subagent/error/review)
3. **Agent-Karten**
   - aktueller Schritt, Laufzeit, letzte Aktion
4. **Decision Queue**
   - Fälle, die GO brauchen (Approve/Reject)
5. **Control Bar**
   - pause/resume/stop/retry/prio

---

## Sicherheit & Governance
- Keine Auto-Merges in `main`.
- GO-Gates für kritische/teure/externe Schritte.
- Jede Aktion mit Audit-Eintrag.
- `read-only mode` für Beobachtung ohne Ausführung.

---

## 04:00-Sprintplan (stündlicher Fortschritt)
### Phase 1 (04:00)
- `commandQueue` + `agentRuns` + `agentRunEvents` Schema anlegen.
- CRUD/Mutations + Basisstatusflüsse.

### Phase 2 (05:00)
- Dashboard: Command-Erfassung + Queue-Ansicht + Status-Badges.
- Live-Timeline auf `agentRunEvents` aufsetzen.

### Phase 3 (06:00)
- Dispatcher-Grundlogik + Locking + Retry-Mechanik.
- Simulierter Connector (Dry-Run), damit End-to-End testbar wird.

### Phase 4 (07:00)
- Echter OpenClaw-Connector (Main/Subagent-Start) + Rückkanal.
- Erste Steuerbefehle: stop/retry/prio.

### Danach stündlich bis MVP fertig
- Control-Panel vervollständigen, Owl-Animation an Status binden,
- Fehlertoleranz + Audit verbessern,
- Doku + PR.

---

## Definition of Done (MVP)
- UI-Eintrag startet nachweisbar einen realen Agent-Run.
- Live-Status + Events kommen ohne Refresh an.
- Stop/Retry funktionieren.
- Ergebnis inkl. PR-Link wird im Dashboard sichtbar.
- Kurz-Doku + Testhinweise vorhanden.
