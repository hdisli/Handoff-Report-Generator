#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { ConvexHttpClient } from "convex/browser";

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const [k, v] = token.split("=");
    if (v !== undefined) {
      args.set(k, v);
    } else if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
      args.set(k, argv[i + 1]);
      i += 1;
    } else {
      args.set(k, "true");
    }
  }
  return args;
}

function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function hasAction(actions, action) {
  return actions.some((item) => item.action === action);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.has("--help")) {
    console.log("Owl MVP Verify\n\nPrüft den aktuellen Convex-Stand gegen die MVP-DoD-Checks.\n\nOptionen:\n  --limit <n>      Anzahl Queue-Einträge (Default: 80)\n  --json           JSON-Ausgabe statt Text\n");
    return;
  }

  loadDotEnvLocal();

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL fehlt.");

  const limit = Number(args.get("--limit") ?? 80);
  const client = new ConvexHttpClient(convexUrl);

  const rows = await client.query("commandQueue:list", { status: "all", limit });
  const runIds = Array.from(new Set(rows.map((row) => row.runId).filter(Boolean)));

  const eventsByRun = new Map();
  for (const runId of runIds) {
    const events = await client.query("commandQueue:listRunEvents", { runId, limit: 120 });
    eventsByRun.set(runId, events);
  }

  const controlActions = await client.query("commandQueue:listControlActions", { limit: 400 });

  const checks = {
    realRun: rows.some((row) => row.status === "done" && !!row.runId),
    liveEvents: Array.from(eventsByRun.values()).some((events) => events.length > 0),
    stopRetry: hasAction(controlActions, "stop") && hasAction(controlActions, "retry"),
    pauseResume: hasAction(controlActions, "pause") && hasAction(controlActions, "resume"),
    resultVisible: rows.some((row) => row.status === "done" && !!row.resultSummary && !!row.resultLink),
  };

  const summary = {
    checkedAt: new Date().toISOString(),
    queueSize: rows.length,
    runCount: runIds.length,
    checks,
    ready: Object.values(checks).every(Boolean),
  };

  if (args.has("--json")) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const line = (ok) => (ok ? "✅" : "❌");
  console.log(`Owl MVP Verify (${summary.checkedAt})`);
  console.log(`${line(checks.realRun)} UI-Eintrag startet realen Agent-Run`);
  console.log(`${line(checks.liveEvents)} Event-Stream liefert Live-Events`);
  console.log(`${line(checks.stopRetry)} Stop + Retry in Event-Historie gefunden`);
  console.log(`${line(checks.pauseResume)} Pause + Resume in Event-Historie gefunden`);
  console.log(`${line(checks.resultVisible)} Ergebnis-Link + Summary vorhanden`);
  console.log(`\nGesamtstatus: ${summary.ready ? "MVP-DoD erfüllt" : "MVP-DoD noch unvollständig"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
