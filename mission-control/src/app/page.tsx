"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

type Role = "owner" | "editor" | "viewer";
type TaskStatus = "planned" | "in_progress" | "done";
type TaskAssignee = "ezo" | "hasan" | "both";

type Activity = { _id: string; createdAt: number; actor: string; action: string; details?: string; metadata?: string; type: string };
type Task = { _id: string; title: string; description?: string; status: TaskStatus; scheduledAt: number; assignee?: TaskAssignee };
type Approval = {
  _id: string;
  title: string;
  platform: "instagram" | "tiktok" | "x";
  payload: string;
  status: "pending" | "approved" | "rejected";
  note?: string;
};
type QueueItem = {
  _id: string;
  title: string;
  platform: "instagram" | "tiktok" | "x";
  status: "ready" | "publishing" | "published" | "failed";
  approvalId: string;
  errorMessage?: string;
};

type SearchResult = {
  activities: Activity[];
  tasks: Task[];
  documents: { _id: string; title: string }[];
};

type DayBucket = {
  key: string;
  date: Date;
  tasks: Task[];
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

const assigneeLabel: Record<TaskAssignee, string> = {
  ezo: "Ezo",
  hasan: "Hasan",
  both: "Beide",
};

const assigneeColor: Record<TaskAssignee, string> = {
  ezo: "bg-sky-600 text-white border-sky-700",
  hasan: "bg-emerald-600 text-white border-emerald-700",
  both: "bg-violet-600 text-white border-violet-700",
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

function weekOffsetForTimestamp(ts: number) {
  const now = new Date();
  const target = new Date(ts);

  const nowMonday = new Date(now);
  nowMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  nowMonday.setHours(0, 0, 0, 0);

  const targetMonday = new Date(target);
  targetMonday.setDate(target.getDate() - ((target.getDay() + 6) % 7));
  targetMonday.setHours(0, 0, 0, 0);

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.round((targetMonday.getTime() - nowMonday.getTime()) / msPerWeek);
}

export default function Home() {
  const [role, setRole] = useState<Role>("owner");
  const [weekOffset, setWeekOffset] = useState(0);
  const [taskStatusFilter, setTaskStatusFilter] = useState<"all" | TaskStatus>("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<"all" | TaskAssignee>("all");
  const [activityActorFilter, setActivityActorFilter] = useState("all");
  const [queryTerm, setQueryTerm] = useState("");

  const [activityAction, setActivityAction] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDay, setTaskDay] = useState("");
  const [taskMonth, setTaskMonth] = useState("");
  const [taskYear, setTaskYear] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [taskAssignee, setTaskAssignee] = useState<TaskAssignee>("ezo");
  const [approvalTitle, setApprovalTitle] = useState("");
  const [approvalPlatform, setApprovalPlatform] = useState<"instagram" | "tiktok" | "x">("instagram");
  const [approvalPayload, setApprovalPayload] = useState("");

  const canEdit = role === "owner" || role === "editor";
  const week = useMemo(() => getWeekWindow(weekOffset), [weekOffset]);

  const activities = (useQuery(api.activities.listRecent, { limit: 60, actor: activityActorFilter }) ?? []) as Activity[];
  const rawTasks = useQuery(api.tasks.week, {
    weekStart: week.start,
    weekEnd: week.end,
    status: taskStatusFilter,
    assignee: taskAssigneeFilter,
  });
  const tasks = useMemo(() => (rawTasks ?? []) as Task[], [rawTasks]);
  const approvals = (useQuery(api.approvals.list, { status: "all", limit: 30 }) ?? []) as Approval[];
  const queue = (useQuery(api.postQueue.list, { status: "all", limit: 30 }) ?? []) as QueueItem[];
  const search = (useQuery(api.search.global, { term: queryTerm }) ?? {
    activities: [],
    tasks: [],
    documents: [],
  }) as SearchResult;

  const logActivity = useMutation(api.activities.log);
  const removeActivity = useMutation(api.activities.remove);
  const createTask = useMutation(api.tasks.create);
  const setTaskStatus = useMutation(api.tasks.setStatus);
  const removeTask = useMutation(api.tasks.remove);
  const createApproval = useMutation(api.approvals.create);
  const decideApproval = useMutation(api.approvals.decide);
  const setQueueStatus = useMutation(api.postQueue.setStatus);
  const moveBackToApproval = useMutation(api.postQueue.moveBackToApproval);
  const ingestAgentEvent = useMutation(api.events.ingestAgentEvent);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, DayBucket>();
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(week.monday);
      d.setDate(week.monday.getDate() + i);
      const key = d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
      map.set(key, { key, date: d, tasks: [] });
    }
    tasks.forEach((task) => {
      const key = new Date(task.scheduledAt).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
      const bucket = map.get(key);
      if (bucket) bucket.tasks.push(task);
    });
    return Array.from(map.values());
  }, [tasks, week.monday]);

  const [selectedDay, setSelectedDay] = useState<string>("");
  const [expandedTaskId, setExpandedTaskId] = useState<string>("");
  const [expandedApprovalId, setExpandedApprovalId] = useState<string>("");
  const [highlightApprovalId, setHighlightApprovalId] = useState<string>("");
  const [expandedQueueId, setExpandedQueueId] = useState<string>("");
  const effectiveSelectedDay = selectedDay || tasksByDay[0]?.key || "";
  const selectedBucket = tasksByDay.find((b) => b.key === effectiveSelectedDay) ?? tasksByDay[0];

  async function onActivitySubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !activityAction.trim()) return;
    await logActivity({ actor: "agent", source: "dashboard", type: "manual", action: activityAction, details: "Manuell" });
    setActivityAction("");
  }

  async function onTaskSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !taskTitle.trim() || !taskDay || !taskMonth || !taskYear || !taskTime) return;
    if (taskYear.length !== 4) return;
    const dd = taskDay.padStart(2, "0");
    const mm = taskMonth.padStart(2, "0");
    const iso = `${taskYear}-${mm}-${dd}T${taskTime}`;
    await createTask({
      title: taskTitle,
      description: taskDescription.trim() || undefined,
      assignee: taskAssignee,
      scheduledAt: new Date(iso).getTime(),
    });
    setTaskTitle("");
    setTaskDescription("");
    setTaskDay("");
    setTaskMonth("");
    setTaskYear("");
    setTaskTime("");
    setTaskAssignee("ezo");
  }

  async function onApprovalSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !approvalTitle.trim() || !approvalPayload.trim()) return;
    await createApproval({ title: approvalTitle, platform: approvalPlatform, payload: approvalPayload });
    setApprovalTitle("");
    setApprovalPayload("");
  }

  function openTaskInCalendar(taskId: string, scheduledAt?: number) {
    setTaskStatusFilter("all");
    setTaskAssigneeFilter("all");

    if (typeof scheduledAt === "number") {
      setWeekOffset(weekOffsetForTimestamp(scheduledAt));
      setSelectedDay(
        new Date(scheduledAt).toLocaleDateString("de-DE", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
        }),
      );
    }
    setExpandedTaskId(taskId);
  }

  function openApprovalById(approvalId: string) {
    setExpandedApprovalId(approvalId);
    setHighlightApprovalId(approvalId);
    const el = document.getElementById("approvals-section");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openQueueById(queueId: string) {
    setExpandedQueueId(queueId);
    const el = document.getElementById("queue-section");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onActivityClick(activity: Activity) {
    if (!activity.metadata) return;
    try {
      const parsed = JSON.parse(activity.metadata) as { taskId?: string; scheduledAt?: number; approvalId?: string; postQueueId?: string };
      if (parsed.taskId) {
        openTaskInCalendar(parsed.taskId, parsed.scheduledAt);
        return;
      }
      if (parsed.approvalId) {
        openApprovalById(parsed.approvalId);
        return;
      }
      if (parsed.postQueueId) {
        openQueueById(parsed.postQueueId);
      }
    } catch {
      // ignore invalid metadata
    }
  }

  useEffect(() => {
    if (!highlightApprovalId) return;
    const t = setTimeout(() => setHighlightApprovalId(""), 1600);
    return () => clearTimeout(t);
  }, [highlightApprovalId]);

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
              {activities.map((a) => {
                const doneActivity = /erledigt|\bdone\b/i.test(a.action);
                const queuePublished = /PostQueue Status:\s*published/i.test(a.action);
                const queuePublishing = /PostQueue Status:\s*publishing/i.test(a.action);
                const queueFailed = /PostQueue Status:\s*failed/i.test(a.action);
                let activityAssignee: TaskAssignee | undefined;
                let hasLinkedTarget = false;

                if (a.metadata) {
                  try {
                    const parsed = JSON.parse(a.metadata) as { assignee?: TaskAssignee; taskId?: string; approvalId?: string; postQueueId?: string };
                    if (parsed.assignee === "ezo" || parsed.assignee === "hasan" || parsed.assignee === "both") {
                      activityAssignee = parsed.assignee;
                    }
                    hasLinkedTarget = !!parsed.taskId || !!parsed.approvalId || !!parsed.postQueueId;
                  } catch {
                    // ignore invalid metadata
                  }
                }

                return (
                  <div
                    key={a._id}
                    className={`rounded border p-2 text-sm ${doneActivity || queuePublished ? "border-emerald-300 bg-emerald-50" : ""} ${queuePublishing ? "border-amber-300 bg-amber-50" : ""} ${queueFailed ? "border-rose-300 bg-rose-50" : ""} ${hasLinkedTarget ? "cursor-pointer hover:bg-zinc-50" : ""}`}
                    onClick={() => hasLinkedTarget && onActivityClick(a)}
                    title={hasLinkedTarget ? "Klick öffnet den verknüpften Eintrag" : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`font-medium ${doneActivity || queuePublished ? "text-emerald-700" : queuePublishing ? "text-amber-700" : queueFailed ? "text-rose-700" : ""}`}>{a.action}</p>
                          {activityAssignee && (
                            <button className={`rounded border px-2 py-0.5 text-xs font-semibold ${assigneeColor[activityAssignee]}`} disabled>
                              {assigneeLabel[activityAssignee]}
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500">{a.actor} · {a.type} · {new Date(a.createdAt).toLocaleString("de-DE")}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {hasLinkedTarget && (
                          <button
                            className="rounded border px-2 py-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onActivityClick(a);
                            }}
                          >
                            Öffnen
                          </button>
                        )}
                        <button
                          className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 disabled:opacity-40"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeActivity({ id: a._id as never });
                          }}
                          disabled={!canEdit}
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                <option value="all">Alle Status</option><option value="planned">Geplant</option><option value="in_progress">In Arbeit</option><option value="done">Erledigt</option>
              </select>
              <select className="rounded border px-2 py-1 text-sm" value={taskAssigneeFilter} onChange={(e) => setTaskAssigneeFilter(e.target.value as "all" | TaskAssignee)}>
                <option value="all">Alle Personen</option><option value="ezo">Ezo</option><option value="hasan">Hasan</option><option value="both">Beide</option>
              </select>
              <div className="flex items-center gap-1 text-xs">
                <button className={`rounded border px-2 py-0.5 font-semibold ${assigneeColor.ezo}`} disabled>Ezo</button>
                <button className={`rounded border px-2 py-0.5 font-semibold ${assigneeColor.hasan}`} disabled>Hasan</button>
                <button className={`rounded border px-2 py-0.5 font-semibold ${assigneeColor.both}`} disabled>Beide</button>
              </div>
            </div>
            <form onSubmit={onTaskSubmit} className="mb-4 grid gap-2 md:grid-cols-8">
              <input className="rounded border px-3 py-2 text-sm md:col-span-2" placeholder="Tasktitel" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} disabled={!canEdit} />
              <input className="rounded border px-3 py-2 text-sm md:col-span-2" placeholder="Beschreibung (optional)" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} disabled={!canEdit} />
              <input className="rounded border px-3 py-2 text-sm" inputMode="numeric" placeholder="TT" value={taskDay} onChange={(e) => setTaskDay(e.target.value.replace(/\D/g, "").slice(0, 2))} disabled={!canEdit} />
              <input className="rounded border px-3 py-2 text-sm" inputMode="numeric" placeholder="MM" value={taskMonth} onChange={(e) => setTaskMonth(e.target.value.replace(/\D/g, "").slice(0, 2))} disabled={!canEdit} />
              <input className="rounded border px-3 py-2 text-sm" inputMode="numeric" placeholder="YYYY" value={taskYear} onChange={(e) => setTaskYear(e.target.value.replace(/\D/g, "").slice(0, 4))} disabled={!canEdit} />
              <input className="rounded border px-3 py-2 text-sm min-w-[96px]" type="time" value={taskTime} onChange={(e) => setTaskTime(e.target.value)} disabled={!canEdit} />
              <select className="rounded border px-3 py-2 text-sm md:col-span-2" value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value as TaskAssignee)} disabled={!canEdit}>
                <option value="ezo">Für Ezo</option>
                <option value="hasan">Für Hasan</option>
                <option value="both">Für beide</option>
              </select>
              <button className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-40 md:col-span-8" disabled={!canEdit}>Task planen</button>
            </form>

            <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {tasksByDay.map((bucket) => (
                <button
                  key={bucket.key}
                  className={`rounded border p-2 text-left ${effectiveSelectedDay === bucket.key ? "border-black bg-zinc-100" : "border-zinc-200 bg-white"}`}
                  onClick={() => {
                    setSelectedDay(bucket.key);
                    setExpandedTaskId("");
                  }}
                >
                  <p className="text-sm font-semibold">{bucket.key}</p>
                  <p className="text-xs text-zinc-500">{bucket.tasks.length} Task(s)</p>
                </button>
              ))}
            </div>

            {selectedBucket && (
              <div className="rounded-xl border bg-zinc-50 p-3">
                <p className="mb-2 text-sm font-semibold">Tag geöffnet: {selectedBucket.key}</p>
                {selectedBucket.tasks.length === 0 ? (
                  <p className="text-sm text-zinc-500">Keine Tasks an diesem Tag.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedBucket.tasks.map((t) => {
                      const assignee = t.assignee ?? "both";
                      const isExpanded = expandedTaskId === t._id;
                      return (
                        <div
                          key={t._id}
                          className={`rounded border bg-white p-2 text-sm ${t.status === "done" ? "border-emerald-500" : "border-zinc-200"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium">{t.title}</p>
                            <button className={`rounded border px-2 py-0.5 text-xs font-semibold ${assigneeColor[assignee]}`} disabled>{assigneeLabel[assignee]}</button>
                          </div>
                          <p className="text-xs text-zinc-500">
                            {new Date(t.scheduledAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · {taskStatusLabel[t.status]}
                          </p>

                          <div className="mt-2">
                            <button className="rounded border px-2 py-1 text-xs" onClick={() => setExpandedTaskId(isExpanded ? "" : (t._id as string))}>
                              {isExpanded ? "Details schließen" : "Details anzeigen"}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 rounded border bg-zinc-50 p-2 text-xs text-zinc-700">
                              {t.description?.trim() ? t.description : "Keine Beschreibung hinterlegt."}
                            </div>
                          )}

                          <div className="mt-2 flex flex-wrap gap-1">
                            <button
                              className={`rounded border px-2 py-1 text-xs font-semibold ${
                                t.status === "done"
                                  ? "border-emerald-700 bg-emerald-600 text-white"
                                  : "border-zinc-300 bg-white text-zinc-700"
                              }`}
                              onClick={() => setTaskStatus({ taskId: t._id as never, status: t.status === "done" ? "planned" : "done" })}
                              disabled={!canEdit}
                            >
                              Erledigt
                            </button>
                            <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => removeTask({ taskId: t._id as never })} disabled={!canEdit}>Löschen</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Globale Suche (Index)</h2>
            <input className="my-3 w-full rounded border px-3 py-2 text-sm" placeholder="suchbegriff..." value={queryTerm} onChange={(e) => setQueryTerm(e.target.value)} />
            {queryTerm && (
              <div className="space-y-3 text-sm">
                <p className="text-zinc-600">Aktivitäten: {search.activities.length} · Tasks: {search.tasks.length} · Dokumente: {search.documents.length}</p>

                {search.tasks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Task-Treffer</p>
                    {search.tasks.map((t) => {
                      const assignee = t.assignee ?? "both";
                      return (
                        <button
                          key={t._id}
                          className={`w-full rounded border bg-white p-2 text-left ${t.status === "done" ? "border-emerald-500" : "border-zinc-200"}`}
                          onClick={() => openTaskInCalendar(t._id, t.scheduledAt)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium">{t.title}</p>
                            <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${assigneeColor[assignee]}`}>{assigneeLabel[assignee]}</span>
                          </div>
                          <p className="text-xs text-zinc-500">
                            {new Date(t.scheduledAt).toLocaleString("de-DE")} · {taskStatusLabel[t.status]}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </article>

          <article id="approvals-section" className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Freigaben</h2>
            <form onSubmit={onApprovalSubmit} className="my-3 space-y-2">
              <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Titel" value={approvalTitle} onChange={(e) => setApprovalTitle(e.target.value)} disabled={!canEdit} />
              <select className="w-full rounded border px-3 py-2 text-sm" value={approvalPlatform} onChange={(e) => setApprovalPlatform(e.target.value as "instagram" | "tiktok" | "x")}>
                <option value="instagram">instagram</option><option value="tiktok">tiktok</option><option value="x">x</option>
              </select>
              <textarea className="w-full rounded border px-3 py-2 text-sm" rows={3} placeholder="Details / Inhalt" value={approvalPayload} onChange={(e) => setApprovalPayload(e.target.value)} disabled={!canEdit} />
              <button className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-40" disabled={!canEdit}>Anlegen</button>
            </form>
            <div className="max-h-[260px] overflow-auto space-y-2">
              {approvals.map((a) => {
                const expanded = expandedApprovalId === a._id;
                return (
                  <div
                    key={a._id}
                    className={`rounded border p-2 text-sm transition-all ${expanded ? "border-black" : ""} ${highlightApprovalId === a._id ? "border-amber-400 bg-amber-50 ring-2 ring-amber-300" : ""}`}
                  >
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-zinc-500">{a.platform} · {a.status}</p>
                    <button className="mt-2 rounded border px-2 py-1 text-xs" onClick={() => setExpandedApprovalId(expanded ? "" : (a._id as string))}>
                      {expanded ? "Details schließen" : "Details anzeigen"}
                    </button>
                    {expanded && <p className="mt-2 rounded border bg-zinc-50 p-2 text-xs text-zinc-700 whitespace-pre-wrap">{a.payload}</p>}
                    {a.status === "pending" && (
                      <div className="mt-2 flex gap-2">
                        <button className="rounded bg-emerald-600 px-2 py-1 text-xs text-white" onClick={() => decideApproval({ id: a._id as never, status: "approved", decidedBy: "Hasan" })} disabled={!canEdit}>Freigeben</button>
                        <button className="rounded bg-rose-600 px-2 py-1 text-xs text-white" onClick={() => decideApproval({ id: a._id as never, status: "rejected", decidedBy: "Hasan" })} disabled={!canEdit}>Ablehnen</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </article>

          <article id="queue-section" className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Veröffentlichungs-Warteschlange</h2>
            <p className="text-xs text-zinc-500 mb-2">Freigegeben → bereit zur Veröffentlichung</p>
            <div className="max-h-[300px] overflow-auto space-y-2">
              {queue.map((q) => {
                const expanded = expandedQueueId === q._id;
                return (
                <div key={q._id} className={`rounded border p-2 text-sm ${expanded ? "border-black" : ""}`}>
                  <p className="font-medium">{q.title}</p>
                  <p className={`text-xs ${q.status === "published" ? "text-emerald-700" : q.status === "publishing" ? "text-amber-700" : "text-zinc-500"}`}>
                    {q.platform} · {queueStatusLabel[q.status]}
                  </p>
                  <button className="mt-1 rounded border px-2 py-1 text-xs" onClick={() => setExpandedQueueId(expanded ? "" : (q._id as string))}>
                    {expanded ? "Details schließen" : "Details anzeigen"}
                  </button>
                  {q.status === "failed" && q.errorMessage && (
                    <button
                      className="mt-1 rounded border border-rose-200 bg-rose-50 p-1 text-left text-xs text-rose-700"
                      onClick={() => setExpandedQueueId(expanded ? "" : (q._id as string))}
                    >
                      Fehler: {expanded ? q.errorMessage : "anzeigen"}
                    </button>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1">
                    <button className="rounded border border-amber-300 bg-amber-100 px-1 text-xs text-amber-800" onClick={() => setQueueStatus({ id: q._id as never, status: "publishing" })} disabled={!canEdit}>Veröffentliche</button>
                    <button className="rounded border border-emerald-700 bg-emerald-600 px-1 text-xs font-semibold text-white" onClick={() => setQueueStatus({ id: q._id as never, status: "published" })} disabled={!canEdit}>Veröffentlicht</button>
                    <button
                      className="rounded border px-1 text-xs"
                      onClick={() => setQueueStatus({ id: q._id as never, status: "failed", errorMessage: q.errorMessage ?? "Manuell als Fehler markiert" })}
                      disabled={!canEdit}
                    >
                      Fehler
                    </button>
                    <button className="rounded border border-violet-700 bg-violet-600 px-1 text-xs font-semibold text-white" onClick={() => moveBackToApproval({ id: q._id as never })} disabled={!canEdit}>Zurück zu Freigaben</button>
                  </div>
                </div>
                );
              })}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
