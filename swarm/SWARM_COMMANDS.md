# Swarm Command Set

## Core Commands

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
