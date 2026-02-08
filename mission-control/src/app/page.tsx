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

type CommandScope = "main" | "subagent" | "hybrid";
type CommandPriority = "low" | "normal" | "high" | "urgent";
type CommandStatus = "queued" | "running" | "paused" | "done" | "failed" | "canceled";

type CommandQueueItem = {
  _id: string;
  title: string;
  prompt: string;
  scope: CommandScope;
  priority: CommandPriority;
  status: CommandStatus;
  runId?: string;
  sessionKey?: string;
  resultSummary?: string;
  resultLink?: string;
  error?: string;
  createdAt: number;
};

type AgentRunEvent = {
  _id: string;
  runId: string;
  ts: number;
  kind: string;
  severity: "info" | "warning" | "error";
  message: string;
  scope?: CommandScope;
};

type ControlAction = {
  _id: string;
  runId?: string;
  commandId?: string;
  action: "pause" | "resume" | "stop" | "retry" | "prioritize";
  triggeredBy: string;
  ts: number;
  reason?: string;
};

type LiveOpsSnapshot = {
  globalStatus: "idle" | "thinking" | "coding" | "blocked";
  counts: Record<CommandStatus, number>;
  activeRuns: number;
  latestRun: CommandQueueItem | null;
  recentFailures: CommandQueueItem[];
  lastUpdateTs: number;
};

