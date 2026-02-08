import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const commandStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("paused"),
  v.literal("done"),
  v.literal("failed"),
  v.literal("canceled"),
);

const runStatus = commandStatus;

const priorityOrder: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function generateRunId() {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const enqueue = mutation({
  args: {
    createdBy: v.string(),
    source: v.string(),
    title: v.string(),
    prompt: v.string(),
    scope: v.union(v.literal("main"), v.literal("subagent"), v.literal("hybrid")),
    priority: v.optional(v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent"))),
  },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    const commandId = await ctx.db.insert("commandQueue", {
      createdAt,
      createdBy: args.createdBy,
      source: args.source,
      title: args.title,
      prompt: args.prompt,
      scope: args.scope,
      priority: args.priority ?? "normal",
      status: "queued",
      retryCount: 0,
    });

    await ctx.db.insert("activities", {
      createdAt,
      actor: "agent",
      source: "owl-live-ops",
      type: "command",
      action: `Command queued: ${args.title}`,
      details: args.prompt.slice(0, 160),
      metadata: JSON.stringify({ commandId }),
      searchable: `command queued ${args.title} ${args.prompt} ${args.scope} ${args.priority ?? "normal"}`,
    });

    return commandId;
  },
});

export const list = query({
  args: {
    status: v.optional(v.union(v.literal("all"), commandStatus)),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { status, limit }) => {
    const max = Math.min(Math.max(limit ?? 50, 1), 200);
    const rows =
      !status || status === "all"
        ? await ctx.db.query("commandQueue").withIndex("by_createdAt").order("desc").take(max)
        : await ctx.db.query("commandQueue").withIndex("by_status_priority_createdAt", (q) => q.eq("status", status)).order("desc").take(max);

    return rows.sort((a, b) => {
      if (a.status === "queued" && b.status === "queued") {
        const priorityDiff = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
        if (priorityDiff !== 0) return priorityDiff;
      }
      return b.createdAt - a.createdAt;
    });
  },
});

export const liveOpsSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const recent = await ctx.db.query("commandQueue").withIndex("by_createdAt").order("desc").take(120);
    const runs = await ctx.db.query("agentRuns").withIndex("by_status_startedAt", (q) => q.eq("status", "running")).collect();

    const counts = {
      queued: 0,
      running: 0,
      paused: 0,
      done: 0,
      failed: 0,
      canceled: 0,
    };

    for (const row of recent) {
      counts[row.status] += 1;
    }

    const latestRun = recent.find((row) => !!row.runId) ?? null;
    const recentFailures = recent.filter((row) => row.status === "failed").slice(0, 3);

    const globalStatus = counts.failed > 0
      ? "blocked"
      : counts.running > 0
        ? "coding"
        : counts.queued > 0
          ? "thinking"
          : "idle";

    return {
      globalStatus,
      counts,
      activeRuns: runs.length,
      latestRun,
      recentFailures,
      lastUpdateTs: Date.now(),
    };
  },
});

export const takeNextQueued = mutation({
  args: {
    dispatcher: v.string(),
    assignedAgent: v.optional(v.string()),
    preferredScope: v.optional(v.union(v.literal("all"), v.literal("main"), v.literal("subagent"), v.literal("hybrid"))),
  },
  handler: async (ctx, { dispatcher, assignedAgent, preferredScope }) => {
    const queued = await ctx.db
      .query("commandQueue")
      .withIndex("by_status_priority_createdAt", (q) => q.eq("status", "queued"))
      .order("asc")
      .collect();

    const pickable = queued
      .filter((c) => !preferredScope || preferredScope === "all" || c.scope === preferredScope)
      .sort((a, b) => {
        const priorityDiff = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt - b.createdAt;
      })[0];

    if (!pickable) return null;

    const runId = generateRunId();
    const now = Date.now();
    await ctx.db.patch(pickable._id, {
      status: "running",
      runId,
      assignedAgent: assignedAgent ?? dispatcher,
      startedAt: now,
    });

    await ctx.db.insert("agentRuns", {
      runId,
      commandId: pickable._id,
      agentType: pickable.scope === "main" ? "main" : "subagent",
      agentLabel: assignedAgent ?? dispatcher,
      startedAt: now,
      status: "running",
      currentStep: "Dispatcher hat Run gestartet",
    });

    await ctx.db.insert("agentRunEvents", {
      runId,
      ts: now,
      kind: "dispatch",
      severity: "info",
      message: `Command von Dispatcher übernommen (${dispatcher})`,
      metadata: JSON.stringify({ commandId: pickable._id }),
    });

    return {
      commandId: pickable._id,
      runId,
      title: pickable.title,
      prompt: pickable.prompt,
      scope: pickable.scope,
      priority: pickable.priority,
    };
  },
});

