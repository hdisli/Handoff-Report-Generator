import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("members").collect();
    if (existing.length > 0) return existing;

    await ctx.db.insert("members", {
      name: "Hasan",
      role: "owner",
      isActive: true,
      createdAt: Date.now(),
    });

    return await ctx.db.query("members").collect();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("members").collect();
  },
});

export const setRole = mutation({
  args: {
    id: v.id("members"),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
  },
  handler: async (ctx, { id, role }) => {
    await ctx.db.patch(id, { role });
  },
});
