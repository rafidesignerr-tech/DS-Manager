import { Form, Link, redirect, useActionData, useNavigation, useSearchParams } from "react-router";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Route } from "./+types/sign-in";
import { AuthCard } from "~/components/layout/auth-card";
import { Button } from "~/components/ui/button";
import { Alert } from "~/components/ui/feedback";
import { Field, Input } from "~/components/ui/form";
import { createAuth } from "~/server/auth.server";
import { schema } from "~/server/db";
import { formString, getActor, getDb, getEnv, safeRedirectPath } from "~/server/request.server";
import { memberCount } from "~/server/team.server";

export const meta: Route.MetaFunction = () => [{ title: "Sign in · D.S Hub" }];

export async function loader({ context, request }: Route.LoaderArgs) {
  const next = safeRedirectPath(new URL(request.url).searchParams.get("next"), "/tasks");
  if (getActor(context)) throw redirect(next);
  const needsSetup = (await memberCount(getDb(context))) === 0;
  return { needsSetup };
}

const schemaIn = z.object({ email: z.email("Enter your email address."), password: z.string().min(1, "Enter your password.") });
const GENERIC = "The email or password is incorrect.";

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await request.formData();
  const parsed = schemaIn.safeParse({ email: formString(form, "email").trim().toLowerCase(), password: formString(form, "password") });
  if (!parsed.success) {
    return { error: null, fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) as Record<string, string> };
  }
  const member = await getDb(context).query.user.findFirst({ where: eq(schema.user.email, parsed.data.email) });
  if (member && member.status !== "active") return { error: GENERIC, fieldErrors: {} as Record<string, string> };
  try {
    const result = await createAuth(env, request).api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: request.headers,
      returnHeaders: true,
    });
    const next = safeRedirectPath(new URL(request.url).searchParams.get("next"), "/tasks");
    return redirect(next, { headers: result.headers });
  } catch {
    return { error: GENERIC, fieldErrors: {} as Record<string, string> };
  }
}

export default function SignIn({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [params] = useSearchParams();
  const errors: Record<string, string> = actionData?.fieldErrors ?? {};
  return (
    <AuthCard
      title="Sign in to the workspace"
      description="For team members. Browsing and feedback don't need an account."
      footer={
        loaderData.needsSetup ? (
          <>
            First time here? <Link to="/setup" className="text-label-sm text-primary-base hover:underline">Set up the first manager</Link>
          </>
        ) : (
          <>Accounts are created by invitation from a manager.</>
        )
      }
    >
      <Form method="post" className="flex flex-col gap-4" noValidate>
        {params.get("reset") === "1" ? <Alert tone="success" live>Your password was changed. Sign in with the new one.</Alert> : null}
        {actionData?.error ? <Alert tone="error" live>{actionData.error}</Alert> : null}
        <Field label="Email" name="email" error={errors.email} required>
          {(p) => <Input type="email" autoComplete="email" autoFocus {...p} />}
        </Field>
        <Field label="Password" name="password" error={errors.password} required>
          {(p) => <Input type="password" autoComplete="current-password" {...p} />}
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-label-sm text-text-sub-600 underline-offset-2 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" pending={navigation.state === "submitting"} className="w-full">
          Sign in
        </Button>
      </Form>
    </AuthCard>
  );
}
