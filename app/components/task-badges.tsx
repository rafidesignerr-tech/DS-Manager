import { RiAlarmWarningLine, RiCalendarLine, RiFlag2Fill } from "@remixicon/react";
import { StatusBadge, type StatusTone } from "~/components/ui/display";
import { dueState, priorityLabel, statusLabel, type TaskPriority, type TaskStatus } from "~/domain/tasks";
import { formatDay } from "~/lib/format";
import { cn } from "~/lib/cn";

const STATUS_TONES: Record<TaskStatus, StatusTone> = {
  backlog: "disabled",
  todo: "information",
  in_progress: "feature",
  blocked: "failed",
  in_review: "pending",
  done: "completed",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <StatusBadge tone={STATUS_TONES[status]}>{statusLabel(status)}</StatusBadge>;
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "text-text-soft-400",
  medium: "text-information-base",
  high: "text-warning-base",
  urgent: "text-error-base",
};

/** Priority is always shown as icon + text, never colour alone. */
export function PriorityLabel({ priority, className }: { priority: TaskPriority; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-label-xs text-text-sub-600", className)}>
      <RiFlag2Fill className={cn("size-4", PRIORITY_COLORS[priority])} aria-hidden />
      {priorityLabel(priority)}
    </span>
  );
}

export function DueLabel({ dueDate, status, className }: { dueDate: string | null; status: TaskStatus; className?: string }) {
  if (!dueDate) return null;
  const state = dueState({ dueDate, status });
  const overdue = state === "overdue";
  const soon = state === "due_soon";
  const Icon = overdue ? RiAlarmWarningLine : RiCalendarLine;
  return (
    <span className={cn("inline-flex items-center gap-1 text-label-xs", overdue ? "text-error-base" : soon ? "text-warning-dark" : "text-text-sub-600", className)}>
      <Icon className="size-4" aria-hidden />
      <span>
        {overdue ? "Overdue · " : soon ? "Due soon · " : "Due "}
        <time dateTime={dueDate}>{formatDay(dueDate)}</time>
      </span>
    </span>
  );
}
