import { z } from "zod";

/** BRD §8 — feedback triage statuses. */
export const FEEDBACK_STATUSES = [
  { id: "new", label: "New" },
  { id: "in_review", label: "In review" },
  { id: "planned", label: "Planned" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]["id"];
export const FEEDBACK_STATUS_IDS = FEEDBACK_STATUSES.map((s) => s.id) as [FeedbackStatus, ...FeedbackStatus[]];

export const FEEDBACK_TOPICS = [
  { id: "general", label: "General" },
  { id: "foundations", label: "Foundations" },
  { id: "components", label: "Components" },
  { id: "icons", label: "Icons" },
  { id: "docs", label: "Documentation" },
  { id: "bug", label: "Something is broken" },
] as const;
export const FEEDBACK_TOPIC_IDS = FEEDBACK_TOPICS.map((t) => t.id) as [string, ...string[]];

export function feedbackStatusLabel(id: string): string {
  return FEEDBACK_STATUSES.find((s) => s.id === id)?.label ?? id;
}

/** Public submission. Contact is optional; only an email is collected (BRD §12 privacy). */
export const feedbackSubmissionSchema = z.object({
  submissionId: z.uuid("Refresh the page and try again."),
  topic: z.enum(FEEDBACK_TOPIC_IDS).default("general"),
  message: z
    .string()
    .trim()
    .min(10, "Write at least 10 characters so the team can act on it.")
    .max(2000, "Keep it under 2,000 characters."),
  contactEmail: z
    .string()
    .trim()
    .max(254)
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.email("Enter a valid email, or leave it empty.").optional()),
  /** Honeypot field: real people never fill it. */
  website: z.string().max(0).optional(),
});
export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>;
