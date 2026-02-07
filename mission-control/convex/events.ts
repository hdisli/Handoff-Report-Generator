import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const ingestAgentEvent = mutation({
  args: {
    source: v.string(),
    action: v.string(),
    details: v.optional(v.string()),
    metadata: v.optional(v.string()),
    actor: v.optional(v.string()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = args.actor ?? "agent";
    const type = args.type ?? "automation";
    const id = await ctx.db.insert("activities", {
      createdAt: Date.now(),
      actor,
      source: args.source,
      type,
      action: args.action,
      details: args.details,
      metadata: args.metadata,
      searchable: `${args.source} ${type} ${args.action} ${args.details ?? ""} ${args.metadata ?? ""} ${actor}`,
    });
    return id;
  },
});

export const ingestBatch = mutation({
  args: {
    events: v.array(
      v.object({
        source: v.string(),
        action: v.string(),
        details: v.optional(v.string()),
        metadata: v.optional(v.string()),
        actor: v.optional(v.string()),
        type: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { events }) => {
    const ids = [];
    for (const e of events) {
      const id = await ctx.db.insert("activities", {
        createdAt: Date.now(),
        actor: e.actor ?? "agent",
        source: e.source,
        type: e.type ?? "automation",
        action: e.action,
        details: e.details,
        metadata: e.metadata,
        searchable: `${e.source} ${e.type ?? "automation"} ${e.action} ${e.details ?? ""} ${e.metadata ?? ""} ${e.actor ?? "agent"}`,
      });
      ids.push(id);
    }
    return ids;
  },
});
