/** BRD §11 — initial in-app event types. */
export const NOTIFICATION_EVENTS = {
  task_assigned: "Task assigned to you",
  task_status_changed: "Task status changed",
  task_comment_added: "New comment on a task",
  task_blocked: "Task blocked",
  task_unblocked: "Task unblocked",
  feedback_submitted: "New feedback submitted",
  changelog_published: "Changelog entry published",
  invitation_accepted: "Team invitation accepted",
} as const;
export type NotificationEvent = keyof typeof NOTIFICATION_EVENTS;

export type NotificationTarget = "task" | "feedback" | "changelog" | "member";

export interface NotificationDraft {
  recipientId: string;
  event: NotificationEvent;
  targetType: NotificationTarget;
  targetId: string;
  title: string;
}

export interface TaskAudience {
  assigneeId: string | null;
  createdById: string;
  /** Users who commented on the task. */
  participantIds: string[];
}

/** Everyone involved in a task, minus the person who caused the event. */
function involved(task: TaskAudience, actorId: string, extra: (string | null)[] = []): string[] {
  const ids = new Set<string>([task.createdById, ...task.participantIds, ...extra.filter((x): x is string => !!x)]);
  if (task.assigneeId) ids.add(task.assigneeId);
  ids.delete(actorId);
  return [...ids];
}

/**
 * Recipient rules (BRD §7.5). The actor is never notified about their own action.
 * Kept in one function so recipients can be reconfigured later.
 */
export function taskEventRecipients(
  event: Extract<NotificationEvent, `task_${string}`>,
  task: TaskAudience,
  actorId: string,
  previousAssigneeId: string | null = null,
): string[] {
  switch (event) {
    case "task_assigned":
      return task.assigneeId && task.assigneeId !== actorId ? [task.assigneeId] : [];
    case "task_status_changed":
      return task.assigneeId && task.assigneeId !== actorId ? [task.assigneeId] : [];
    case "task_blocked":
    case "task_unblocked":
      return involved(task, actorId);
    case "task_comment_added":
      return involved(task, actorId, [previousAssigneeId]);
  }
}

export function notificationLabel(event: string): string {
  return NOTIFICATION_EVENTS[event as NotificationEvent] ?? "Update";
}

export function notificationHref(targetType: string, targetId: string): string {
  switch (targetType) {
    case "task":
      return `/tasks/${targetId}`;
    case "feedback":
      return `/manage/feedback/${targetId}`;
    case "changelog":
      return `/changelog/${targetId}`;
    case "member":
      return "/team";
    default:
      return "/notifications";
  }
}
