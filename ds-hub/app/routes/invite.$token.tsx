import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/invite.$token";
import { AuthCard } from "~/components/layout/auth-card";
import { Button } from "~/components/ui/button";
import { Alert } from "~/components/ui/feedback";
import { Field, Input } from "~/components/ui/form";
import { ROLE_LABELS } from "~/domain/permissions";
import { formString, getActor, getDb, getEnv } from "~/server/request.server";
import { acceptInvitation, findInvitation, passwordSchema, TeamError } from "~/server/team.server";

export const meta: Route.MetaFunction = () => [{ title: "Join the team · D.S Hub" }, { name: "robots", content: "noindex" }];

export async function loader({ params, context }: Route.LoaderArgs) {
  if (getActor(context)) throw redirect("/tasks");
  const found = await findInvitation(getDb(context), params.token);
  if (found.state !== "valid") return { state: found.state, email: null, role: null };
  return { state: found.state, email: found.invitation.email, role: found.invitation.role };
}

const formSchema = z.object({ name: z.string().trim().min(1, "Enter your name.").max(80), password: passwordSchema });

export async function action({ request, params, context }: Route.ActionArgs) {
  const form = await request.formData();
  if (formString(form, "password") !== formString(form, "confirm")) return { error: null, fieldErrors: { confirm: "Passwords don't match." } as Record<string, string> };
  const parsed = formSchema.safeParse({ name: formString(form, "name"), password: formString(form, "password") });
  if (!parsed.success) return { error: null, fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) as Record<string, string> };
  try {
    const headers = await acceptInvitation(getDb(context), getEnv(context), request, params.token, parsed.data);
    return redirect("/tasks", { headers });
  } catch (e) {
    return { error: e instanceof TeamError ? e.message : "We couldn't create your account. Try again.", fieldErrors: {} as Record<string, string> };
  }
}

export default function Invite({ loaderData }: Route.ComponentProps) {
  const data = useActionData<typeof action>();
  const navigation = useNavigation();
  const errors: Record<string, string> = data?.fieldErrors ?? {};
  if (loaderData.state !== "valid") {
    const message = loaderData.state === "expired" ? "This invitation has expired. Ask a manager to send a new one." : loaderData.state === "used" ? "This invitation was already used. Sign in instead." : "This invitation link isn't valid.";
    return (
      <AuthCard title="Invitation unavailable" footer={<Link to="/sign-in" className="text-label-sm text-primary-base hover:underline">Go to sign in</Link>}>
        <Alert tone="error">{message}</Alert>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Join the team" description={<>You're invited as a <strong className="text-label-md text-text-strong-950">{loaderData.role ? ROLE_LABELS[loaderData.role] : ""}</strong>.</>}>
      <Form method="post" className="flex flex-col gap-4" noValidate>
        {data?.error ? <Alert tone="error" live>{data.error}</Alert> : null}
        <Field label="Email" name="email">
          {(p) => <Input {...p} value={loaderData.email ?? ""} readOnly disabled />}
        </Field>
        <Field label="Full name" name="name" error={errors.name} required>
          {(p) => <Input autoComplete="name" autoFocus {...p} />}
        </Field>
        <Field label="Password" name="password" error={errors.password} hint="At least 10 characters." required>
          {(p) => <Input type="password" autoComplete="new-password" {...p} />}
        </Field>
        <Field label="Confirm password" name="confirm" error={errors.confirm} required>
          {(p) => <Input type="password" autoComplete="new-password" {...p} />}
        </Field>
        <Button type="submit" pending={navigation.state === "submitting"} className="w-full">
          Create account
        </Button>
      </Form>
    </AuthCard>
  );
}
