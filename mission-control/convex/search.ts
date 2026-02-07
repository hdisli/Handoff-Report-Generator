import { query } from "./_generated/server";
import { v } from "convex/values";

export const global = query({
  args: { term: v.string() },
  handler: async (ctx, { term }) => {
    const q = term.trim();
    if (!q) return { activities: [], tasks: [], documents: [] };

    const [activities, tasks, documents] = await Promise.all([
      ctx.db
        .query("activities")
        .withSearchIndex("search_text", (s) => s.search("searchable", q))
        .take(20),
      ctx.db
        .query("tasks")
        .withSearchIndex("search_text", (s) => s.search("searchable", q))
        .take(20),
      ctx.db
        .query("documents")
        .withSearchIndex("search_text", (s) => s.search("searchable", q))
        .take(20),
    ]);

    return { activities, tasks, documents };
  },
});
