import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    title: v.string(),
    platform: v.union(v.literal("instagram"), v.literal("tiktok"), v.literal("x")),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("approvalRequests", {
      createdAt: Date.now(),
      title: args.title,
      platform: args.platform,
      payload: args.payload,
      status: "pending",
    });

    await ctx.db.insert("activities", {
      createdAt: Date.now(),
      actor: "agent",
      source: "approval",
      type: "approval",
      action: `Freigabe erstellt: ${args.title}`,
      details: args.platform,
      metadata: JSON.stringify({ approvalId: id }),
    });

    return id;
  },
});

export const decide = mutation({
  args: {
    id: v.id("approvalRequests"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
    decidedBy: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      decidedAt: Date.now(),
      decidedBy: args.decidedBy,
      note: args.note,
    });

    const approval = await ctx.db.get(args.id);
    await ctx.db.insert("activities", {
      createdAt: Date.now(),
      actor: args.decidedBy,
      source: "approval",
      type: "approval",
      action: `Freigabe ${args.status}`,
      details: approval?.title,
      metadata: JSON.stringify({ approvalId: args.id }),
    });
  },
});

export const list = query({
  args: {
    status: v.optional(v.union(v.literal("all"), v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { status, limit }) => {
    const rows = await ctx.db
      .query("approvalRequests")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit ?? 40);

    if (!status || status === "all") return rows;
    return rows.filter((r) => r.status === status);
  },
});
