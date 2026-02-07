import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const log = mutation({
  args: {
    type: v.string(),
    action: v.string(),
    details: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activities", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const items = await ctx.db
      .query("activities")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit ?? 50);

    return items;
  },
});
