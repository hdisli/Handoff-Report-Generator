import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    assignee: v.optional(v.union(v.literal("ezo"), v.literal("hasan"), v.literal("both"))),
    scheduledAt: v.number(),
  },
  handler: async (ctx, args) => {
    const assignee = args.assignee ?? "both";
    const taskId = await ctx.db.insert("tasks", {
      ...args,
      assignee,
      status: "planned",
      createdAt: Date.now(),
      searchable: `${args.title} ${args.description ?? ""} ${assignee} planned`,
    });

    await ctx.db.insert("activities", {
      createdAt: Date.now(),
      actor: "agent",
      source: "automation",
      type: "task",
      action: `Task erstellt: ${args.title} (${assignee})`,
      details: args.description,
      metadata: JSON.stringify({ taskId, scheduledAt: args.scheduledAt, assignee }),
      searchable: `task erstellt ${args.title} ${args.description ?? ""} ${assignee} automation agent`,
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
    await ctx.db.patch(taskId, {
      status,
      searchable: `${task?.title ?? ""} ${task?.description ?? ""} ${task?.assignee ?? "both"} ${status}`,
    });

    await ctx.db.insert("activities", {
      createdAt: Date.now(),
      actor: "agent",
      source: "automation",
      type: "task",
      action: `Task-Status: ${status}`,
      details: task?.title,
      metadata: JSON.stringify({ taskId }),
      searchable: `task status ${status} ${task?.title ?? ""} automation agent`,
    });
  },
});

export const remove = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    await ctx.db.delete(taskId);

    await ctx.db.insert("activities", {
      createdAt: Date.now(),
      actor: "agent",
      source: "dashboard",
      type: "task",
      action: `Task gelöscht`,
      details: task?.title,
      metadata: JSON.stringify({ taskId }),
      searchable: `task gelöscht ${task?.title ?? ""} dashboard agent`,
    });
  },
});

export const week = query({
  args: {
    weekStart: v.number(),
    weekEnd: v.number(),
    status: v.optional(v.union(v.literal("all"), v.literal("planned"), v.literal("in_progress"), v.literal("done"))),
    assignee: v.optional(v.union(v.literal("all"), v.literal("ezo"), v.literal("hasan"), v.literal("both"))),
  },
  handler: async (ctx, { weekStart, weekEnd, status, assignee }) => {
    const rows = await ctx.db
      .query("tasks")
      .withIndex("by_scheduledAt", (q) => q.gte("scheduledAt", weekStart).lte("scheduledAt", weekEnd))
      .order("asc")
      .collect();

    const byStatus = !status || status === "all" ? rows : rows.filter((r) => r.status === status);
    if (!assignee || assignee === "all") return byStatus;
    return byStatus.filter((r) => (r.assignee ?? "both") === assignee);
  },
});
