import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
// Millisecond timestamps set by the app, so events in the same second keep their order.
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$defaultFn(() => new Date());
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Authentication (Better Auth core tables). Passwords live hashed in  */
/* account.password and are never read by application code.           */
/* ------------------------------------------------------------------ */

export const user = sqliteTable("user", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  role: text("role", { enum: ["manager", "contributor"] }).notNull().default("contributor"),
  status: text("status", { enum: ["active", "suspended"] }).notNull().default("active"),
  title: text("title"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = sqliteTable(
  "session",
  {
    id: id(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: id(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* ------------------------------------------------------------------ */
/* Team                                                                */
/* ------------------------------------------------------------------ */

export const invitation = sqliteTable(
  "invitation",
  {
    id: id(),
    email: text("email").notNull(),
    role: text("role", { enum: ["manager", "contributor"] }).notNull(),
    /** SHA-256 of the token sent by email. The raw token is never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    status: text("status", { enum: ["pending", "accepted", "revoked"] }).notNull().default("pending"),
    invitedById: text("invited_by_id").notNull().references(() => user.id),
    acceptedUserId: text("accepted_user_id").references(() => user.id),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("invitation_email_idx").on(t.email)],
);

/* ------------------------------------------------------------------ */
/* Reference content (sample until the owner supplies real content)    */
/* ------------------------------------------------------------------ */

export const referenceItem = sqliteTable(
  "reference_item",
  {
    id: id(),
    kind: text("kind", { enum: ["foundation", "component", "icon"] }).notNull(),
    /** Foundation group, component category, or icon category. */
    groupKey: text("group_key").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    details: text("details").notNull().default(""),
    /** Atomic level for components (configurable taxonomy). */
    level: text("level"),
    status: text("status"),
    /** Short display value, e.g. a sample token value. */
    value: text("value"),
    /** Icon preview key. */
    previewKey: text("preview_key"),
    isSample: integer("is_sample", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("reference_kind_group_idx").on(t.kind, t.groupKey)],
);

export const referenceGroup = sqliteTable(
  "reference_group",
  {
    kind: text("kind", { enum: ["foundation", "component", "icon"] }).notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.kind, t.key] })],
);

export const referenceRelation = sqliteTable(
  "reference_relation",
  {
    fromId: text("from_id").notNull().references(() => referenceItem.id, { onDelete: "cascade" }),
    toId: text("to_id").notNull().references(() => referenceItem.id, { onDelete: "cascade" }),
    /** "uses" | "related" */
    kind: text("kind", { enum: ["uses", "related"] }).notNull().default("related"),
  },
  (t) => [primaryKey({ columns: [t.fromId, t.toId, t.kind] }), index("relation_to_idx").on(t.toId)],
);

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export const task = sqliteTable(
  "task",
  {
    id: id(),
    number: integer("number").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", { enum: ["backlog", "todo", "in_progress", "blocked", "in_review", "done"] })
      .notNull()
      .default("backlog"),
    priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
    progress: integer("progress").notNull().default(0),
    assigneeId: text("assignee_id").references(() => user.id, { onDelete: "set null" }),
    createdById: text("created_by_id").notNull().references(() => user.id),
    dueDate: text("due_date"),
    blockerReason: text("blocker_reason"),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("task_status_idx").on(t.status),
    index("task_assignee_idx").on(t.assigneeId),
    index("task_updated_idx").on(t.updatedAt),
  ],
);

export const taskReference = sqliteTable(
  "task_reference",
  {
    taskId: text("task_id").notNull().references(() => task.id, { onDelete: "cascade" }),
    referenceId: text("reference_id").notNull().references(() => referenceItem.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.referenceId] })],
);

export const comment = sqliteTable(
  "comment",
  {
    id: id(),
    targetType: text("target_type", { enum: ["task"] }).notNull().default("task"),
    targetId: text("target_id").notNull(),
    authorId: text("author_id").notNull().references(() => user.id),
    body: text("body").notNull(),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("comment_target_idx").on(t.targetType, t.targetId)],
);

/** System-recorded actions (BRD §9). */
export const activityEvent = sqliteTable(
  "activity_event",
  {
    id: id(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    action: text("action").notNull(),
    field: text("field"),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    createdAt: createdAt(),
  },
  (t) => [index("activity_target_idx").on(t.targetType, t.targetId), index("activity_created_idx").on(t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export const notification = sqliteTable(
  "notification",
  {
    id: id(),
    recipientId: text("recipient_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    title: text("title").notNull(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("notification_recipient_idx").on(t.recipientId, t.readAt, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export const feedback = sqliteTable(
  "feedback",
  {
    id: id(),
    /** Client-generated id: a resubmitted form cannot create a duplicate. */
    submissionId: text("submission_id").notNull(),
    topic: text("topic").notNull().default("general"),
    message: text("message").notNull(),
    contactEmail: text("contact_email"),
    submittedById: text("submitted_by_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status", { enum: ["new", "in_review", "planned", "resolved", "closed"] })
      .notNull()
      .default("new"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("feedback_submission_idx").on(t.submissionId), index("feedback_status_idx").on(t.status)],
);

/** Internal notes: never shown to the submitter or the public. */
export const feedbackNote = sqliteTable(
  "feedback_note",
  {
    id: id(),
    feedbackId: text("feedback_id").notNull().references(() => feedback.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => user.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("feedback_note_idx").on(t.feedbackId)],
);

/* ------------------------------------------------------------------ */
/* Changelog                                                           */
/* ------------------------------------------------------------------ */

export const changelogEntry = sqliteTable(
  "changelog_entry",
  {
    id: id(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    details: text("details").notNull().default(""),
    entryDate: text("entry_date").notNull(),
    status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdById: text("created_by_id").notNull().references(() => user.id),
    isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("changelog_status_date_idx").on(t.status, t.entryDate)],
);

export const changelogReference = sqliteTable(
  "changelog_reference",
  {
    entryId: text("entry_id").notNull().references(() => changelogEntry.id, { onDelete: "cascade" }),
    referenceId: text("reference_id").notNull().references(() => referenceItem.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.referenceId] })],
);

/* ------------------------------------------------------------------ */
/* Foundation token tracking. Tokens themselves are read-only and live */
/* in app/foundations/tokens.json; this table holds the team's status  */
/* per token, keyed by the token id (stable while the path is stable). */
/* ------------------------------------------------------------------ */

export const tokenTracking = sqliteTable(
  "token_tracking",
  {
    tokenId: text("token_id").primaryKey(),
    designStatus: text("design_status", { enum: ["todo", "in_progress", "in_review", "done"] }).notNull().default("todo"),
    webStatus: text("web_status", { enum: ["todo", "in_progress", "in_review", "done"] }).notNull().default("todo"),
    mobileStatus: text("mobile_status", { enum: ["todo", "in_progress", "in_review", "done"] }).notNull().default("todo"),
    assigneeId: text("assignee_id").references(() => user.id, { onDelete: "set null" }),
    notes: text("notes").notNull().default(""),
    docsUrl: text("docs_url"),
    updatedById: text("updated_by_id").references(() => user.id, { onDelete: "set null" }),
    updatedAt: updatedAt(),
  },
  (t) => [index("token_tracking_assignee_idx").on(t.assigneeId)],
);
