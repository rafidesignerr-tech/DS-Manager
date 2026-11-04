import type { StatusTone } from "~/components/ui/display";
import type { FeedbackStatus } from "~/domain/feedback";

export const FEEDBACK_TONES: Record<FeedbackStatus, StatusTone> = {
  new: "information",
  in_review: "pending",
  planned: "feature",
  resolved: "completed",
  closed: "disabled",
};
