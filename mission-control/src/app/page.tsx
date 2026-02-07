"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

type Activity = { _id: string; action: string; details?: string; createdAt: number };
type Task = { _id: string; title: string; scheduledAt: number };
type SearchResult = {
  activities: Activity[];
  tasks: Task[];
  documents: { _id: string; title: string }[];
};

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday.getTime(), end: sunday.getTime() };
}

export default function Home() {
  const [term, setTerm] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAt, setTaskAt] = useState("");
  const [activityAction, setActivityAction] = useState("");

  const range = useMemo(() => weekRange(), []);

  const activities = (useQuery(api.activities.listRecent, { limit: 30 }) ?? []) as Activity[];
  const rawTasks = useQuery(api.tasks.week, { weekStart: range.start, weekEnd: range.end });
  const tasks = useMemo(() => (rawTasks ?? []) as Task[], [rawTasks]);
  const results = (useQuery(api.search.global, { term }) ?? {
    activities: [],
    tasks: [],
    documents: [],
  }) as SearchResult;

  const logActivity = useMutation(api.activities.log);
  const createTask = useMutation(api.tasks.create);

  const missingEnv = !process.env.NEXT_PUBLIC_CONVEX_URL;

  async function onAddActivity(e: FormEvent) {
    e.preventDefault();
    if (!activityAction.trim()) return;
    await logActivity({
      type: "manual",
      action: activityAction,
      details: "Vom Dashboard eingetragen",
    });
    setActivityAction("");
  }

  async function onAddTask(e: FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim() || !taskAt) return;
    await createTask({
      title: taskTitle,
      scheduledAt: new Date(taskAt).getTime(),
      description: "Geplante Aufgabe aus Mission Control",
    });
    setTaskTitle("");
    setTaskAt("");
  }

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      const key = new Date(task.scheduledAt).toLocaleDateString("de-DE", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      });
      const prev = map.get(key) ?? [];
      map.set(key, [...prev, task]);
    });
    return Array.from(map.entries());
  }, [tasks]);

  return (
    <div className="min-h-screen bg-zinc-100 p-6 text-zinc-900">
      <main className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
        <section className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-1">
          <h2 className="text-lg font-semibold">Aktivitätsfeed</h2>
          <p className="mb-4 text-sm text-zinc-600">Protokolliert alle Aktionen und Aufgaben.</p>

          <form onSubmit={onAddActivity} className="mb-4 flex gap-2">
            <input
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Neue Aktivität..."
              value={activityAction}
              onChange={(e) => setActivityAction(e.target.value)}
            />
            <button className="rounded-lg bg-black px-3 py-2 text-sm text-white">Log</button>
          </form>

          <div className="space-y-3">
            {activities.map((item) => (
              <article key={item._id} className="rounded-lg border border-zinc-200 p-3">
                <p className="text-sm font-medium">{item.action}</p>
                <p className="text-xs text-zinc-500">{item.details}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {new Date(item.createdAt).toLocaleString("de-DE")}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-1">
          <h2 className="text-lg font-semibold">Wochenkalender</h2>
          <p className="mb-4 text-sm text-zinc-600">Alle geplanten Aufgaben in Wochenansicht.</p>

          <form onSubmit={onAddTask} className="mb-4 grid gap-2">
            <input
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Aufgabentitel"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <input
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              type="datetime-local"
              value={taskAt}
              onChange={(e) => setTaskAt(e.target.value)}
            />
            <button className="rounded-lg bg-black px-3 py-2 text-sm text-white">Aufgabe planen</button>
          </form>

          <div className="space-y-3">
            {tasksByDay.length === 0 && <p className="text-sm text-zinc-500">Keine Aufgaben diese Woche.</p>}
            {tasksByDay.map(([day, dayTasks]) => (
              <div key={day} className="rounded-lg border border-zinc-200 p-3">
                <p className="text-sm font-semibold">{day}</p>
                <ul className="mt-2 space-y-1">
                  {dayTasks.map((task) => (
                    <li key={task._id} className="text-sm text-zinc-700">
                      {new Date(task.scheduledAt).toLocaleTimeString("de-DE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      {task.title}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-1">
          <h2 className="text-lg font-semibold">Globale Suche</h2>
          <p className="mb-4 text-sm text-zinc-600">Durchsucht Logs, Dokumente und Aufgaben.</p>

          <input
            className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Begriff eingeben..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />

          {term.trim().length > 0 && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-zinc-200 p-3">
                <p className="font-semibold">Aktivitäten ({results.activities.length})</p>
                <ul className="mt-1 list-disc pl-4 text-zinc-700">
                  {results.activities.slice(0, 5).map((a) => (
                    <li key={a._id}>{a.action}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-zinc-200 p-3">
                <p className="font-semibold">Aufgaben ({results.tasks.length})</p>
                <ul className="mt-1 list-disc pl-4 text-zinc-700">
                  {results.tasks.slice(0, 5).map((t) => (
                    <li key={t._id}>{t.title}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-zinc-200 p-3">
                <p className="font-semibold">Dokumente ({results.documents.length})</p>
                <ul className="mt-1 list-disc pl-4 text-zinc-700">
                  {results.documents.slice(0, 5).map((d) => (
                    <li key={d._id}>{d.title}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </main>

      {missingEnv && (
        <p className="mx-auto mt-6 max-w-7xl rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Hinweis: Setze <code>NEXT_PUBLIC_CONVEX_URL</code> in <code>.env.local</code> und starte
          <code> npx convex dev</code>, damit Live-Daten geladen werden.
        </p>
      )}
    </div>
  );
}
