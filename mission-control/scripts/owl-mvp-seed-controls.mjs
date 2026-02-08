#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDispatcherOnce(timeoutMs = 180000) {
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
    const rows = await client.query("commandQueue:list", { status: "all", limit: 120 });
    const row = rows.find((item) => item._id === commandId);
    if (row) return row;
    await sleep(500);
  }
  throw new Error(`Command ${commandId} wurde nicht gefunden`);
}

async function waitForTerminal(client, commandId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await waitForCommand(client, commandId, 5000);
    if (["done", "failed", "canceled"].includes(row.status)) return row;
    await sleep(1000);
  }
  throw new Error(`Timeout: Command ${commandId} hat keinen Terminal-Status erreicht`);
}

async function main() {
  loadDotEnvLocal();
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL fehlt.");

  const client = new ConvexHttpClient(convexUrl);
  const title = `MVP Control Seed ${new Date().toISOString()}`;

  const commandId = await client.mutation("commandQueue:enqueue", {
    createdBy: "owl-mvp-seed-controls",
    source: "owl-mvp-seed-controls",
    title,
    prompt: "Schreibe exakt eine Zeile: MVP_CONTROL_SEED_OK",
    scope: "main",
    priority: "high",
  });

  console.log(`[seed] Command enqueued: ${commandId}`);
  await runDispatcherOnce();

  let row = await waitForTerminal(client, commandId, 240000);
  if (row.status !== "done" || !row.runId) {
    throw new Error(`Initialer Run nicht done/runId fehlt: status=${row.status}`);
  }

  const runId = row.runId;
  console.log(`[seed] Initial run done: ${runId}`);

  for (const action of ["pause", "resume", "stop", "retry"]) {
    await client.mutation("commandQueue:controlRun", {
      runId,
      action,
      triggeredBy: "owl-mvp-seed-controls",
      reason: "MVP DoD Seed",
    });
    console.log(`[seed] control action sent: ${action}`);
  }

  await runDispatcherOnce();
  row = await waitForTerminal(client, commandId, 240000);

  if (row.status !== "done") {
    throw new Error(`Retry-Run nicht erfolgreich: ${row.status}`);
  }

  console.log(`[seed] OK: controls exercised, command back to done (${commandId})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
