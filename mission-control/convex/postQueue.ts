import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    status: v.optional(v.union(v.literal("all"), v.literal("ready"), v.literal("publishing"), v.literal("published"), v.literal("failed"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { status, limit }) => {
    const rows = await ctx.db.query("postQueue").withIndex("by_createdAt").order("desc").take(limit ?? 50);
    if (!status || status === "all") return rows;
    return rows.filter((r) => r.status === status);
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("postQueue"),
    status: v.union(v.literal("ready"), v.literal("publishing"), v.literal("published"), v.literal("failed")),
  },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, {
      status,
      publishedAt: status === "published" ? Date.now() : undefined,
    });

    const row = await ctx.db.get(id);
    await ctx.db.insert("activities", {
      createdAt: Date.now(),
      actor: "agent",
      source: "publisher",
      type: "postQueue",
      action: `PostQueue Status: ${status}`,
      details: row?.title,
      metadata: JSON.stringify({ postQueueId: id }),
      searchable: `postqueue status ${status} ${row?.title ?? ""}`,
    });
  },
});
