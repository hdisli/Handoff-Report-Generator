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
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, errorMessage }) => {
    await ctx.db.patch(id, {
      status,
      publishedAt: status === "published" ? Date.now() : undefined,
      errorMessage: status === "failed" ? (errorMessage ?? "Unbekannter Fehler") : undefined,
    });

    const row = await ctx.db.get(id);
    await ctx.db.insert("activities", {
      createdAt: Date.now(),
      actor: "agent",
      source: "publisher",
      type: "postQueue",
      action: `PostQueue Status: ${status}`,
      details: status === "failed" ? `${row?.title ?? ""} · ${errorMessage ?? "Unbekannter Fehler"}` : row?.title,
      metadata: JSON.stringify({ postQueueId: id, approvalId: row?.approvalId }),
      searchable: `postqueue status ${status} ${row?.title ?? ""} ${errorMessage ?? ""}`,
    });
  },
});

export const moveBackToApproval = mutation({
  args: {
    id: v.id("postQueue"),
  },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row) return;

    await ctx.db.patch(row.approvalId, {
      status: "pending",
      decidedAt: undefined,
      decidedBy: undefined,
      note: "Aus Warteschlange zurückgesetzt",
    });

    await ctx.db.delete(id);

    await ctx.db.insert("activities", {
      createdAt: Date.now(),
      actor: "agent",
      source: "approval",
      type: "approval",
      action: "Freigabe zurück in Prüfung",
      details: row.title,
      metadata: JSON.stringify({ approvalId: row.approvalId, postQueueId: id }),
      searchable: `freigabe zurückgesetzt ${row.title}`,
    });
  },
});
