import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    id: v.optional(v.id("documents")),
    title: v.string(),
    content: v.string(),
    kind: v.union(v.literal("note"), v.literal("task"), v.literal("log")),
  },
  handler: async (ctx, args) => {
    if (args.id) {
      await ctx.db.patch(args.id, {
        title: args.title,
        content: args.content,
        kind: args.kind,
        updatedAt: Date.now(),
      });
      return args.id;
    }

    return await ctx.db.insert("documents", {
      title: args.title,
      content: args.content,
      kind: args.kind,
      updatedAt: Date.now(),
    });
  },
});

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(limit ?? 25);
  },
});
