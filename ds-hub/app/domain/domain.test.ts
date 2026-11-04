import { describe, expect, it } from "vitest";
import { can, type Actor } from "./permissions";
import {
  allowedStatusTransitions,
  canEditField,
  canModifyComment,
  canSelfAssign,
  dueState,
  normalizeTaskChange,
  type TaskRecord,
} from "./tasks";
import { taskEventRecipients } from "./notifications";
import { feedbackSubmissionSchema } from "./feedback";

const manager: Actor = { id: "m1", role: "manager", name: "Sample Manager", email: "m@example.com" };
const contributor: Actor = { id: "c1", role: "contributor", name: "Sample Contributor", email: "c@example.com" };
const other: Actor = { id: "c2", role: "contributor", name: "Other", email: "o@example.com" };

function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "t1",
    title: "Sample task",
    description: "",
    status: "todo",
    priority: "medium",
    progress: 0,
    assigneeId: null,
    createdById: "m1",
    dueDate: null,
    blockerReason: null,
    archivedAt: null,
    ...overrides,
  };
}

describe("permission matrix (BRD §4.4)", () => {
  it("lets visitors browse and submit feedback only", () => {
    expect(can(null, "reference.view")).toBe(true);
    expect(can(null, "feedback.submit")).toBe(true);
    expect(can(null, "task.view")).toBe(false);
    expect(can(null, "notifications.view")).toBe(false);
    expect(can(null, "changelog.viewDrafts")).toBe(false);
  });
  it("keeps management actions with managers", () => {
    for (const p of ["task.create", "task.assignOthers", "team.manage", "feedback.triage", "changelog.publish"] as const) {
      expect(can(manager, p)).toBe(true);
      expect(can(contributor, p)).toBe(false);
    }
  });
  it("gives contributors the workspace", () => {
    for (const p of ["task.view", "task.selfAssign", "comment.create", "notifications.view"] as const) {
      expect(can(contributor, p)).toBe(true);
    }
  });
});

describe("task field permissions", () => {
  it("contributors edit status/progress only on their own task", () => {
    const mine = task({ assigneeId: "c1" });
    expect(canEditField(contributor, mine, "status")).toBe(true);
    expect(canEditField(contributor, mine, "progress")).toBe(true);
    expect(canEditField(contributor, mine, "priority")).toBe(false);
    expect(canEditField(contributor, mine, "assigneeId")).toBe(false);
    expect(canEditField(other, mine, "status")).toBe(false);
  });
  it("managers edit every field", () => {
    expect(canEditField(manager, task(), "assigneeId")).toBe(true);
  });
  it("archived tasks are read-only", () => {
    expect(canEditField(manager, task({ archivedAt: new Date() }), "title")).toBe(false);
  });
});

describe("self-assignment", () => {
  it("allows claiming unassigned backlog/to-do work", () => {
    expect(canSelfAssign(contributor, task())).toBe(true);
    expect(canSelfAssign(contributor, task({ status: "backlog" }))).toBe(true);
  });
  it("blocks claiming assigned or in-flight work", () => {
    expect(canSelfAssign(contributor, task({ assigneeId: "c2" }))).toBe(false);
    expect(canSelfAssign(contributor, task({ status: "in_progress" }))).toBe(false);
    expect(canSelfAssign(null, task())).toBe(false);
  });
});

describe("status transitions", () => {
  it("contributors cannot complete or schedule into backlog by default", () => {
    const next = allowedStatusTransitions(contributor, task({ assigneeId: "c1", status: "in_progress" }));
    expect(next).toContain("in_review");
    expect(next).toContain("blocked");
    expect(next).not.toContain("done");
    expect(next).not.toContain("backlog");
  });
  it("only managers reopen done work", () => {
    expect(allowedStatusTransitions(manager, task({ status: "done" }))).toContain("todo");
    expect(allowedStatusTransitions(contributor, task({ status: "done", assigneeId: "c1" }))).toEqual([]);
  });
});

describe("blocked lifecycle", () => {
  it("requires a blocker reason", () => {
    const { result } = normalizeTaskChange(task(), { status: "blocked" });
    expect(result.ok).toBe(false);
  });
  it("clears the reason when unblocked", () => {
    const { change, result } = normalizeTaskChange(task({ status: "blocked", blockerReason: "Waiting" }), {
      status: "in_progress",
    });
    expect(result.ok).toBe(true);
    expect(change.blockerReason).toBeNull();
  });
  it("sets progress to 100 when done", () => {
    expect(normalizeTaskChange(task(), { status: "done" }).change.progress).toBe(100);
  });
  it("rejects invalid dates", () => {
    expect(normalizeTaskChange(task(), { dueDate: "2026-02-30" }).result.ok).toBe(false);
  });
});

describe("due state", () => {
  const today = new Date("2026-11-04T10:00:00Z");
  it("flags overdue and due soon", () => {
    expect(dueState({ dueDate: "2026-11-01", status: "todo" }, today)).toBe("overdue");
    expect(dueState({ dueDate: "2026-11-05", status: "todo" }, today)).toBe("due_soon");
    expect(dueState({ dueDate: "2026-12-01", status: "todo" }, today)).toBe("scheduled");
    expect(dueState({ dueDate: "2026-11-01", status: "done" }, today)).toBe("none");
  });
});

describe("comment policy", () => {
  const now = new Date("2026-11-04T10:00:00Z");
  it("authors edit within the window, managers always", () => {
    const fresh = { authorId: "c1", createdAt: new Date("2026-11-04T09:50:00Z") };
    const old = { authorId: "c1", createdAt: new Date("2026-11-04T08:00:00Z") };
    expect(canModifyComment(contributor, fresh, now)).toBe(true);
    expect(canModifyComment(contributor, old, now)).toBe(false);
    expect(canModifyComment(other, fresh, now)).toBe(false);
    expect(canModifyComment(manager, old, now)).toBe(true);
  });
});

describe("notification recipients", () => {
  const audience = { assigneeId: "c1", createdById: "m1", participantIds: ["c2"] };
  it("never notifies the actor", () => {
    expect(taskEventRecipients("task_assigned", { ...audience, assigneeId: "m1" }, "m1")).toEqual([]);
    expect(taskEventRecipients("task_comment_added", audience, "c2").sort()).toEqual(["c1", "m1"]);
  });
  it("notifies the assignee on status changes", () => {
    expect(taskEventRecipients("task_status_changed", audience, "m1")).toEqual(["c1"]);
  });
});

describe("feedback validation", () => {
  const base = { submissionId: crypto.randomUUID(), message: "This is a sample message." };
  it("accepts an anonymous submission", () => {
    expect(feedbackSubmissionSchema.safeParse(base).success).toBe(true);
  });
  it("validates optional email", () => {
    expect(feedbackSubmissionSchema.safeParse({ ...base, contactEmail: "nope" }).success).toBe(false);
    expect(feedbackSubmissionSchema.safeParse({ ...base, contactEmail: "" }).success).toBe(true);
  });
  it("rejects bots filling the honeypot", () => {
    expect(feedbackSubmissionSchema.safeParse({ ...base, website: "spam" }).success).toBe(false);
  });
});
