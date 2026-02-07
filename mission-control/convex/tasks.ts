import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    scheduledAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", {
      ...args,
      status: "planned",
      createdAt: Date.now(),
    });
  },
});

export const setStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.union(v.literal("planned"), v.literal("in_progress"), v.literal("done")),
  },
  handler: async (ctx, { taskId, status }) => {
    await ctx.db.patch(taskId, { status });
  },
});

export const week = query({
  args: {
    weekStart: v.number(),
    weekEnd: v.number(),
  },
  handler: async (ctx, { weekStart, weekEnd }) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_scheduledAt", (q) => q.gte("scheduledAt", weekStart).lte("scheduledAt", weekEnd))
      .order("asc")
      .collect();
  },
});
