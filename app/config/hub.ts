/**
 * Product configuration. Everything here comes from the BRD or is an explicitly
 * marked assumption ("BRD §16 decision"), so the owner can change it in one place.
 */

export const HUB = {
  /** Working product name (BRD §16: final name to confirm). */
  name: "D.S Hub",
  tagline: "Browse the system. Coordinate the team.",
} as const;

/** Atomic taxonomy for the Components "Atomic view". Labels are configurable (BRD §6.3). */
export const ATOMIC_LEVELS = [
  { id: "atom", label: "Atoms" },
  { id: "molecule", label: "Molecules" },
  { id: "organism", label: "Organisms" },
] as const;
export type AtomicLevel = (typeof ATOMIC_LEVELS)[number]["id"];

/** Reference item lifecycle shown on component detail pages. */
export const REFERENCE_STATUSES = [
  { id: "draft", label: "Draft" },
  { id: "beta", label: "Beta" },
  { id: "stable", label: "Stable" },
  { id: "deprecated", label: "Deprecated" },
] as const;
export type ReferenceStatus = (typeof REFERENCE_STATUSES)[number]["id"];

/**
 * Policy flags for decisions the BRD leaves open (§16). Defaults follow the
 * BRD's "No by default" wording.
 */
export const POLICY = {
  /** Contributors may move their tasks to Done (otherwise a manager closes work after review). */
  contributorCanComplete: false,
  /** Contributors may add private internal notes on feedback. */
  contributorCanAddFeedbackNotes: false,
  /** Contributors may create changelog drafts. */
  contributorCanDraftChangelog: false,
  /** Statuses in which an unassigned task can be claimed with "Assign to me". */
  selfAssignableStatuses: ["backlog", "todo"] as const,
  /** Authors may edit/delete their own comments for this many minutes. Managers: always. */
  commentEditWindowMinutes: 15,
  /** Days before a due date that counts as "due soon". */
  dueSoonDays: 2,
  /** Team invitations expire after this many days. */
  invitationExpiryDays: 7,
  /** Page sizes for long lists. */
  pageSize: 24,
  boardColumnLimit: 50,
  /** Profile image upload limit. */
  avatarMaxBytes: 2 * 1024 * 1024,
} as const;
