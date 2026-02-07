import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  activities: defineTable({
    createdAt: v.number(),
    actor: v.string(),
    source: v.string(),
    type: v.string(),
    action: v.string(),
    details: v.optional(v.string()),
    metadata: v.optional(v.string()),
    searchable: v.string(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_actor", ["actor"])
    .searchIndex("search_text", {
      searchField: "searchable",
      filterFields: ["actor", "type", "source"],
    }),

  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("planned"), v.literal("in_progress"), v.literal("done")),
    scheduledAt: v.number(),
    createdAt: v.number(),
    searchable: v.string(),
  })
    .index("by_scheduledAt", ["scheduledAt"])
    .index("by_status", ["status"])
    .searchIndex("search_text", {
      searchField: "searchable",
      filterFields: ["status"],
    }),

  documents: defineTable({
    title: v.string(),
    content: v.string(),
    kind: v.union(v.literal("note"), v.literal("task"), v.literal("log")),
    updatedAt: v.number(),
    searchable: v.string(),
  })
    .index("by_updatedAt", ["updatedAt"])
    .searchIndex("search_text", {
      searchField: "searchable",
      filterFields: ["kind"],
    }),

  approvalRequests: defineTable({
    createdAt: v.number(),
    title: v.string(),
    platform: v.union(v.literal("instagram"), v.literal("tiktok"), v.literal("x")),
    payload: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.string()),
    note: v.optional(v.string()),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status", ["status"]),

  postQueue: defineTable({
    createdAt: v.number(),
    title: v.string(),
    platform: v.union(v.literal("instagram"), v.literal("tiktok"), v.literal("x")),
    approvalId: v.id("approvalRequests"),
    payload: v.string(),
    status: v.union(v.literal("ready"), v.literal("publishing"), v.literal("published"), v.literal("failed")),
    scheduledAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status", ["status"]),

  members: defineTable({
    name: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_role", ["role"]),
});
