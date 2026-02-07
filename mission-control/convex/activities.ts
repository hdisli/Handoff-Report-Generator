import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function searchableText(args: { type: string; action: string; details?: string; metadata?: string; actor: string; source: string }) {
  return `${args.type} ${args.action} ${args.details ?? ""} ${args.metadata ?? ""} ${args.actor} ${args.source}`.trim();
}

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
    const actor = args.actor ?? "agent";
    const source = args.source ?? "dashboard";
    return await ctx.db.insert("activities", {
      actor,
      source,
      type: args.type,
      action: args.action,
      details: args.details,
      metadata: args.metadata,
      searchable: searchableText({ ...args, actor, source }),
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("activities"),
  },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
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
