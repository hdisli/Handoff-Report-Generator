#!/usr/bin/env node
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCommand(client, command, agentName) {
  const runId = command.runId;
  const failRequested = /\[(fail|error)\]/i.test(command.prompt);

  await client.mutation("commandQueue.appendRunEvent", {
    runId,
    kind: "connector",
    severity: "info",
    message: `Connector gestartet (${agentName})`,
    currentStep: "Connector initialisiert",
  });

  await sleep(500);

  await client.mutation("commandQueue.appendRunEvent", {
    runId,
    kind: "progress",
    severity: "info",
    message: "Dry-Run: Prompt analysiert und Ausführung vorbereitet",
    currentStep: "Prompt validiert",
  });

  await sleep(500);

  if (failRequested) {
    await client.mutation("commandQueue.setRunState", {
      runId,
      status: "failed",
      error: "Simulierter Connector-Fehler ([fail] Marker erkannt)",
      currentStep: "Mit Fehler beendet",
    });
    return;
  }

  const resultSummary = `MVP-Dry-Run erledigt: '${command.title}' wurde vom Dispatcher verarbeitet.`;
  await client.mutation("commandQueue.setRunState", {
    runId,
    status: "done",
    resultSummary,
    resultLink: "local://owl-live-ops/dry-run",
    currentStep: "Erfolgreich abgeschlossen",
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.has("--help")) {
    console.log(`Owl Live Ops Dispatcher\n\nOptionen:\n  --intervalMs <n>   Polling-Intervall (Default: 4000)\n  --agent <name>     Agent-Label (Default: owl-dispatcher)\n  --scope <all|main|subagent|hybrid>  Scope-Filter (Default: all)\n  --once             Genau einen Poll-Lauf ausführen\n`);
    return;
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL fehlt. Bitte .env.local laden oder env setzen.");
  }

  const intervalMs = Number(args.get("--intervalMs") ?? 4000);
  const agentName = args.get("--agent") ?? "owl-dispatcher";
  const preferredScope = args.get("--scope") ?? "all";
  const once = args.has("--once");

  const client = new ConvexHttpClient(convexUrl);

  const cycle = async () => {
    const next = await client.mutation("commandQueue.takeNextQueued", {
      dispatcher: agentName,
      assignedAgent: agentName,
      preferredScope,
    });

    if (!next) {
      return false;
    }

    console.log(`[dispatcher] run gestartet: ${next.runId} (${next.title})`);
    try {
      await runCommand(client, next, agentName);
      console.log(`[dispatcher] run abgeschlossen: ${next.runId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await client.mutation("commandQueue.setRunState", {
        runId: next.runId,
        status: "failed",
        error: message,
        currentStep: "Mit Ausnahme beendet",
      });
      console.error(`[dispatcher] run fehlgeschlagen: ${next.runId} -> ${message}`);
    }

    return true;
  };

  if (once) {
    await cycle();
    return;
  }

  console.log(`[dispatcher] gestartet (${agentName}), Polling alle ${intervalMs}ms`);
  while (true) {
    await cycle();
    await sleep(intervalMs);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
