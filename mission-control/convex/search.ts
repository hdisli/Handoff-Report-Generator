import { query } from "./_generated/server";
import { v } from "convex/values";

function includes(text: string | undefined, term: string) {
  return !!text && text.toLowerCase().includes(term);
}

export const global = query({
  args: { term: v.string() },
  handler: async (ctx, { term }) => {
    const q = term.trim().toLowerCase();
    if (!q) return { activities: [], tasks: [], documents: [] };

    const [activities, tasks, documents] = await Promise.all([
      ctx.db.query("activities").order("desc").take(200),
      ctx.db.query("tasks").order("desc").take(200),
      ctx.db.query("documents").order("desc").take(200),
    ]);

    return {
      activities: activities.filter((a) => includes(`${a.type} ${a.action} ${a.details ?? ""} ${a.metadata ?? ""}`, q)),
      tasks: tasks.filter((t) => includes(`${t.title} ${t.description ?? ""} ${t.status}`, q)),
      documents: documents.filter((d) => includes(`${d.title} ${d.content} ${d.kind}`, q)),
    };
  },
});
