import * as React from "react";
import { Form, Link, useActionData, useNavigation } from "react-router";
import { RiCheckboxCircleLine, RiFeedbackLine } from "@remixicon/react";
import type { Route } from "./+types/feedback";
import { PageHeader } from "~/components/ui/page";
import { Alert } from "~/components/ui/feedback";
import { Button } from "~/components/ui/button";
import { Field, Input, Select, Textarea } from "~/components/ui/form";
import { FEEDBACK_TOPICS, feedbackSubmissionSchema } from "~/domain/feedback";
import { formString, getActor, getDb, getEnv } from "~/server/request.server";
import { submitFeedback } from "~/server/feedback.server";

export const meta: Route.MetaFunction = () => [{ title: "Feedback · D.S Hub" }];

export function loader({ context }: Route.LoaderArgs) {
  const actor = getActor(context);
  return {
    // A fresh id per form render; resubmitting the same form can't create a duplicate.
    submissionId: crypto.randomUUID(),
    turnstileSiteKey: getEnv(context).TURNSTILE_SITE_KEY || null,
    signedInEmail: actor?.email ?? null,
  };
}

async function verifyTurnstile(env: Env, token: string, ip: string | null): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true; // not configured (local development)
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const json = (await res.json().catch(() => ({ success: false }))) as { success: boolean };
  return json.success;
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await request.formData();
  const parsed = feedbackSubmissionSchema.safeParse({
    submissionId: formString(form, "submissionId"),
    topic: formString(form, "topic") || undefined,
    message: formString(form, "message"),
    contactEmail: formString(form, "contactEmail"),
    website: formString(form, "website"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    if (fieldErrors.website) return { ok: false as const, error: "We couldn't send this. Try again.", fieldErrors: {} };
    return { ok: false as const, error: null, fieldErrors };
  }
  const human = await verifyTurnstile(env, formString(form, "cf-turnstile-response"), request.headers.get("CF-Connecting-IP"));
  if (!human) return { ok: false as const, error: "Please complete the verification and try again.", fieldErrors: {} as Record<string, string> };
  try {
    await submitFeedback(getDb(context), getActor(context), parsed.data);
    return { ok: true as const, error: null, fieldErrors: {} as Record<string, string> };
  } catch (e) {
    console.error("[feedback] submit failed", e);
    return { ok: false as const, error: "Something went wrong on our side. Your message wasn't sent; please try again.", fieldErrors: {} as Record<string, string> };
  }
}

export default function Feedback({ loaderData }: Route.ComponentProps) {
  const data = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const errors: Record<string, string> = data?.fieldErrors ?? {};
  const [length, setLength] = React.useState(0);

  React.useEffect(() => {
    if (!loaderData.turnstileSiteKey || document.getElementById("cf-turnstile-script")) return;
    const s = document.createElement("script");
    s.id = "cf-turnstile-script";
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    document.head.appendChild(s);
  }, [loaderData.turnstileSiteKey]);

  if (data?.ok) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-12 text-center" role="status">
        <RiCheckboxCircleLine className="size-12 text-success-base" aria-hidden />
        <h1 className="text-title-h5 text-text-strong-950">Thanks, we got it</h1>
        <p className="text-paragraph-md text-text-sub-600">Your feedback goes to the team privately. It isn't published anywhere.</p>
        <div className="flex gap-3">
          <Button asChild variant="neutral" mode="stroke">
            <Link to="/feedback" reloadDocument>Send another</Link>
          </Button>
          <Button asChild variant="neutral" mode="ghost">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader icon={RiFeedbackLine} title="Feedback" description="Found a problem, or have an idea? Tell the team. No account needed." />
      <Form method="post" className="flex flex-col gap-5" noValidate>
        {data?.error ? <Alert tone="error" live>{data.error}</Alert> : null}
        {Object.keys(errors).length ? <Alert tone="error" live>Check the highlighted fields.</Alert> : null}
        <input type="hidden" name="submissionId" value={loaderData.submissionId} />
        <div className="absolute -left-[9999px]" aria-hidden>
          <label>
            Leave this field empty
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <Field label="Topic" name="topic" error={errors.topic}>
          {(p) => (
            <Select {...p} defaultValue="general">
              {FEEDBACK_TOPICS.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Message" name="message" error={errors.message} hint={`${length.toLocaleString("en")} / 2,000 characters`} required>
          {(p) => <Textarea {...p} rows={6} maxLength={2000} onChange={(e) => setLength(e.target.value.length)} placeholder="What happened, or what would help?" />}
        </Field>
        <Field
          label="Email for follow-up"
          name="contactEmail"
          optional
          error={errors.contactEmail}
          hint="Only if you'd like a reply. We use it for this conversation and nothing else."
        >
          {(p) => <Input {...p} type="email" autoComplete="email" defaultValue={loaderData.signedInEmail ?? ""} />}
        </Field>

        {loaderData.turnstileSiteKey ? <div className="cf-turnstile" data-sitekey={loaderData.turnstileSiteKey} /> : null}

        <div className="flex items-center justify-end gap-3 border-t border-stroke-soft-200 pt-5">
          <Button type="submit" pending={submitting}>
            {submitting ? "Sending…" : "Send feedback"}
          </Button>
        </div>
      </Form>
    </div>
  );
}
