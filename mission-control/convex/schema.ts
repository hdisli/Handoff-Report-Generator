import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  activities: defineTable({
    createdAt: v.number(),
    type: v.string(),
    action: v.string(),
    details: v.optional(v.string()),
    metadata: v.optional(v.string()),
  }).index("by_createdAt", ["createdAt"]),

  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("planned"), v.literal("in_progress"), v.literal("done")),
    scheduledAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_scheduledAt", ["scheduledAt"])
    .index("by_status", ["status"]),

  documents: defineTable({
    title: v.string(),
    content: v.string(),
    kind: v.union(v.literal("note"), v.literal("task"), v.literal("log")),
    updatedAt: v.number(),
  }).index("by_updatedAt", ["updatedAt"]),
});
