"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

type Activity = {
  _id: string;
  createdAt: number;
  actor: string;
  action: string;
  details?: string;
  type: string;
};

type TaskStatus = "planned" | "in_progress" | "done";
type Task = {
  _id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  scheduledAt: number;
};

type Doc = { _id: string; title: string; _score: number };
type Approval = {
  _id: string;
  title: string;
  platform: "instagram" | "tiktok" | "x";
  payload: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
};

type SearchResult = {
  activities: (Activity & { _score: number })[];
  tasks: (Task & { _score: number })[];
  documents: Doc[];
};

function getWeekWindow(offsetWeeks: number) {
  const now = new Date();
  const day = now.getDay();
  const diff = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday.getTime(), end: sunday.getTime(), monday };
}

export default function Home() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [taskStatusFilter, setTaskStatusFilter] = useState<"all" | TaskStatus>("all");
  const [activityActorFilter, setActivityActorFilter] = useState("all");
  const [queryTerm, setQueryTerm] = useState("");

  const [activityAction, setActivityAction] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAt, setTaskAt] = useState("");

  const [approvalTitle, setApprovalTitle] = useState("");
  const [approvalPlatform, setApprovalPlatform] = useState<"instagram" | "tiktok" | "x">("instagram");
  const [approvalPayload, setApprovalPayload] = useState("");

  const week = useMemo(() => getWeekWindow(weekOffset), [weekOffset]);
  const weekLabel = `${new Date(week.start).toLocaleDateString("de-DE")} – ${new Date(week.end).toLocaleDateString("de-DE")}`;

  const activities = (useQuery(api.activities.listRecent, {
    limit: 60,
    actor: activityActorFilter,
  }) ?? []) as Activity[];

  const rawTasks = useQuery(api.tasks.week, {
    weekStart: week.start,
    weekEnd: week.end,
    status: taskStatusFilter,
  });
  const tasks = useMemo(() => (rawTasks ?? []) as Task[], [rawTasks]);

  const approvals = (useQuery(api.approvals.list, {
    status: "all",
    limit: 30,
  }) ?? []) as Approval[];

  const search = (useQuery(api.search.global, {
    term: queryTerm,
  }) ?? {
    activities: [],
    tasks: [],
    documents: [],
  }) as SearchResult;

  const logActivity = useMutation(api.activities.log);
  const createTask = useMutation(api.tasks.create);
  const setTaskStatus = useMutation(api.tasks.setStatus);
  const createApproval = useMutation(api.approvals.create);
  const decideApproval = useMutation(api.approvals.decide);

  async function onActivitySubmit(e: FormEvent) {
    e.preventDefault();
    if (!activityAction.trim()) return;
    await logActivity({
      actor: "agent",
      source: "dashboard",
      type: "manual",
      action: activityAction,
      details: "Manuell eingetragen",
    });
    setActivityAction("");
  }

  async function onTaskSubmit(e: FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim() || !taskAt) return;
    await createTask({
      title: taskTitle,
      description: "Im Mission Control geplant",
      scheduledAt: new Date(taskAt).getTime(),
    });
    setTaskTitle("");
    setTaskAt("");
  }

  async function onApprovalSubmit(e: FormEvent) {
    e.preventDefault();
    if (!approvalTitle.trim() || !approvalPayload.trim()) return;
    await createApproval({
      title: approvalTitle,
      platform: approvalPlatform,
      payload: approvalPayload,
    });
    setApprovalTitle("");
    setApprovalPayload("");
  }

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(week.monday);
      d.setDate(week.monday.getDate() + i);
      const key = d.toLocaleDateString("de-DE", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      });
      map.set(key, []);
    }

    tasks.forEach((task) => {
      const key = new Date(task.scheduledAt).toLocaleDateString("de-DE", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      });
      map.set(key, [...(map.get(key) ?? []), task]);
    });

    return Array.from(map.entries());
  }, [tasks, week.monday]);

  return (
    <div className="min-h-screen bg-zinc-100 p-6 text-zinc-900">
      <main className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold">Mission Control Dashboard</h1>
          <p className="text-sm text-zinc-600">Aktivitätsfeed, Wochenplanung, globale Suche und Freigabe-Workflow.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Aktivitätsfeed</h2>
              <select
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                value={activityActorFilter}
                onChange={(e) => setActivityActorFilter(e.target.value)}
              >
                <option value="all">Alle Actor</option>
                <option value="agent">Agent</option>
                <option value="user">User</option>
                <option value="system">System</option>
              </select>
            </div>

            <form onSubmit={onActivitySubmit} className="mb-3 flex gap-2">
              <input
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Neue Aktivität..."
                value={activityAction}
                onChange={(e) => setActivityAction(e.target.value)}
              />
              <button className="rounded-lg bg-black px-3 py-2 text-sm text-white">Log</button>
            </form>

            <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
              {activities.map((item) => (
                <div key={item._id} className="rounded-lg border border-zinc-200 p-3">
                  <p className="text-sm font-medium">{item.action}</p>
                  <p className="text-xs text-zinc-600">{item.details}</p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {item.actor} · {item.type} · {new Date(item.createdAt).toLocaleString("de-DE")}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Wochenkalender</h2>
              <div className="flex items-center gap-2">
                <button className="rounded-md border px-2 py-1 text-sm" onClick={() => setWeekOffset((w) => w - 1)}>
                  ← Woche
                </button>
                <span className="text-sm text-zinc-600">{weekLabel}</span>
                <button className="rounded-md border px-2 py-1 text-sm" onClick={() => setWeekOffset((w) => w + 1)}>
                  Woche →
                </button>
                <button className="rounded-md border px-2 py-1 text-sm" onClick={() => setWeekOffset(0)}>
                  Heute
                </button>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2">
              <select
                className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value as "all" | TaskStatus)}
              >
                <option value="all">Alle Status</option>
                <option value="planned">planned</option>
                <option value="in_progress">in_progress</option>
                <option value="done">done</option>
              </select>
            </div>

            <form onSubmit={onTaskSubmit} className="mb-4 grid gap-2 md:grid-cols-3">
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
              <button className="rounded-lg bg-black px-3 py-2 text-sm text-white">Task planen</button>
            </form>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {tasksByDay.map(([day, dayTasks]) => (
                <div key={day} className="rounded-lg border border-zinc-200 p-3">
                  <p className="mb-2 text-sm font-semibold">{day}</p>
                  <div className="space-y-2">
                    {dayTasks.length === 0 && <p className="text-xs text-zinc-400">Keine Tasks</p>}
                    {dayTasks.map((task) => (
                      <div key={task._id} className="rounded-md bg-zinc-50 p-2">
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(task.scheduledAt).toLocaleTimeString("de-DE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" · "}
                          {task.status}
                        </p>
                        <div className="mt-1 flex gap-1">
                          <button
                            onClick={() => setTaskStatus({ taskId: task._id as never, status: "in_progress" })}
                            className="rounded border px-1.5 py-0.5 text-[11px]"
                          >
                            start
                          </button>
                          <button
                            onClick={() => setTaskStatus({ taskId: task._id as never, status: "done" })}
                            className="rounded border px-1.5 py-0.5 text-[11px]"
                          >
                            done
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Globale Suche</h2>
            <p className="mb-3 text-sm text-zinc-600">Score-basiert über Aktivitäten, Aufgaben, Dokumente.</p>
            <input
              className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Begriff eingeben..."
              value={queryTerm}
              onChange={(e) => setQueryTerm(e.target.value)}
            />

            {queryTerm.trim().length > 0 && (
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border border-zinc-200 p-3">
                  <p className="font-semibold">Aktivitäten ({search.activities.length})</p>
                  <ul className="mt-1 list-disc pl-4">
                    {search.activities.slice(0, 5).map((a) => (
                      <li key={a._id}>{a.action} (Score {a._score})</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-zinc-200 p-3">
                  <p className="font-semibold">Aufgaben ({search.tasks.length})</p>
                  <ul className="mt-1 list-disc pl-4">
                    {search.tasks.slice(0, 5).map((t) => (
                      <li key={t._id}>{t.title} (Score {t._score})</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-zinc-200 p-3">
                  <p className="font-semibold">Dokumente ({search.documents.length})</p>
                  <ul className="mt-1 list-disc pl-4">
                    {search.documents.slice(0, 5).map((d) => (
                      <li key={d._id}>{d.title} (Score {d._score})</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </article>

          <article className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Freigabe-Center (Posts)</h2>
            <p className="mb-3 text-sm text-zinc-600">Erst Freigabe, dann Veröffentlichung.</p>

            <form onSubmit={onApprovalSubmit} className="mb-4 space-y-2">
              <input
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Titel (z.B. Reel #12)"
                value={approvalTitle}
                onChange={(e) => setApprovalTitle(e.target.value)}
              />
              <select
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                value={approvalPlatform}
                onChange={(e) => setApprovalPlatform(e.target.value as "instagram" | "tiktok" | "x")}
              >
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="x">X</option>
              </select>
              <textarea
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                rows={3}
                placeholder="Payload/Caption/Assets..."
                value={approvalPayload}
                onChange={(e) => setApprovalPayload(e.target.value)}
              />
              <button className="rounded-lg bg-black px-3 py-2 text-sm text-white">Freigabe anlegen</button>
            </form>

            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {approvals.map((a) => (
                <div key={a._id} className="rounded-lg border border-zinc-200 p-3">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-zinc-600">{a.platform} · {a.status}</p>
                  <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{a.payload}</p>
                  {a.status === "pending" && (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
                        onClick={() => decideApproval({ id: a._id as never, status: "approved", decidedBy: "Hasan" })}
                      >
                        Freigeben
                      </button>
                      <button
                        className="rounded bg-rose-600 px-2 py-1 text-xs text-white"
                        onClick={() => decideApproval({ id: a._id as never, status: "rejected", decidedBy: "Hasan" })}
                      >
                        Ablehnen
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
