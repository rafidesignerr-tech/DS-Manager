import { Form, Link, useActionData, useNavigation } from "react-router";
import { RiArrowLeftLine, RiLockLine, RiMailLine } from "@remixicon/react";
import type { Route } from "./+types/manage.feedback.$id";
import { Time } from "~/components/ui/time";
import { Card, CardHeader } from "~/components/ui/page";
import { Alert } from "~/components/ui/feedback";
import { Avatar, Badge, StatusBadge } from "~/components/ui/display";
import { Button } from "~/components/ui/button";
import { Field, Select, Textarea } from "~/components/ui/form";
import { FEEDBACK_STATUSES, FEEDBACK_STATUS_IDS, FEEDBACK_TOPICS, feedbackStatusLabel, type FeedbackStatus } from "~/domain/feedback";
import { formatDateTime, formatRelative } from "~/lib/format";
import { formString, getDb, getEnv, notFound, redirectWithFlash, requirePermission } from "~/server/request.server";
import { addFeedbackNote, getFeedback, setFeedbackStatus } from "~/server/feedback.server";
import { FEEDBACK_TONES } from "~/components/feedback-tones";

export const meta: Route.MetaFunction = () => [{ title: "Feedback · D.S Hub" }];

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const actor = requirePermission(context, request, "feedback.view");
  const found = await getFeedback(getDb(context), actor, params.id);
  if (!found) throw notFound("This feedback doesn't exist.");
  return found;
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const actor = requirePermission(context, request, "feedback.view");
  const form = await request.formData();
  const intent = formString(form, "intent");
  const db = getDb(context);
  const here = `/manage/feedback/${params.id}`;
  if (intent === "status") {
    requirePermission(context, request, "feedback.triage");
    const status = formString(form, "status") as FeedbackStatus;
    if (!FEEDBACK_STATUS_IDS.includes(status)) return { error: "Choose a status." };
    await setFeedbackStatus(db, actor, params.id, status);
    return redirectWithFlash(getEnv(context), request, here, { tone: "success", message: `Marked as ${feedbackStatusLabel(status)}.` });
  }
  if (intent === "note") {
    requirePermission(context, request, "feedback.addNote");
    const body = formString(form, "body").trim();
    if (!body) return { error: "Write a note first." };
    if (body.length > 5000) return { error: "Keep notes under 5,000 characters." };
    await addFeedbackNote(db, actor, params.id, body);
    return redirectWithFlash(getEnv(context), request, here, { tone: "success", message: "Internal note added." });
  }
  return { error: "Unknown action." };
}

export default function FeedbackDetail({ loaderData }: Route.ComponentProps) {
  const { feedback: f, notes, history, permissions } = loaderData;
  const data = useActionData<typeof action>();
  const navigation = useNavigation();
  const topic = FEEDBACK_TOPICS.find((t) => t.id === f.topic)?.label ?? f.topic;
  return (
    <div className="flex flex-col gap-6">
      <Link to="/manage/feedback" className="inline-flex w-fit items-center gap-1.5 text-label-sm text-text-sub-600 hover:text-text-strong-950">
        <RiArrowLeftLine className="size-4" aria-hidden /> Back to inbox
      </Link>
      {data?.error ? <Alert tone="error" live>{data.error}</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="gray">{topic}</Badge>
              <StatusBadge tone={FEEDBACK_TONES[f.status]}>{feedbackStatusLabel(f.status)}</StatusBadge>
              <Time value={f.createdAt} format="datetime" className="text-paragraph-xs text-text-sub-600" />
            </div>
            <h1 className="sr-only">Feedback submission</h1>
            <p className="mt-4 whitespace-pre-line break-words text-paragraph-md text-text-strong-950">{f.message}</p>
            <div className="mt-5 border-t border-stroke-soft-200 pt-4 text-paragraph-sm text-text-sub-600">
              {f.contactEmail ? (
                <span className="inline-flex items-center gap-1.5"><RiMailLine className="size-4" aria-hidden />Reply to <a className="text-primary-base hover:underline" href={`mailto:${f.contactEmail}`}>{f.contactEmail}</a></span>
              ) : (
                "No contact details were provided."
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Internal notes" description="Private to the team. Never shown to the person who sent this." action={<RiLockLine className="size-5 text-text-soft-400" aria-hidden />} />
            {notes.length ? (
              <ul className="flex flex-col gap-3 p-4">
                {notes.map((n) => (
                  <li key={n.id} className="flex items-start gap-3">
                    <Avatar name={n.authorName} image={n.authorImage} size={32} />
                    <div className="flex-1 rounded-xl bg-bg-weak-50 p-3">
                      <p className="text-label-sm text-text-strong-950">{n.authorName} <span className="text-paragraph-xs text-text-sub-600"><Time value={n.createdAt} format="relative" /></span></p>
                      <p className="mt-1 whitespace-pre-line text-paragraph-sm text-text-strong-950">{n.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-paragraph-sm text-text-sub-600">No notes yet.</p>
            )}
            {permissions.canAddNote ? (
              <Form method="post" className="flex flex-col gap-2 border-t border-stroke-soft-200 p-4">
                <input type="hidden" name="intent" value="note" />
                <Field label="Add an internal note" name="body">
                  {(p) => <Textarea {...p} rows={3} maxLength={5000} />}
                </Field>
                <div className="flex justify-end"><Button type="submit" size="small" variant="neutral" mode="stroke">Add note</Button></div>
              </Form>
            ) : null}
          </Card>
        </div>
        <aside className="flex flex-col gap-6" aria-label="Triage">
          <Card>
            <CardHeader title="Triage" />
            {permissions.canTriage ? (
              <Form method="post" className="flex flex-col gap-3 p-4">
                <input type="hidden" name="intent" value="status" />
                <Field label="Status" name="status">
                  {(p) => (
                    <Select {...p} defaultValue={f.status} key={f.status}>
                      {FEEDBACK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </Select>
                  )}
                </Field>
                <Button type="submit" size="small" pending={navigation.state === "submitting"}>Update status</Button>
              </Form>
            ) : (
              <p className="p-4 text-paragraph-sm text-text-sub-600">Only managers can change the triage status.</p>
            )}
            {history.length ? (
              <ol className="space-y-2 border-t border-stroke-soft-200 p-4">
                {history.map((h) => (
                  <li key={h.id} className="text-paragraph-xs text-text-sub-600">
                    <span className="text-label-xs text-text-strong-950">{h.actorName ?? "Former member"}</span> set {feedbackStatusLabel(h.toValue ?? "")} · <Time value={h.createdAt} format="relative" />
                  </li>
                ))}
              </ol>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
