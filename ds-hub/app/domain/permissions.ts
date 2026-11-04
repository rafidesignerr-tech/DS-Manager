import { POLICY } from "~/config/hub";

/** BRD §4 — the three audiences. "public" is an unauthenticated visitor. */
export type Role = "manager" | "contributor";
export type Audience = Role | "public";

export interface Actor {
  id: string;
  role: Role;
  name: string;
  email: string;
}

export type Permission =
  | "reference.view"
  | "changelog.viewPublished"
  | "feedback.submit"
  | "workspace.view"
  | "task.view"
  | "task.create"
  | "task.editAll"
  | "task.assignOthers"
  | "task.selfAssign"
  | "task.updateOwnWork"
  | "task.complete"
  | "task.reopen"
  | "task.archive"
  | "comment.create"
  | "comment.moderate"
  | "team.view"
  | "team.manage"
  | "feedback.view"
  | "feedback.triage"
  | "feedback.addNote"
  | "changelog.viewDrafts"
  | "changelog.draft"
  | "changelog.publish"
  | "notifications.view"
  | "profile.edit";

const PUBLIC: Permission[] = ["reference.view", "changelog.viewPublished", "feedback.submit"];

const CONTRIBUTOR: Permission[] = [
  ...PUBLIC,
  "workspace.view",
  "task.view",
  "task.selfAssign",
  "task.updateOwnWork",
  "comment.create",
  "team.view",
  "feedback.view",
  "changelog.viewDrafts",
  "notifications.view",
  "profile.edit",
  ...(POLICY.contributorCanComplete ? (["task.complete"] as const) : []),
  ...(POLICY.contributorCanAddFeedbackNotes ? (["feedback.addNote"] as const) : []),
  ...(POLICY.contributorCanDraftChangelog ? (["changelog.draft"] as const) : []),
];

const MANAGER: Permission[] = [
  ...CONTRIBUTOR,
  "task.create",
  "task.editAll",
  "task.assignOthers",
  "task.complete",
  "task.reopen",
  "task.archive",
  "comment.moderate",
  "team.manage",
  "feedback.triage",
  "feedback.addNote",
  "changelog.draft",
  "changelog.publish",
];

/** BRD §4.4 permission summary, as data. */
export const PERMISSION_MATRIX: Record<Audience, ReadonlySet<Permission>> = {
  public: new Set(PUBLIC),
  contributor: new Set(CONTRIBUTOR),
  manager: new Set(MANAGER),
};

export function audienceOf(actor: Actor | null): Audience {
  return actor ? actor.role : "public";
}

export function can(actor: Actor | null, permission: Permission): boolean {
  return PERMISSION_MATRIX[audienceOf(actor)].has(permission);
}

export class AuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Throws 401 for visitors and 403 for signed-in users without the permission. */
export function assertCan(actor: Actor | null, permission: Permission): asserts actor is Actor {
  if (can(actor, permission)) return;
  if (!actor) throw new AuthorizationError(401, "Sign in to continue.");
  throw new AuthorizationError(403, "You don't have access to this action.");
}

export const ROLE_LABELS: Record<Role, string> = {
  manager: "Manager",
  contributor: "Contributor",
};
