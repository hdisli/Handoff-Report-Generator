import { query } from "./_generated/server";
import { v } from "convex/values";

type RankResult<T> = T & { _score: number };

function rankText(text: string, term: string) {
  const q = term.toLowerCase();
  const hay = text.toLowerCase();
  if (!hay.includes(q)) return 0;

  let score = 1;
  if (hay.startsWith(q)) score += 4;
  if (hay.includes(` ${q} `)) score += 2;

  const occurrences = hay.split(q).length - 1;
  score += Math.min(occurrences, 4);
  return score;
}

export const global = query({
  args: { term: v.string() },
  handler: async (ctx, { term }) => {
    const q = term.trim().toLowerCase();
    if (!q) return { activities: [], tasks: [], documents: [] };

    const [activities, tasks, documents] = await Promise.all([
      ctx.db.query("activities").order("desc").take(300),
      ctx.db.query("tasks").order("desc").take(300),
      ctx.db.query("documents").order("desc").take(300),
    ]);

    const rankedActivities: RankResult<(typeof activities)[number]>[] = activities
      .map((a) => ({
        ...a,
        _score: rankText(`${a.type} ${a.action} ${a.details ?? ""} ${a.metadata ?? ""}`, q),
      }))
      .filter((a) => a._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 20);

    const rankedTasks: RankResult<(typeof tasks)[number]>[] = tasks
      .map((t) => ({
        ...t,
        _score: rankText(`${t.title} ${t.description ?? ""} ${t.status}`, q),
      }))
      .filter((t) => t._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 20);

    const rankedDocuments: RankResult<(typeof documents)[number]>[] = documents
      .map((d) => ({
        ...d,
        _score: rankText(`${d.title} ${d.content} ${d.kind}`, q),
      }))
      .filter((d) => d._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 20);

    return {
      activities: rankedActivities,
      tasks: rankedTasks,
      documents: rankedDocuments,
    };
  },
});
