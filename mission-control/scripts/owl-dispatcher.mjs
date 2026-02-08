#!/usr/bin/env node
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

function parseAgentJson(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) return null;
  const jsonStart = trimmed.lastIndexOf("\n{");
  const candidate = jsonStart >= 0 ? trimmed.slice(jsonStart + 1) : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

async function runAgentCommand({ command, scope, timeoutMs, onStdout, onStderr, signal }) {
  const args = ["agent", "--local", "--json", "--message", command.prompt];
  const agentMap = {
    main: process.env.OWL_MAIN_AGENT_ID || "main",
    subagent: process.env.OWL_SUBAGENT_AGENT_ID || "swarm-automation",
    hybrid: process.env.OWL_HYBRID_AGENT_ID || "swarm-automation",
  };
  const agentId = agentMap[scope] || "main";
  args.push("--agent", agentId);

  return await new Promise((resolve, reject) => {
    const child = spawn("openclaw", args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`OpenClaw-Run Timeout nach ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    signal?.addEventListener("abort", () => {
      child.kill("SIGTERM");
      reject(new Error("Run gestoppt (stop-Control)"));
    });

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      onStdout?.(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      onStderr?.(text);
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`openclaw agent exited with code ${code}: ${stderr || stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function runCommand(client, command, agentName, timeoutMs) {
  const runId = command.runId;
  const runAbort = new AbortController();

  await client.mutation("commandQueue:appendRunEvent", {
    runId,
    kind: "connector",
    severity: "info",
    message: `Echter OpenClaw-Connector gestartet (${agentName})`,
    currentStep: "OpenClaw-Run wird gestartet",
  });

  const stopWatcher = setInterval(async () => {
    try {
      const runContext = await client.query("commandQueue:getRunContext", { runId });
      if (runContext?.status === "canceled") {
        runAbort.abort();
      }
    } catch {
      // ignore poll errors; next cycle retries
    }
  }, 1200);

  try {
    const { stdout, stderr } = await runAgentCommand({
      command,
      scope: command.scope,
      timeoutMs,
      signal: runAbort.signal,
      onStdout: async (text) => {
        const compact = text.trim();
        if (!compact) return;
        await client.mutation("commandQueue:appendRunEvent", {
          runId,
          kind: "stdout",
          severity: "info",
          message: compact.slice(0, 300),
          currentStep: "Agent liefert Fortschritt",
        });
      },
      onStderr: async (text) => {
        const compact = text.trim();
        if (!compact) return;
        await client.mutation("commandQueue:appendRunEvent", {
          runId,
          kind: "stderr",
          severity: "warning",
          message: compact.slice(0, 300),
          currentStep: "Agent-Ausgabe prüfen",
        });
      },
    });

    const payload = parseAgentJson(stdout) || parseAgentJson(stderr);
    const sessionKey = payload?.sessionKey ?? payload?.sessionId;
    const summary = payload?.reply?.slice?.(0, 280) || payload?.text?.slice?.(0, 280) || "OpenClaw-Run erfolgreich abgeschlossen.";

    await client.mutation("commandQueue:attachRunSession", {
      runId,
      sessionKey,
      assignedAgent: payload?.agentId,
    });

    await client.mutation("commandQueue:setRunState", {
      runId,
      status: "done",
      resultSummary: summary,
      resultLink: sessionKey ? `openclaw://session/${sessionKey}` : "openclaw://agent/local",
      currentStep: "Erfolgreich abgeschlossen",
    });
  } finally {
    clearInterval(stopWatcher);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.has("--help")) {
    console.log(`Owl Live Ops Dispatcher\n\nOptionen:\n  --intervalMs <n>   Polling-Intervall (Default: 4000)\n  --agent <name>     Agent-Label (Default: owl-dispatcher)\n  --scope <all|main|subagent|hybrid>  Scope-Filter (Default: all)\n  --timeoutMs <n>    Timeout pro OpenClaw-Run (Default: 600000)\n  --once             Genau einen Poll-Lauf ausführen\n`);
    return;
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL fehlt. Bitte .env.local laden oder env setzen.");
  }

  const intervalMs = Number(args.get("--intervalMs") ?? 4000);
  const timeoutMs = Number(args.get("--timeoutMs") ?? 600000);
  const agentName = args.get("--agent") ?? "owl-dispatcher";
  const preferredScope = args.get("--scope") ?? "all";
  const once = args.has("--once");

  const client = new ConvexHttpClient(convexUrl);

  const cycle = async () => {
    const next = await client.mutation("commandQueue:takeNextQueued", {
      dispatcher: agentName,
      assignedAgent: agentName,
      preferredScope,
    });

    if (!next) {
      return false;
    }

    console.log(`[dispatcher] run gestartet: ${next.runId} (${next.title})`);
    try {
      await runCommand(client, next, agentName, timeoutMs);
      console.log(`[dispatcher] run abgeschlossen: ${next.runId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const canceled = /gestoppt|stop-control/i.test(message);
      await client.mutation("commandQueue:setRunState", {
        runId: next.runId,
        status: canceled ? "canceled" : "failed",
        error: message,
        currentStep: canceled ? "Manuell gestoppt" : "Mit Ausnahme beendet",
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
