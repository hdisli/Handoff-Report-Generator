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

function parseBoolean(value) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
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

function extractResultLink(...sources) {
  const merged = sources
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join("\n");
  if (!merged) return null;

  const urlRegex = /(https?:\/\/[^\s)\]}>"']+)/gi;
  const urls = [];
  let match;
  while ((match = urlRegex.exec(merged))) {
    urls.push(match[1]);
  }

  if (urls.length === 0) return null;

  const prioritized = urls.find((url) => /github\.com\/[^/]+\/[^/]+\/(pull|issues)\/\d+/i.test(url));
  return prioritized ?? urls[0] ?? null;
}

function runSelfTest() {
  const samples = [
    {
      name: "priorisiert PR-Link",
      input: ["Fertig. PR: https://github.com/acme/owl/pull/42\nSession: openclaw://session/abc"],
      expected: "https://github.com/acme/owl/pull/42",
    },
    {
      name: "fällt auf erste URL zurück",
      input: ["Siehe Doku https://docs.example.com/run und Logs https://logs.example.com/1"],
      expected: "https://docs.example.com/run",
    },
    {
      name: "keine URL ergibt null",
      input: ["Nur Text ohne Link"],
      expected: null,
    },
  ];

  let failed = 0;
  for (const sample of samples) {
    const actual = extractResultLink(...sample.input);
    if (actual !== sample.expected) {
      failed += 1;
      console.error(`[selftest] FAIL ${sample.name}: expected=${sample.expected} actual=${actual}`);
    } else {
      console.log(`[selftest] OK   ${sample.name}`);
    }
  }

  if (failed > 0) {
    throw new Error(`Dispatcher selftest fehlgeschlagen (${failed})`);
  }

  console.log("[selftest] Alle Dispatcher-Linktests erfolgreich.");
}

