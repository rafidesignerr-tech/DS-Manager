import { POLICY } from "~/config/hub";
import { can, type Actor } from "./permissions";

/** BRD §7.1 — proposed lifecycle, in workflow order. */
export const TASK_STATUSES = [
  { id: "backlog", label: "Backlog", description: "Recorded but not yet ready or scheduled." },
  { id: "todo", label: "To do", description: "Ready to be worked on." },
  { id: "in_progress", label: "In progress", description: "Actively being worked on." },
  { id: "blocked", label: "Blocked", description: "Work cannot proceed." },
  { id: "in_review", label: "In review", description: "Ready for review." },
  { id: "done", label: "Done", description: "Work is complete." },
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number]["id"];

/** BRD §7.2 — proposed priority values, lowest first. */
export const TASK_PRIORITIES = [
  { id: "low", label: "Low", rank: 0 },
  { id: "medium", label: "Medium", rank: 1 },
  { id: "high", label: "High", rank: 2 },
  { id: "urgent", label: "Urgent", rank: 3 },
] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number]["id"];

export const STATUS_IDS = TASK_STATUSES.map((s) => s.id) as TaskStatus[];
export const PRIORITY_IDS = TASK_PRIORITIES.map((p) => p.id) as TaskPriority[];

export function statusLabel(id: string): string {
  return TASK_STATUSES.find((s) => s.id === id)?.label ?? id;
}
export function priorityLabel(id: string): string {
  return TASK_PRIORITIES.find((p) => p.id === id)?.label ?? id;
}
export function priorityRank(id: string): number {
  return TASK_PRIORITIES.find((p) => p.id === id)?.rank ?? -1;
}

/** Fields that live on a task record. */
export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  assigneeId: string | null;
  createdById: string;
  dueDate: string | null; // YYYY-MM-DD
  blockerReason: string | null;
  archivedAt: Date | null;
}

export type TaskField =
  | "title"
  | "description"
  | "status"
  | "priority"
  | "progress"
  | "assigneeId"
  | "dueDate"
  | "blockerReason"
  | "relatedItemIds";

/** Fields a contributor may change on a task assigned to them (BRD §4.2, §7.1). */
export const CONTRIBUTOR_FIELDS: ReadonlySet<TaskField> = new Set(["status", "progress", "blockerReason"]);

export function isAssignee(actor: Actor | null, task: Pick<TaskRecord, "assigneeId">): boolean {
  return !!actor && task.assigneeId === actor.id;
}

export function canEditField(actor: Actor | null, task: TaskRecord, field: TaskField): boolean {
  if (!actor || task.archivedAt) return false;
  if (can(actor, "task.editAll")) return true;
  return can(actor, "task.updateOwnWork") && isAssignee(actor, task) && CONTRIBUTOR_FIELDS.has(field);
}

export function canSelfAssign(actor: Actor | null, task: TaskRecord): boolean {
  if (!actor || task.archivedAt || !can(actor, "task.selfAssign")) return false;
  return task.assigneeId === null && (POLICY.selfAssignableStatuses as readonly string[]).includes(task.status);
}

/** Statuses this actor may move the task to (excluding its current status). */
export function allowedStatusTransitions(actor: Actor | null, task: TaskRecord): TaskStatus[] {
  if (!canEditField(actor, task, "status")) return [];
  const isManager = can(actor, "task.editAll");
  return STATUS_IDS.filter((next) => {
    if (next === task.status) return false;
    if (task.status === "done") return isManager && can(actor, "task.reopen"); // reopening
    if (next === "done") return can(actor, "task.complete");
    if (!isManager && next === "backlog") return false; // scheduling stays with managers
    return true;
  });
}

export function canComment(actor: Actor | null, task: Pick<TaskRecord, "archivedAt">): boolean {
  return !!actor && !task.archivedAt && can(actor, "comment.create");
}

export function canModifyComment(
  actor: Actor | null,
  comment: { authorId: string; createdAt: Date },
  now: Date = new Date(),
): boolean {
  if (!actor) return false;
  if (can(actor, "comment.moderate")) return true;
  if (comment.authorId !== actor.id) return false;
  const ageMinutes = (now.getTime() - comment.createdAt.getTime()) / 60_000;
  return ageMinutes <= POLICY.commentEditWindowMinutes;
}

export type TaskChange = Partial<Pick<TaskRecord, "title" | "description" | "status" | "priority" | "progress" | "assigneeId" | "dueDate" | "blockerReason">>;

export type ValidationResult = { ok: true } | { ok: false; errors: Record<string, string> };

/**
 * Applies the lifecycle rules to a proposed change and returns the change that
 * should actually be saved (e.g. clearing the blocker reason when unblocked).
 */
export function normalizeTaskChange(current: TaskRecord, change: TaskChange): { change: TaskChange; result: ValidationResult } {
  const next: TaskChange = { ...change };
  const errors: Record<string, string> = {};
  const status = next.status ?? current.status;

  if (status === "blocked") {
    const reason = (next.blockerReason ?? current.blockerReason ?? "").trim();
    if (!reason) errors.blockerReason = "Explain what is blocking this task.";
    else next.blockerReason = reason;
  } else if (current.status === "blocked" || next.blockerReason !== undefined) {
    next.blockerReason = null;
  }

  if (status === "done" && next.progress === undefined) next.progress = 100;
  if (next.progress !== undefined && (next.progress < 0 || next.progress > 100 || !Number.isInteger(next.progress))) {
    errors.progress = "Progress must be a whole number between 0 and 100.";
  }
  if (next.title !== undefined && !next.title.trim()) errors.title = "Title is required.";
  if (next.dueDate && !isValidIsoDate(next.dueDate)) errors.dueDate = "Use a valid date.";

  return { change: next, result: Object.keys(errors).length ? { ok: false, errors } : { ok: true } };
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

export type DueState = "none" | "overdue" | "due_soon" | "scheduled";

export function dueState(task: Pick<TaskRecord, "dueDate" | "status">, today: Date = new Date()): DueState {
  if (!task.dueDate || task.status === "done") return "none";
  const todayIso = today.toISOString().slice(0, 10);
  if (task.dueDate < todayIso) return "overdue";
  const soon = new Date(today.getTime() + POLICY.dueSoonDays * 86_400_000).toISOString().slice(0, 10);
  return task.dueDate <= soon ? "due_soon" : "scheduled";
}

/** Fields whose changes create system activity entries (BRD §7.4). */
export const TRACKED_FIELDS = ["status", "assigneeId", "dueDate", "priority", "title", "blockerReason"] as const;
