import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    scheduledAt: v.number(),
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("tasks", {
      ...args,
      status: "planned",
      createdAt: Date.now(),
    });

    await ctx.db.insert("activities", {
      createdAt: Date.now(),
      actor: "agent",
      source: "automation",
      type: "task",
      action: `Task erstellt: ${args.title}`,
      details: args.description,
      metadata: JSON.stringify({ taskId, scheduledAt: args.scheduledAt }),
    });

    return taskId;
  },
});

export const setStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.union(v.literal("planned"), v.literal("in_progress"), v.literal("done")),
  },
  handler: async (ctx, { taskId, status }) => {
    const task = await ctx.db.get(taskId);
    await ctx.db.patch(taskId, { status });

    await ctx.db.insert("activities", {
      createdAt: Date.now(),
      actor: "agent",
      source: "automation",
      type: "task",
      action: `Task-Status: ${status}`,
      details: task?.title,
      metadata: JSON.stringify({ taskId }),
    });
  },
});

export const week = query({
  args: {
    weekStart: v.number(),
    weekEnd: v.number(),
    status: v.optional(v.union(v.literal("all"), v.literal("planned"), v.literal("in_progress"), v.literal("done"))),
  },
  handler: async (ctx, { weekStart, weekEnd, status }) => {
    const rows = await ctx.db
      .query("tasks")
      .withIndex("by_scheduledAt", (q) => q.gte("scheduledAt", weekStart).lte("scheduledAt", weekEnd))
      .order("asc")
      .collect();

    if (!status || status === "all") return rows;
    return rows.filter((r) => r.status === status);
  },
});
