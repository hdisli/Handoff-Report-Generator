import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  activities: defineTable({
    createdAt: v.number(),
    actor: v.string(),
    source: v.string(),
    type: v.string(),
    action: v.string(),
    details: v.optional(v.string()),
    metadata: v.optional(v.string()),
    searchable: v.string(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_actor", ["actor"])
    .searchIndex("search_text", {
      searchField: "searchable",
      filterFields: ["actor", "type", "source"],
    }),

  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    assignee: v.optional(v.union(v.literal("ezo"), v.literal("hasan"), v.literal("both"))),
    status: v.union(v.literal("planned"), v.literal("in_progress"), v.literal("done")),
    scheduledAt: v.number(),
    createdAt: v.number(),
    searchable: v.string(),
  })
    .index("by_scheduledAt", ["scheduledAt"])
    .index("by_status", ["status"])
    .searchIndex("search_text", {
      searchField: "searchable",
      filterFields: ["status"],
    }),

  documents: defineTable({
    title: v.string(),
    content: v.string(),
    kind: v.union(v.literal("note"), v.literal("task"), v.literal("log")),
    updatedAt: v.number(),
    searchable: v.string(),
  })
    .index("by_updatedAt", ["updatedAt"])
    .searchIndex("search_text", {
      searchField: "searchable",
      filterFields: ["kind"],
    }),

  approvalRequests: defineTable({
    createdAt: v.number(),
    title: v.string(),
    platform: v.union(v.literal("instagram"), v.literal("tiktok"), v.literal("x")),
    payload: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.string()),
    note: v.optional(v.string()),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status", ["status"]),

  postQueue: defineTable({
    createdAt: v.number(),
    title: v.string(),
    platform: v.union(v.literal("instagram"), v.literal("tiktok"), v.literal("x")),
    approvalId: v.id("approvalRequests"),
    payload: v.string(),
    status: v.union(v.literal("ready"), v.literal("publishing"), v.literal("published"), v.literal("failed")),
    scheduledAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status", ["status"]),

  commandQueue: defineTable({
    createdAt: v.number(),
    createdBy: v.string(),
    source: v.string(),
    title: v.string(),
    prompt: v.string(),
    scope: v.union(v.literal("main"), v.literal("subagent"), v.literal("hybrid")),
    priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent")),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("paused"), v.literal("done"), v.literal("failed"), v.literal("canceled")),
    assignedAgent: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    runId: v.optional(v.string()),
    resultSummary: v.optional(v.string()),
    resultLink: v.optional(v.string()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    retryCount: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status_priority_createdAt", ["status", "priority", "createdAt"])
    .index("by_runId", ["runId"]),

  agentRuns: defineTable({
    runId: v.string(),
    commandId: v.id("commandQueue"),
    agentType: v.union(v.literal("main"), v.literal("subagent")),
    agentLabel: v.string(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("paused"), v.literal("done"), v.literal("failed"), v.literal("canceled")),
    currentStep: v.optional(v.string()),
  })
    .index("by_commandId", ["commandId"])
    .index("by_runId", ["runId"])
    .index("by_status_startedAt", ["status", "startedAt"]),

  agentRunEvents: defineTable({
    runId: v.string(),
    ts: v.number(),
    kind: v.string(),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
    message: v.string(),
    metadata: v.optional(v.string()),
  })
    .index("by_runId_ts", ["runId", "ts"])
    .index("by_ts", ["ts"]),

  controlActions: defineTable({
    runId: v.optional(v.string()),
    commandId: v.optional(v.id("commandQueue")),
    action: v.union(v.literal("pause"), v.literal("resume"), v.literal("stop"), v.literal("retry"), v.literal("prioritize")),
    triggeredBy: v.string(),
    ts: v.number(),
    reason: v.optional(v.string()),
  })
    .index("by_runId_ts", ["runId", "ts"])
    .index("by_commandId_ts", ["commandId", "ts"])
    .index("by_ts", ["ts"]),

  members: defineTable({
    name: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_role", ["role"]),

  dispatcherHeartbeats: defineTable({
    dispatcher: v.string(),
    ts: v.number(),
    state: v.union(v.literal("idle"), v.literal("polling"), v.literal("running"), v.literal("error")),
    runId: v.optional(v.string()),
    scope: v.optional(v.union(v.literal("all"), v.literal("main"), v.literal("subagent"), v.literal("hybrid"))),
    message: v.optional(v.string()),
  })
    .index("by_dispatcher", ["dispatcher"])
    .index("by_ts", ["ts"]),
});