async function runAgentCommand({ command, scope, timeoutMs, onStdout, onStderr, signal, onSpawn }) {
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
    onSpawn?.(child);

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

async function sendHeartbeat(client, payload) {
  try {
    await client.mutation("commandQueue:dispatcherHeartbeat", payload);
  } catch {
    // Heartbeat ist best-effort; Run darf nicht daran scheitern.
  }
}

async function runCommand(client, command, agentName, timeoutMs, preferredScope) {
  const runId = command.runId;
  const runAbort = new AbortController();
  let childProcess = null;
  let processPaused = false;

  await sendHeartbeat(client, {
    dispatcher: agentName,
    state: "running",
    runId,
    scope: preferredScope,
    message: `Run aktiv: ${command.title}`,
  });

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
        return;
      }

      if (runContext?.status === "paused" && childProcess && !processPaused) {
        childProcess.kill("SIGSTOP");
        processPaused = true;
        await sendHeartbeat(client, {
          dispatcher: agentName,
          state: "running",
          runId,
          scope: preferredScope,
          message: "Run pausiert (SIGSTOP)",
        });
        await client.mutation("commandQueue:appendRunEvent", {
          runId,
          kind: "connector",
          severity: "warning",
          message: "Dispatcher hat den OpenClaw-Prozess pausiert (SIGSTOP)",
          currentStep: "Run pausiert",
        });
      }

      if (runContext?.status === "running" && childProcess && processPaused) {
        childProcess.kill("SIGCONT");
        processPaused = false;
        await sendHeartbeat(client, {
          dispatcher: agentName,
          state: "running",
          runId,
          scope: preferredScope,
          message: "Run fortgesetzt (SIGCONT)",
        });
        await client.mutation("commandQueue:appendRunEvent", {
          runId,
          kind: "connector",
          severity: "info",
          message: "Dispatcher hat den OpenClaw-Prozess fortgesetzt (SIGCONT)",
          currentStep: "Run fortgesetzt",
        });
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
      onSpawn: (child) => {
        childProcess = child;
      },
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
    const externalResultLink = extractResultLink(payload?.reply, payload?.text, stdout, stderr);

    await client.mutation("commandQueue:attachRunSession", {
      runId,
      sessionKey,
      assignedAgent: payload?.agentId,
    });

    await client.mutation("commandQueue:setRunState", {
      runId,
      status: "done",
      resultSummary: summary,
      resultLink: externalResultLink || (sessionKey ? `openclaw://session/${sessionKey}` : "openclaw://agent/local"),
      currentStep: "Erfolgreich abgeschlossen",
    });
  } finally {
    clearInterval(stopWatcher);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.has("--help")) {
    console.log(`Owl Live Ops Dispatcher\n\nOptionen:\n  --intervalMs <n>   Polling-Intervall (Default: 4000)\n  --agent <name>     Agent-Label (Default: owl-dispatcher)\n  --scope <all|main|subagent|hybrid>  Scope-Filter (Default: all)\n  --timeoutMs <n>    Timeout pro OpenClaw-Run (Default: 600000)\n  --readOnly         Queue nur beobachten (keine Runs starten)\n  --once             Genau einen Poll-Lauf ausführen\n  --selftest         Interne Parser-Checks ausführen und beenden\n`);
    return;
  }

  if (args.has("--selftest")) {
    runSelfTest();
    return;
  }

  loadDotEnvLocal();

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL fehlt. Bitte .env.local laden oder env setzen.");
  }

  const intervalMs = Number(args.get("--intervalMs") ?? 4000);
  const timeoutMs = Number(args.get("--timeoutMs") ?? 600000);
  const agentName = args.get("--agent") ?? "owl-dispatcher";
  const preferredScope = args.get("--scope") ?? "all";
  const readOnly = args.has("--readOnly") || parseBoolean(process.env.OWL_READ_ONLY_MODE);
  const once = args.has("--once");

  const client = new ConvexHttpClient(convexUrl);

  await sendHeartbeat(client, {
    dispatcher: agentName,
    state: "polling",
    scope: preferredScope,
    message: readOnly ? "Dispatcher gestartet (read-only)" : "Dispatcher gestartet",
  });

  const cycle = async () => {
    if (readOnly) {
      await sendHeartbeat(client, {
        dispatcher: agentName,
        state: "idle",
        scope: preferredScope,
        message: "Read-only aktiv: Queue wird nur beobachtet",
      });
      return false;
    }

    const next = await client.mutation("commandQueue:takeNextQueued", {
      dispatcher: agentName,
      assignedAgent: agentName,
      preferredScope,
    });

    if (!next) {
      await sendHeartbeat(client, {
        dispatcher: agentName,
        state: "idle",
        scope: preferredScope,
        message: "Keine queued Commands",
      });
      return false;
    }

    console.log(`[dispatcher] run gestartet: ${next.runId} (${next.title})`);
    try {
      await runCommand(client, next, agentName, timeoutMs, preferredScope);
      await sendHeartbeat(client, {
        dispatcher: agentName,
        state: "polling",
        scope: preferredScope,
        message: `Run abgeschlossen: ${next.runId}`,
      });
      console.log(`[dispatcher] run abgeschlossen: ${next.runId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const canceled = /gestoppt|stop-control/i.test(message);
      await sendHeartbeat(client, {
        dispatcher: agentName,
        state: canceled ? "polling" : "error",
        runId: next.runId,
        scope: preferredScope,
        message,
      });
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

  console.log(
    `[dispatcher] gestartet (${agentName}), Polling alle ${intervalMs}ms${readOnly ? " [read-only]" : ""}`,
  );
  while (true) {
    try {
      await cycle();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await sendHeartbeat(client, {
        dispatcher: agentName,
        state: "error",
        scope: preferredScope,
        message,
      });
      console.warn(`[dispatcher] Polling-Fehler, nächster Versuch in ${intervalMs}ms: ${message}`);
    }
    await sleep(intervalMs);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
