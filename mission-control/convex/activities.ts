import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const log = mutation({
  args: {
    actor: v.optional(v.string()),
    source: v.optional(v.string()),
    type: v.string(),
    action: v.string(),
    details: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activities", {
      actor: args.actor ?? "agent",
      source: args.source ?? "dashboard",
      type: args.type,
      action: args.action,
      details: args.details,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
    actor: v.optional(v.string()),
  },
  handler: async (ctx, { limit, actor }) => {
    const items = await ctx.db
      .query("activities")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit ?? 80);

    if (!actor || actor === "all") return items;
    return items.filter((item) => item.actor === actor);
  },
});
