# Schwarm – Produktionsaktivierung (Live)

Stand: aktiviert am 2026-02-08

## Was technisch live geschaltet wurde

- Multi-Agent Setup in OpenClaw-Config angelegt (`agents.list`)
- Main-Orchestrator (`main`) darf folgende Subagents starten:
  - `swarm-research`
  - `swarm-hook`
  - `swarm-script`
  - `swarm-video`
  - `swarm-distribution`
  - `swarm-community`
  - `swarm-qa`
  - `swarm-automation`
- Agent-to-Agent Zugriff aktiviert (`tools.agentToAgent.enabled=true`) mit gezielter Allowlist `main->swarm-*`
- Gateway-Neustart automatisch ausgeführt (config.patch)

## Agentenrollen (live)

- `main` → Orchestrator
- `swarm-research` → Trends/Research (Web-Tools erlaubt)
- `swarm-hook` → Hooks
- `swarm-script` → Skripte
- `swarm-video` → Video-Ops (inkl. exec/process)
- `swarm-distribution` → Plattform-Packaging
- `swarm-community` → Kommentar/DM-Playbooks
- `swarm-qa` → QA + Analytics
- `swarm-automation` → Automationen/Cron/Exec

## Wichtige Grenze

Der Schwarm ist jetzt organisatorisch + technisch aktivierbar.
Für echtes Auto-Posting und echtes Video-Rendering brauchst du zusätzlich die konkreten externen Konten/Tools (z. B. Posting-API, Render-Toolchain) in der jeweiligen Umgebung.

## Start-Kommandos im Chat

1. `RUN_BATCH | nische=<...> | ziel=reach | assets=12 | tempo=high`
2. `STATUS | scope=all`
3. `BUILD_QUEUE | input=<go_assets> | platforms=tt,ig,yt,x | days=2`
4. `GO_QUEUE | ids=all` (nur wenn du freigibst)
5. `ANALYZE | window=48h | input=<campaign>`
6. `SCALE_WINNERS | input=last | factor=2x`

## Sicherheits-/Freigaberegeln

- Keine öffentliche Veröffentlichung ohne explizites GO von Hasan
- Keine kostenpflichtigen Aktionen ohne GO
- Keine destruktiven Änderungen ohne Rückfrage