type DispatcherStatus = {
  _id: string;
  dispatcher: string;
  ts: number;
  state: "idle" | "polling" | "running" | "error";
  runId?: string;
  message?: string;
  isOnline: boolean;
  ageMs: number;
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

const commandStatusLabel: Record<CommandStatus, string> = {
  queued: "Queued",
  running: "Running",
  paused: "Pausiert",
  done: "Done",
  failed: "Fehlgeschlagen",
  canceled: "Abgebrochen",
};

const priorityLabel: Record<CommandPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const liveStatusLabel: Record<LiveOpsSnapshot["globalStatus"], string> = {
  idle: "Idle",
  thinking: "Thinking",
  coding: "Coding",
  blocked: "Blocked",
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

  const [commandTitle, setCommandTitle] = useState("");
  const [commandPrompt, setCommandPrompt] = useState("");
  const [commandScope, setCommandScope] = useState<CommandScope>("hybrid");
  const [commandPriority, setCommandPriority] = useState<CommandPriority>("high");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [timelineScopeFilter, setTimelineScopeFilter] = useState<"all" | CommandScope>("all");
  const [timelineSeverityFilter, setTimelineSeverityFilter] = useState<"all" | "info" | "warning" | "error">("all");

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
  const rawCommandQueue = useQuery(api.commandQueue.list, { status: "all", limit: 40 });
  const commandQueue = useMemo(() => (rawCommandQueue ?? []) as CommandQueueItem[], [rawCommandQueue]);
  const liveOpsSnapshot = (useQuery(api.commandQueue.liveOpsSnapshot, {}) ?? null) as LiveOpsSnapshot | null;
  const rawDispatcherStatus = useQuery(api.commandQueue.dispatcherStatus, { staleAfterMs: 20000 });
  const dispatcherStatus = useMemo(() => (rawDispatcherStatus ?? []) as DispatcherStatus[], [rawDispatcherStatus]);
  const primaryDispatcher = dispatcherStatus[0] ?? null;
  const dispatcherWarning = useMemo(() => {
    if (!primaryDispatcher) return "Dispatcher-Heartbeat fehlt – starte `npm run dev:ops` oder `npm run owl:dispatcher`.";
    if (!primaryDispatcher.isOnline) {
      return `Dispatcher offline seit ${Math.round(primaryDispatcher.ageMs / 1000)}s – Runs werden aktuell nicht gestartet.`;
    }
    if (primaryDispatcher.ageMs > 10000) {
      return `Dispatcher-Heartbeat verzögert (${Math.round(primaryDispatcher.ageMs / 1000)}s alt).`;
    }
    return null;
  }, [primaryDispatcher]);
  const effectiveRunId =
    selectedRunId || commandQueue.find((item) => item.runId && (item.status === "running" || item.status === "paused"))?.runId || commandQueue.find((item) => item.runId)?.runId || "";
  const search = (useQuery(api.search.global, { term: queryTerm }) ?? {
    activities: [],
    tasks: [],
    documents: [],
  }) as SearchResult;
  const runEvents = (useQuery(
    api.commandQueue.listRunEvents,
    effectiveRunId ? { runId: effectiveRunId, limit: 60 } : "skip",
  ) ?? []) as AgentRunEvent[];
  const recentRunEvents = (useQuery(api.commandQueue.listRecentRunEvents, {
    limit: 120,
    scope: timelineScopeFilter,
    severity: timelineSeverityFilter,
  }) ?? []) as AgentRunEvent[];
  const rawControlActions = useQuery(api.commandQueue.listControlActions, { limit: 40 });
  const controlActions = useMemo(() => (rawControlActions ?? []) as ControlAction[], [rawControlActions]);

  const liveAgentCards = useMemo(() => {
    const scopes: CommandScope[] = ["main", "subagent", "hybrid"];
    return scopes.map((scope) => {
      const recent = commandQueue.find((cmd) => cmd.scope === scope && !!cmd.runId);
      const running = commandQueue.filter((cmd) => cmd.scope === scope && (cmd.status === "running" || cmd.status === "paused")).length;
      return {
        scope,
        recent,
        running,
      };
    });
  }, [commandQueue]);

  const visibleControlActions = useMemo(() => {
    if (!effectiveRunId) return controlActions.slice(0, 10);
    return controlActions.filter((action) => action.runId === effectiveRunId).slice(0, 10);
  }, [controlActions, effectiveRunId]);

  const timelineEvents = effectiveRunId
    ? runEvents
    : recentRunEvents;

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
  const enqueueCommand = useMutation(api.commandQueue.enqueue);
  const controlRun = useMutation(api.commandQueue.controlRun);
  const prioritizeQueuedCommand = useMutation(api.commandQueue.prioritizeQueuedCommand);

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

  async function onCommandSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !commandTitle.trim() || !commandPrompt.trim()) return;
    await enqueueCommand({
      createdBy: "Hasan",
      source: "owl-dashboard",
      title: commandTitle,
      prompt: commandPrompt,
      scope: commandScope,
      priority: commandPriority,
    });
    setCommandTitle("");
    setCommandPrompt("");
    setCommandScope("hybrid");
    setCommandPriority("high");
  }

  async function onRunControl(cmd: CommandQueueItem, action: "pause" | "resume" | "stop" | "retry") {
    if (!canEdit || !cmd.runId) return;
    await controlRun({
      runId: cmd.runId,
      action,
      triggeredBy: "Hasan",
      reason: action === "stop" ? "Manuell im Dashboard gestoppt" : undefined,
    });
  }

  async function onPrioritizeQueued(cmd: CommandQueueItem) {
    if (!canEdit || cmd.status !== "queued") return;
    await prioritizeQueuedCommand({
      commandId: cmd._id as never,
      triggeredBy: "Hasan",
      reason: "Manuell im Dashboard priorisiert",
    });
  }

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

        <section className="grid gap-6 xl:grid-cols-3">
          <article className="rounded-2xl bg-white p-5 shadow-sm xl:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Owl Live Ops · Command Queue</h2>
              <p className="text-xs text-zinc-500">Bridge-Eingang für echte Agent-Ausführung</p>
            </div>

            <form onSubmit={onCommandSubmit} className="mb-4 grid gap-2 md:grid-cols-6">
              <input className="rounded border px-3 py-2 text-sm md:col-span-2" placeholder="Command-Titel" value={commandTitle} onChange={(e) => setCommandTitle(e.target.value)} disabled={!canEdit} />
              <input className="rounded border px-3 py-2 text-sm md:col-span-3" placeholder="Prompt für Agent-Ausführung" value={commandPrompt} onChange={(e) => setCommandPrompt(e.target.value)} disabled={!canEdit} />
              <select className="rounded border px-2 py-2 text-sm" value={commandScope} onChange={(e) => setCommandScope(e.target.value as CommandScope)}>
                <option value="main">main</option>
                <option value="subagent">subagent</option>
                <option value="hybrid">hybrid</option>
              </select>
              <select className="rounded border px-2 py-2 text-sm" value={commandPriority} onChange={(e) => setCommandPriority(e.target.value as CommandPriority)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <button className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-40 md:col-span-6" disabled={!canEdit}>In Queue legen</button>
            </form>

            <div className="max-h-[360px] space-y-2 overflow-auto">
              {commandQueue.map((cmd) => (
                <button
                  key={cmd._id}
                  className={`w-full rounded border p-3 text-left ${cmd.runId && selectedRunId === cmd.runId ? "border-black bg-zinc-50" : "border-zinc-200 bg-white"}`}
                  onClick={() => cmd.runId && setSelectedRunId(cmd.runId)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{cmd.title}</p>
                    <div className="flex items-center gap-1">
                      <span className="rounded border border-zinc-300 px-2 py-0.5 text-xs">{priorityLabel[cmd.priority]}</span>
                      <span className="rounded border border-zinc-300 px-2 py-0.5 text-xs">{cmd.scope}</span>
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cmd.status === "done" ? "bg-emerald-100 text-emerald-800" : cmd.status === "failed" ? "bg-rose-100 text-rose-700" : cmd.status === "running" ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-700"}`}>{commandStatusLabel[cmd.status]}</span>
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{cmd.prompt}</p>
                  <p className="mt-1 text-xs text-zinc-500">{new Date(cmd.createdAt).toLocaleString("de-DE")}{cmd.runId ? ` · ${cmd.runId}` : ""}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {cmd.sessionKey && <span className="rounded border border-zinc-300 px-2 py-0.5 text-zinc-700">session: {cmd.sessionKey}</span>}
                    {cmd.resultLink && (
                      <a
                        className="rounded border border-sky-300 bg-sky-50 px-2 py-0.5 text-sky-700 underline-offset-2 hover:underline"
                        href={cmd.resultLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ergebnis-Link öffnen
                      </a>
                    )}
                  </div>
                  {cmd.resultSummary && <p className="mt-1 text-xs text-emerald-700">Ergebnis: {cmd.resultSummary}</p>}
                  {cmd.error && <p className="mt-1 text-xs text-rose-700">Fehler: {cmd.error}</p>}
                  {(cmd.runId || cmd.status === "queued") && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {cmd.status === "running" && (
                        <>
                          <button
                            className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRunControl(cmd, "pause");
                            }}
                            disabled={!canEdit}
                          >
                            Pause
                          </button>
                          <button
                            className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRunControl(cmd, "stop");
                            }}
                            disabled={!canEdit}
                          >
                            Stop
                          </button>
                        </>
                      )}
                      {cmd.status === "paused" && (
                        <button
                          className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRunControl(cmd, "resume");
                          }}
                          disabled={!canEdit}
                        >
                          Resume
                        </button>
                      )}
                      {(cmd.status === "failed" || cmd.status === "canceled" || cmd.status === "done") && (
                        <button
                          className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-xs text-sky-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRunControl(cmd, "retry");
                          }}
                          disabled={!canEdit}
                        >
                          Retry
                        </button>
                      )}
                      {cmd.status === "queued" && (
                        <button
                          className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPrioritizeQueued(cmd);
                          }}
                          disabled={!canEdit}
                        >
                          Priorisieren
                        </button>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </article>

          <article className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Live-Timeline</h2>
              <p className="text-xs text-zinc-500">{effectiveRunId || "Globaler Stream"}</p>
            </div>
            {!effectiveRunId && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <select className="rounded border px-2 py-1 text-xs" value={timelineScopeFilter} onChange={(e) => setTimelineScopeFilter(e.target.value as "all" | CommandScope)}>
                  <option value="all">Scope: alle</option>
                  <option value="main">Scope: main</option>
                  <option value="subagent">Scope: subagent</option>
                  <option value="hybrid">Scope: hybrid</option>
                </select>
                <select className="rounded border px-2 py-1 text-xs" value={timelineSeverityFilter} onChange={(e) => setTimelineSeverityFilter(e.target.value as "all" | "info" | "warning" | "error")}>
                  <option value="all">Severity: alle</option>
                  <option value="info">info</option>
                  <option value="warning">warning</option>
                  <option value="error">error</option>
                </select>
              </div>
            )}

            <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Owl Body Status</p>
              <div className="mt-2 flex items-center gap-3">
                <span
                  className={`inline-block h-4 w-4 rounded-full ${
                    liveOpsSnapshot?.globalStatus === "blocked"
                      ? "bg-rose-500"
                      : liveOpsSnapshot?.globalStatus === "coding"
                        ? "bg-amber-500"
                        : liveOpsSnapshot?.globalStatus === "thinking"
                          ? "bg-sky-500"
                          : "bg-zinc-400"
                  }`}
                />
                <p className="text-sm font-medium">{liveStatusLabel[liveOpsSnapshot?.globalStatus ?? "idle"]}</p>
                <p className="text-xs text-zinc-600">Aktiv: {liveOpsSnapshot?.activeRuns ?? 0}</p>
              </div>
              <div className="mt-2 rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600">
                {primaryDispatcher ? (
                  <>
                    <span className={`inline-block h-2.5 w-2.5 rounded-full mr-1 ${primaryDispatcher.isOnline ? "bg-emerald-500" : "bg-rose-500"}`} />
                    Dispatcher <span className="font-semibold">{primaryDispatcher.dispatcher}</span>: {primaryDispatcher.isOnline ? "online" : "offline"}
                    {` · ${primaryDispatcher.state}`}
                    {primaryDispatcher.message ? ` · ${primaryDispatcher.message}` : ""}
                  </>
                ) : (
                  "Dispatcher-Heartbeat: noch keine Daten"
                )}
              </div>
              {dispatcherWarning && (
                <div className={`mt-2 rounded border px-2 py-1 text-xs ${primaryDispatcher?.isOnline ? "border-amber-200 bg-amber-50 text-amber-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                  {dispatcherWarning}
                </div>
              )}
              <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-zinc-600">
                <span>Queued: {liveOpsSnapshot?.counts.queued ?? 0}</span>
                <span>Running: {liveOpsSnapshot?.counts.running ?? 0}</span>
                <span>Paused: {liveOpsSnapshot?.counts.paused ?? 0}</span>
                <span>Done: {liveOpsSnapshot?.counts.done ?? 0}</span>
                <span>Failed: {liveOpsSnapshot?.counts.failed ?? 0}</span>
                <span>Canceled: {liveOpsSnapshot?.counts.canceled ?? 0}</span>
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Agent-Karten</p>
              {liveAgentCards.map((card) => {
                const status = card.recent?.status ?? "queued";
                return (
                  <div key={card.scope} className="rounded border border-zinc-200 bg-zinc-50 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{card.scope}</p>
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${status === "done" ? "bg-emerald-100 text-emerald-800" : status === "failed" ? "bg-rose-100 text-rose-700" : status === "running" ? "bg-amber-100 text-amber-800" : status === "paused" ? "bg-violet-100 text-violet-700" : "bg-zinc-100 text-zinc-700"}`}>{commandStatusLabel[status]}</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600 line-clamp-1">{card.recent?.title ?? "Noch kein Run"}</p>
                    <p className="text-xs text-zinc-500">Aktive Runs: {card.running}</p>
                  </div>
                );
              })}
            </div>

            <div className="max-h-[280px] space-y-2 overflow-auto">
              {timelineEvents.length === 0 ? (
                <p className="text-sm text-zinc-500">Noch keine Events.</p>
              ) : (
                timelineEvents.map((event) => (
                  <div key={event._id} className="rounded border border-zinc-200 bg-zinc-50 p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${event.severity === "error" ? "bg-rose-100 text-rose-700" : event.severity === "warning" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-700"}`}>{event.kind}</span>
                        {!effectiveRunId && event.scope && <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700">{event.scope}</span>}
                      </div>
                      <span className="text-xs text-zinc-500">{new Date(event.ts).toLocaleTimeString("de-DE")}</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-700">{event.message}</p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Audit-Trail (Controls)</p>
                <p className="text-xs text-zinc-500">{effectiveRunId ? "gefiltert auf aktuellen Run" : "letzte globalen Aktionen"}</p>
              </div>
              <div className="max-h-[160px] space-y-2 overflow-auto">
                {visibleControlActions.length === 0 ? (
                  <p className="text-xs text-zinc-500">Noch keine Control-Aktionen.</p>
                ) : (
                  visibleControlActions.map((action) => (
                    <div key={action._id} className="rounded border border-zinc-200 bg-white p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{action.action}</span>
                        <span className="text-xs text-zinc-500">{new Date(action.ts).toLocaleTimeString("de-DE")}</span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-600">{action.triggeredBy}{action.reason ? ` · ${action.reason}` : ""}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </article>
        </section>

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
