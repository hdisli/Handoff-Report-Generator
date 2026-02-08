# Owl Live Ops Cockpit – E2E-Nachweis (MVP)

Stand: 2026-02-08 10:00 (Europe/Berlin)

Dieses Dokument liefert einen reproduzierbaren Testablauf für die Definition of Done:
- Dashboard-Eintrag startet echten Agent-Run
- Live-Status kommt ohne Refresh
- Steuerung (`pause/resume/stop/retry`) funktioniert
- Ergebnis inkl. Link wird angezeigt

## Voraussetzungen

1. Convex + Web + Dispatcher laufen:
   ```bash
   npm run dev:ops
   ```
2. `NEXT_PUBLIC_CONVEX_URL` ist gesetzt (`.env.local`).
3. OpenClaw CLI ist lokal verfügbar (`openclaw ...`).

## A) Schneller Smoke-Test (automatisiert)

```bash
npm run owl:e2e:smoke
```

Erwartung:
- Script legt Command in Queue,
- Dispatcher verarbeitet ihn (`done`),
- Script triggert `retry`,
- Dispatcher verarbeitet erneut (`done`, `retryCount >= 1`).

## B) Manueller Volltest im Dashboard (inkl. Controls)

### 1) Queue -> Running -> Done

- Öffne `http://localhost:3000`
- In **Owl Live Ops · Command Queue**:
  - Titel: `E2E Full Run`
  - Prompt: `Schreibe exakt eine Zeile: OWL_E2E_DONE`
  - Scope: `main`
  - Priorität: `high`
- Erwartung:
  - Status wechselt `queued -> running -> done`
  - Live-Timeline zeigt Connector-/stdout-Events
  - `resultSummary` erscheint
  - `resultLink` wird klickbar angezeigt

### 2) Pause/Resume

- Neuer Command:
  - Titel: `E2E Pause Resume`
  - Prompt: `Arbeite 30 Sekunden und gib alle 5 Sekunden einen Fortschritt aus.`
- Wenn Status `running` ist:
  - `Pause` klicken
  - Erwartung: Status `paused`, Timeline-Event „Run pausiert“
- Danach `Resume` klicken
  - Erwartung: Status zurück zu `running`, Timeline-Event „Run fortgesetzt“

### 3) Stop

- Neuer Command:
  - Titel: `E2E Stop`
  - Prompt: `Führe eine längere Aufgabe aus (mindestens 60 Sekunden).`
- Während `running`:
  - `Stop` klicken
  - Erwartung: Status `canceled`, Fehler-/Hinweistext „Manuell gestoppt“

### 4) Retry

- Beim eben gestoppten (oder einem failed/done) Run:
  - `Retry` klicken
  - Erwartung: Command zurück auf `queued`, danach wieder verarbeitbar
  - Nach Dispatcher-Lauf: erneut `done` oder erwarteter Zielstatus

## Test-Checkliste (MVP-DoD)

- [ ] UI-Eintrag startet nachweisbar einen realen Agent-Run
- [ ] Event-Stream aktualisiert sich live ohne Refresh
- [ ] Stop/Retry funktionieren
- [ ] Pause/Resume funktionieren
- [ ] Ergebnis-Link + Summary sind sichtbar

## C) DoD-Status automatisch verifizieren

```bash
npm run owl:mvp:verify
```

Optional als JSON (für CI/Copy-Paste):

```bash
npm run owl:mvp:verify -- --json
```

Hinweis: Dafür muss Convex laufen (`npm run dev:backend` oder `npm run dev:ops`).

## Hinweise für PR-Review

- Fokusdateien:
  - `scripts/owl-e2e-smoke.mjs`
  - `scripts/owl-dispatcher.mjs`
  - `src/app/page.tsx`
  - `convex/commandQueue.ts`
- Smoke-Test ausführen und Output im PR-Kommentar anhängen.
