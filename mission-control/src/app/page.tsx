"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

type Role = "owner" | "editor" | "viewer";
type TaskStatus = "planned" | "in_progress" | "done";

type Activity = { _id: string; createdAt: number; actor: string; action: string; details?: string; type: string };
type Task = { _id: string; title: string; status: TaskStatus; scheduledAt: number };
type Approval = {
  _id: string;
  title: string;
  platform: "instagram" | "tiktok" | "x";
  payload: string;
  status: "pending" | "approved" | "rejected";
};
type QueueItem = {
  _id: string;
  title: string;
  platform: "instagram" | "tiktok" | "x";
  status: "ready" | "publishing" | "published" | "failed";
};

type SearchResult = {
  activities: Activity[];
  tasks: Task[];
  documents: { _id: string; title: string }[];
};

const rollenLabel: Record<Role, string> = {
  owner: "Inhaber",
  editor: "Bearbeiter",
  viewer: "Leser",
};

const taskStatusLabel: Record<TaskStatus, string> = {
  planned: "Geplant",
  in_progress: "In Arbeit",
  done: "Erledigt",
};

const queueStatusLabel: Record<QueueItem["status"], string> = {
  ready: "Bereit",
  publishing: "Wird veröffentlicht",
  published: "Veröffentlicht",
  failed: "Fehlgeschlagen",
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
  const [role, setRole] = useState<Role>("owner");
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

  const canEdit = role === "owner" || role === "editor";

  const week = useMemo(() => getWeekWindow(weekOffset), [weekOffset]);

  const activities = (useQuery(api.activities.listRecent, { limit: 60, actor: activityActorFilter }) ?? []) as Activity[];
  const rawTasks = useQuery(api.tasks.week, { weekStart: week.start, weekEnd: week.end, status: taskStatusFilter });
  const tasks = useMemo(() => (rawTasks ?? []) as Task[], [rawTasks]);
  const approvals = (useQuery(api.approvals.list, { status: "all", limit: 30 }) ?? []) as Approval[];
  const queue = (useQuery(api.postQueue.list, { status: "all", limit: 30 }) ?? []) as QueueItem[];
  const search = (useQuery(api.search.global, { term: queryTerm }) ?? {
    activities: [],
    tasks: [],
    documents: [],
  }) as SearchResult;

  const logActivity = useMutation(api.activities.log);
  const createTask = useMutation(api.tasks.create);
  const setTaskStatus = useMutation(api.tasks.setStatus);
  const createApproval = useMutation(api.approvals.create);
  const decideApproval = useMutation(api.approvals.decide);
  const setQueueStatus = useMutation(api.postQueue.setStatus);
  const ingestAgentEvent = useMutation(api.events.ingestAgentEvent);

  async function onActivitySubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !activityAction.trim()) return;
    await logActivity({ actor: "agent", source: "dashboard", type: "manual", action: activityAction, details: "Manuell" });
    setActivityAction("");
  }

  async function onTaskSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !taskTitle.trim() || !taskAt) return;
    await createTask({ title: taskTitle, description: "Im Mission Control geplant", scheduledAt: new Date(taskAt).getTime() });
    setTaskTitle("");
    setTaskAt("");
  }

  async function onApprovalSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !approvalTitle.trim() || !approvalPayload.trim()) return;
    await createApproval({ title: approvalTitle, platform: approvalPlatform, payload: approvalPayload });
    setApprovalTitle("");
    setApprovalPayload("");
  }

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(week.monday);
      d.setDate(week.monday.getDate() + i);
      const key = d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
      map.set(key, []);
    }
    tasks.forEach((task) => {
      const key = new Date(task.scheduledAt).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
      map.set(key, [...(map.get(key) ?? []), task]);
    });
    return Array.from(map.entries());
  }, [tasks, week.monday]);

  return (
    <div className="min-h-screen bg-zinc-100 p-6 text-zinc-900">
      <main className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl bg-white p-5 shadow-sm flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Mission-Control-Dashboard · Phase 3</h1>
            <p className="text-sm text-zinc-600">Suchindex, Rollenmodell, Agenten-Event-Ingestion und Veröffentlichungs-Warteschlange.</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>Rolle</span>
            <select className="rounded border px-2 py-1" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="owner">{rollenLabel.owner}</option>
              <option value="editor">{rollenLabel.editor}</option>
              <option value="viewer">{rollenLabel.viewer}</option>
            </select>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Aktivitätsfeed</h2>
              <select className="rounded border px-2 py-1 text-xs" value={activityActorFilter} onChange={(e) => setActivityActorFilter(e.target.value)}>
                <option value="all">Alle</option><option value="agent">Agent</option><option value="user">Nutzer</option><option value="system">System</option>
              </select>
            </div>
            <form onSubmit={onActivitySubmit} className="mb-3 flex gap-2">
              <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Aktivität" value={activityAction} onChange={(e) => setActivityAction(e.target.value)} disabled={!canEdit} />
              <button className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-40" disabled={!canEdit}>Log</button>
            </form>
            <button
              className="mb-3 rounded border px-2 py-1 text-xs"
              onClick={() => ingestAgentEvent({ source: "automation", action: "Auto-Event Ping", details: "Ingestion Test", type: "heartbeat" })}
            >
              Test: Agenten-Event einspielen
            </button>
            <div className="max-h-[400px] space-y-2 overflow-auto">
              {activities.map((a) => (
                <div key={a._id} className="rounded border p-2 text-sm">
                  <p className="font-medium">{a.action}</p>
                  <p className="text-xs text-zinc-500">{a.actor} · {a.type} · {new Date(a.createdAt).toLocaleString("de-DE")}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold mb-2">Wochenkalender</h2>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button className="rounded border px-2 py-1 text-sm" onClick={() => setWeekOffset((w) => w - 1)}>←</button>
              <button className="rounded border px-2 py-1 text-sm" onClick={() => setWeekOffset(0)}>Heute</button>
              <button className="rounded border px-2 py-1 text-sm" onClick={() => setWeekOffset((w) => w + 1)}>→</button>
              <span className="text-sm text-zinc-600">{new Date(week.start).toLocaleDateString("de-DE")} – {new Date(week.end).toLocaleDateString("de-DE")}</span>
              <select className="rounded border px-2 py-1 text-sm" value={taskStatusFilter} onChange={(e) => setTaskStatusFilter(e.target.value as "all" | TaskStatus)}>
                <option value="all">Alle</option><option value="planned">Geplant</option><option value="in_progress">In Arbeit</option><option value="done">Erledigt</option>
              </select>
            </div>
            <form onSubmit={onTaskSubmit} className="mb-4 grid gap-2 md:grid-cols-3">
              <input className="rounded border px-3 py-2 text-sm" placeholder="Tasktitel" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} disabled={!canEdit} />
              <input className="rounded border px-3 py-2 text-sm" type="datetime-local" value={taskAt} onChange={(e) => setTaskAt(e.target.value)} disabled={!canEdit} />
              <button className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-40" disabled={!canEdit}>Task planen</button>
            </form>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
              {tasksByDay.map(([day, dayTasks]) => (
                <div key={day} className="rounded border p-2">
                  <p className="text-sm font-semibold">{day}</p>
                  {dayTasks.length === 0 ? <p className="text-xs text-zinc-400">leer</p> : dayTasks.map((t) => (
                    <div key={t._id} className="mt-2 rounded bg-zinc-50 p-2 text-sm">
                      <p>{t.title}</p>
                      <p className="text-xs text-zinc-500">{taskStatusLabel[t.status]}</p>
                      <div className="mt-1 flex gap-1">
                        <button className="rounded border px-1 text-xs" onClick={() => setTaskStatus({ taskId: t._id as never, status: "in_progress" })} disabled={!canEdit}>Starten</button>
                        <button className="rounded border px-1 text-xs" onClick={() => setTaskStatus({ taskId: t._id as never, status: "done" })} disabled={!canEdit}>Erledigt</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Globale Suche (Index)</h2>
            <input className="my-3 w-full rounded border px-3 py-2 text-sm" placeholder="suchbegriff..." value={queryTerm} onChange={(e) => setQueryTerm(e.target.value)} />
            {queryTerm && (
              <div className="space-y-2 text-sm">
                <p>Aktivitäten: {search.activities.length}</p>
                <p>Tasks: {search.tasks.length}</p>
                <p>Dokumente: {search.documents.length}</p>
              </div>
            )}
          </article>

          <article className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Freigaben</h2>
            <form onSubmit={onApprovalSubmit} className="my-3 space-y-2">
              <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Titel" value={approvalTitle} onChange={(e) => setApprovalTitle(e.target.value)} disabled={!canEdit} />
              <select className="w-full rounded border px-3 py-2 text-sm" value={approvalPlatform} onChange={(e) => setApprovalPlatform(e.target.value as "instagram" | "tiktok" | "x")}>
                <option value="instagram">instagram</option><option value="tiktok">tiktok</option><option value="x">x</option>
              </select>
              <textarea className="w-full rounded border px-3 py-2 text-sm" rows={2} placeholder="payload" value={approvalPayload} onChange={(e) => setApprovalPayload(e.target.value)} disabled={!canEdit} />
              <button className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-40" disabled={!canEdit}>Anlegen</button>
            </form>
            <div className="max-h-[260px] overflow-auto space-y-2">
              {approvals.map((a) => (
                <div key={a._id} className="rounded border p-2 text-sm">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-zinc-500">{a.platform} · {a.status}</p>
                  {a.status === "pending" && (
                    <div className="mt-2 flex gap-2">
                      <button className="rounded bg-emerald-600 px-2 py-1 text-xs text-white" onClick={() => decideApproval({ id: a._id as never, status: "approved", decidedBy: "Hasan" })} disabled={!canEdit}>Freigeben</button>
                      <button className="rounded bg-rose-600 px-2 py-1 text-xs text-white" onClick={() => decideApproval({ id: a._id as never, status: "rejected", decidedBy: "Hasan" })} disabled={!canEdit}>Ablehnen</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Veröffentlichungs-Warteschlange</h2>
            <p className="text-xs text-zinc-500 mb-2">Freigegeben → bereit zur Veröffentlichung</p>
            <div className="max-h-[300px] overflow-auto space-y-2">
              {queue.map((q) => (
                <div key={q._id} className="rounded border p-2 text-sm">
                  <p className="font-medium">{q.title}</p>
                  <p className="text-xs text-zinc-500">{q.platform} · {queueStatusLabel[q.status]}</p>
                  <div className="mt-1 flex gap-1">
                    <button className="rounded border px-1 text-xs" onClick={() => setQueueStatus({ id: q._id as never, status: "publishing" })} disabled={!canEdit}>Veröffentliche</button>
                    <button className="rounded border px-1 text-xs" onClick={() => setQueueStatus({ id: q._id as never, status: "published" })} disabled={!canEdit}>Veröffentlicht</button>
                    <button className="rounded border px-1 text-xs" onClick={() => setQueueStatus({ id: q._id as never, status: "failed" })} disabled={!canEdit}>Fehler</button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