export const appendRunEvent = mutation({
  args: {
    runId: v.string(),
    kind: v.string(),
    severity: v.optional(v.union(v.literal("info"), v.literal("warning"), v.literal("error"))),
    message: v.string(),
    metadata: v.optional(v.string()),
    currentStep: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ts = Date.now();
    await ctx.db.insert("agentRunEvents", {
      runId: args.runId,
      ts,
      kind: args.kind,
      severity: args.severity ?? "info",
      message: args.message,
      metadata: args.metadata,
    });

    const run = await ctx.db.query("agentRuns").withIndex("by_runId", (q) => q.eq("runId", args.runId)).first();
    if (run && args.currentStep) {
      await ctx.db.patch(run._id, {
        currentStep: args.currentStep,
      });
    }
  },
});

export const setRunState = mutation({
  args: {
    runId: v.string(),
    status: runStatus,
    resultSummary: v.optional(v.string()),
    resultLink: v.optional(v.string()),
    error: v.optional(v.string()),
    currentStep: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.query("agentRuns").withIndex("by_runId", (q) => q.eq("runId", args.runId)).first();
    if (!run) throw new Error(`runId nicht gefunden: ${args.runId}`);

    const command = await ctx.db.get(run.commandId);
    if (!command) throw new Error(`Command nicht gefunden für runId: ${args.runId}`);

    const now = Date.now();
    const terminal = args.status === "done" || args.status === "failed" || args.status === "canceled";

    await ctx.db.patch(run._id, {
      status: args.status,
      endedAt: terminal ? now : undefined,
      currentStep: args.currentStep ?? run.currentStep,
    });

    await ctx.db.patch(command._id, {
      status: args.status,
      finishedAt: terminal ? now : undefined,
      resultSummary: args.resultSummary,
      resultLink: args.resultLink,
      error: args.error,
    });

    await ctx.db.insert("agentRunEvents", {
      runId: args.runId,
      ts: now,
      kind: "status",
      severity: args.status === "failed" ? "error" : "info",
      message: `Run-Status: ${args.status}`,
      metadata: JSON.stringify({ resultLink: args.resultLink, error: args.error }),
    });
  },
});

export const listControlActions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit }) => {
    const max = Math.min(Math.max(limit ?? 200, 1), 1000);
    return await ctx.db.query("controlActions").withIndex("by_ts").order("desc").take(max);
  },
});

export const listRunEvents = query({
  args: {
    runId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { runId, limit }) => {
    const max = Math.min(Math.max(limit ?? 100, 1), 500);
    return await ctx.db.query("agentRunEvents").withIndex("by_runId_ts", (q) => q.eq("runId", runId)).order("desc").take(max);
  },
});

export const getRunContext = query({
  args: {
    runId: v.string(),
  },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.query("agentRuns").withIndex("by_runId", (q) => q.eq("runId", runId)).first();
    if (!run) return null;
    const command = await ctx.db.get(run.commandId);
    if (!command) return null;
    return {
      runId,
      commandId: command._id,
      status: command.status,
      scope: command.scope,
      prompt: command.prompt,
      title: command.title,
      sessionKey: command.sessionKey,
      assignedAgent: command.assignedAgent,
    };
  },
});

export const attachRunSession = mutation({
  args: {
    runId: v.string(),
    sessionKey: v.optional(v.string()),
    assignedAgent: v.optional(v.string()),
  },
  handler: async (ctx, { runId, sessionKey, assignedAgent }) => {
    const run = await ctx.db.query("agentRuns").withIndex("by_runId", (q) => q.eq("runId", runId)).first();
    if (!run) throw new Error(`runId nicht gefunden: ${runId}`);
    const command = await ctx.db.get(run.commandId);
    if (!command) throw new Error(`Command nicht gefunden für runId: ${runId}`);

    await ctx.db.patch(command._id, {
      sessionKey,
      assignedAgent: assignedAgent ?? command.assignedAgent,
    });
  },
});

