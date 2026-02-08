#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function runDispatcherOnce(timeoutMs) {
  await new Promise((resolve, reject) => {
    const child = spawn("node", ["scripts/owl-dispatcher.mjs", "--once", `--timeoutMs=${timeoutMs}`], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Dispatcher --once fehlgeschlagen (Exit ${code})`));
        return;
      }
      resolve();
    });
  });
}

async function waitForCommand(client, commandId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = await client.query("commandQueue:list", { status: "all", limit: 100 });
    const row = rows.find((item) => item._id === commandId);
    if (row) return row;
    await sleep(1000);
  }
  throw new Error(`Command ${commandId} wurde nicht gefunden`);
}

async function waitForTerminalState(client, commandId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await waitForCommand(client, commandId, 5000);
    if (["done", "failed", "canceled"].includes(row.status)) {
      return row;
    }
    await sleep(1500);
  }
  throw new Error(`Timeout: Command ${commandId} hat keinen Terminal-Status erreicht`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.has("--help")) {
    console.log("Owl Live Ops Smoke-E2E\n\nErfordert laufendes Convex-Backend (NEXT_PUBLIC_CONVEX_URL).\nDer Test prüft: enqueue -> dispatcher run -> done -> retry -> done.\n\nOptionen:\n  --dispatcherTimeoutMs <n>  Timeout für einen Dispatcher-Lauf (Default: 180000)\n  --waitTimeoutMs <n>        Timeout fürs Warten auf Terminal-Status (Default: 240000)\n");
    return;
  }

  loadDotEnvLocal();

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL fehlt.");
  }

  const dispatcherTimeoutMs = Number(args.get("--dispatcherTimeoutMs") ?? 180000);
  const waitTimeoutMs = Number(args.get("--waitTimeoutMs") ?? 240000);
  const client = new ConvexHttpClient(convexUrl);

  const title = `Smoke E2E ${new Date().toISOString()}`;
  const commandId = await client.mutation("commandQueue:enqueue", {
    createdBy: "owl-e2e-smoke",
    source: "owl-e2e-script",
    title,
    prompt: "Schreibe exakt eine Zeile: E2E_SMOKE_OK",
    scope: "main",
    priority: "high",
  });

  console.log(`[e2e] Command enqueued: ${commandId}`);
  await runDispatcherOnce(dispatcherTimeoutMs);
  let row = await waitForTerminalState(client, commandId, waitTimeoutMs);

  if (row.status !== "done") {
    throw new Error(`Erster Lauf nicht erfolgreich: ${row.status} (${row.error ?? "kein Fehlertext"})`);
  }
  if (!row.runId) {
    throw new Error("Erster Lauf hat keine runId.");
  }

  console.log(`[e2e] Erster Lauf done (${row.runId}), starte Retry...`);
  await client.mutation("commandQueue:controlRun", {
    runId: row.runId,
    action: "retry",
    triggeredBy: "owl-e2e-smoke",
    reason: "Automatischer Smoke-Retry",
  });

  await runDispatcherOnce(dispatcherTimeoutMs);
  row = await waitForTerminalState(client, commandId, waitTimeoutMs);

  if (row.status !== "done") {
    throw new Error(`Retry-Lauf nicht erfolgreich: ${row.status} (${row.error ?? "kein Fehlertext"})`);
  }

  if ((row.retryCount ?? 0) < 1) {
    throw new Error(`Retry-Zähler unerwartet: ${row.retryCount}`);
  }

  console.log(`[e2e] OK: ${commandId} -> done (retryCount=${row.retryCount})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
