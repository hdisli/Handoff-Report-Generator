# Social Media Agentenschwarm – All-in-One (V2.1)

## Ziel
Aus Ideen täglich mehrere plattformgerechte Assets erzeugen, ausspielen und über Analytics verbessern.

## Rollen (8)
1. Orchestrator (Lead)
2. Trend/Research-Agent
3. Hook-Agent
4. Script-Agent
5. Video-Production-Agent
6. Distribution-Agent
7. Community-Agent
8. QA+Analytics-Agent

## Standard-Übergabeformat
- TASK_ID
- ZIEL
- INPUT
- OUTPUT
- QUALITÄTSSCORE (1-10)
- RISIKEN
- NÄCHSTER SCHRITT

## Pipeline
1) Research
2) Hooks
3) Scripts
4) Video-Produktion
5) QA
6) Distribution/Queue
7) GO-Freigabe
8) Analytics (24/48/72h)

## QA-Gate
- Hook <1s klar
- Retention-freundliches Tempo
- Untertitel lesbar
- Plattformfit
- CTA vorhanden
- Policy-/Brand-Risiko geprüft

## Entscheidungslogik nach 48h
- SCALE: starke Retention + Share/Save
- REPACKAGE: Thema gut, Hook/Packaging schwach
- DROP: 2 Iterationen ohne Signal

## Freigabe-Regel
Keine öffentliche Veröffentlichung ohne GO von Hasan.

---

## Command Set

### RUN_BATCH
Startet: Research → Hooks → Scripts → Video → QA → Queue

Syntax:
`RUN_BATCH | nische=<...> | ziel=<reach|leads|sales> | assets=<zahl> | tempo=<low|med|high>`

### RUN_RESEARCH
`RUN_RESEARCH | nische=<...> | horizon=<24h|72h|7d> | count=<zahl>`

### RUN_SCRIPTING
`RUN_SCRIPTING | input=<themenliste|task_id> | hooks=<zahl> | scripts=<zahl>`

### RUN_VIDEO
`RUN_VIDEO | input=<task_id|liste> | variants=<A/B/C> | styles=<clean,fast>`

### QA_ONLY
`QA_ONLY | input=<task_id|asset_ids> | strict=<true|false>`

### BUILD_QUEUE
`BUILD_QUEUE | input=<go_assets> | platforms=<tt,ig,yt,x> | days=<1-7>`

### GO_QUEUE
`GO_QUEUE | ids=<all|liste>`

### REWORK
`REWORK | ids=<liste> | focus=<hook|pace|caption|cta|platform_fit>`

### ANALYZE
`ANALYZE | window=<24h|48h|72h> | input=<campaign|asset_ids>`

### SCALE_WINNERS
`SCALE_WINNERS | input=<analysis_id|last> | factor=<2x|3x>`

### PAUSE
`PAUSE | scope=<all|role|task_id>`

### STATUS
`STATUS | scope=<today|queue|kpi|all>`

## Ultra-kurz
- START = RUN_BATCH (Standardwerte)
- STOP = PAUSE | scope=all
- CHECK = STATUS | scope=all
- PUSH = SCALE_WINNERS (letzte Analyse)

## Standardwerte
- ziel=reach
- assets=10
- tempo=med
- platforms=tt,ig,yt
- variants=A/B/C
- timezone=Europe/Berlin

---

## Master-Prompts
Vollständige Prompts liegen in:
- `swarm/SWARM_MASTER_PROMPTS.md`

Zusatzdateien:
- `swarm/SWARM_BLUEPRINT_V2.1.md`
- `swarm/SWARM_COMMANDS.md`