export const dispatcherHeartbeat = mutation({
  args: {
    dispatcher: v.string(),
    state: v.union(v.literal("idle"), v.literal("polling"), v.literal("running"), v.literal("error")),
    runId: v.optional(v.string()),
    scope: v.optional(v.union(v.literal("all"), v.literal("main"), v.literal("subagent"), v.literal("hybrid"))),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db.query("dispatcherHeartbeats").withIndex("by_dispatcher", (q) => q.eq("dispatcher", args.dispatcher)).first();

    const payload = {
      dispatcher: args.dispatcher,
      ts: now,
      state: args.state,
      runId: args.runId,
      scope: args.scope,
      message: args.message,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("dispatcherHeartbeats", payload);
  },
});

export const dispatcherStatus = query({
  args: {
    dispatcher: v.optional(v.string()),
    staleAfterMs: v.optional(v.number()),
  },
  handler: async (ctx, { dispatcher, staleAfterMs }) => {
    const maxAge = Math.max(1000, staleAfterMs ?? 15000);
    const now = Date.now();

    const rows = dispatcher
      ? await ctx.db.query("dispatcherHeartbeats").withIndex("by_dispatcher", (q) => q.eq("dispatcher", dispatcher)).collect()
      : await ctx.db.query("dispatcherHeartbeats").withIndex("by_ts").order("desc").take(10);

    return rows
      .sort((a, b) => b.ts - a.ts)
      .map((row) => ({
        ...row,
        isOnline: now - row.ts <= maxAge,
        ageMs: now - row.ts,
      }));
  },
});

export const controlRun = mutation({
  args: {
    runId: v.string(),
    action: v.union(v.literal("pause"), v.literal("resume"), v.literal("stop"), v.literal("retry"), v.literal("prioritize")),
    triggeredBy: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.query("agentRuns").withIndex("by_runId", (q) => q.eq("runId", args.runId)).first();
    if (!run) throw new Error(`runId nicht gefunden: ${args.runId}`);

    const command = await ctx.db.get(run.commandId);
    if (!command) throw new Error(`Command nicht gefunden für runId: ${args.runId}`);

    const now = Date.now();
    await ctx.db.insert("controlActions", {
      runId: args.runId,
      commandId: command._id,
      action: args.action,
      triggeredBy: args.triggeredBy,
      ts: now,
      reason: args.reason,
    });

    if (args.action === "pause") {
      await ctx.db.patch(run._id, { status: "paused", currentStep: "Pausiert" });
      await ctx.db.patch(command._id, { status: "paused" });
    } else if (args.action === "resume") {
      await ctx.db.patch(run._id, { status: "running", currentStep: "Fortgesetzt" });
      await ctx.db.patch(command._id, { status: "running" });
    } else if (args.action === "stop") {
      await ctx.db.patch(run._id, { status: "canceled", endedAt: now, currentStep: "Gestoppt" });
      await ctx.db.patch(command._id, { status: "canceled", finishedAt: now, error: args.reason ?? "Manuell gestoppt" });
    } else if (args.action === "retry") {
      await ctx.db.patch(command._id, {
        status: "queued",
        runId: undefined,
        sessionKey: undefined,
        startedAt: undefined,
        finishedAt: undefined,
        resultSummary: undefined,
        resultLink: undefined,
        error: undefined,
        retryCount: command.retryCount + 1,
      });
    } else if (args.action === "prioritize") {
      await ctx.db.patch(command._id, {
        priority: command.priority === "urgent" ? "urgent" : "high",
      });
    }

    await ctx.db.insert("agentRunEvents", {
      runId: args.runId,
      ts: now,
      kind: "control",
      severity: "info",
      message: `Control-Aktion: ${args.action}`,
      metadata: JSON.stringify({ triggeredBy: args.triggeredBy, reason: args.reason }),
    });

    return { ok: true };
  },
});

export const prioritizeQueuedCommand = mutation({
  args: {
    commandId: v.id("commandQueue"),
    triggeredBy: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { commandId, triggeredBy, reason }) => {
    const command = await ctx.db.get(commandId);
    if (!command) throw new Error(`Command nicht gefunden: ${commandId}`);
    if (command.status !== "queued") {
      throw new Error("Priorisieren nur für queued Commands erlaubt");
    }

    const now = Date.now();
    const newPriority = command.priority === "urgent" ? "urgent" : "high";

    await ctx.db.patch(commandId, {
      priority: newPriority,
    });

    await ctx.db.insert("controlActions", {
      runId: command.runId,
      commandId,
      action: "prioritize",
      triggeredBy,
      ts: now,
      reason,
    });

    await ctx.db.insert("activities", {
      createdAt: now,
      actor: "agent",
      source: "owl-live-ops",
      type: "command",
      action: `Command priorisiert: ${command.title}`,
      details: `Priorität: ${command.priority} -> ${newPriority}`,
      metadata: JSON.stringify({ commandId }),
      searchable: `command prioritize ${command.title} ${command.scope} ${newPriority}`,
    });

    return { ok: true, priority: newPriority };
  },
});
