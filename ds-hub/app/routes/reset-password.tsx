import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/reset-password";
import { AuthCard } from "~/components/layout/auth-card";
import { Button } from "~/components/ui/button";
import { Alert } from "~/components/ui/feedback";
import { Field, Input } from "~/components/ui/form";
import { createAuth } from "~/server/auth.server";
import { formString, getEnv } from "~/server/request.server";
import { passwordSchema } from "~/server/team.server";

export const meta: Route.MetaFunction = () => [{ title: "Choose a new password · D.S Hub" }];

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return { token: url.searchParams.get("token") ?? "", invalid: url.searchParams.get("error") === "INVALID_TOKEN" };
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const token = formString(form, "token");
  const password = formString(form, "password");
  if (password !== formString(form, "confirm")) return { error: null, fieldErrors: { confirm: "Passwords don't match." } as Record<string, string> };
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: null, fieldErrors: { password: parsed.error.issues[0]?.message ?? "Invalid password." } as Record<string, string> };
  try {
    await createAuth(getEnv(context), request).api.resetPassword({ body: { token, newPassword: parsed.data }, headers: request.headers });
  } catch {
    return { error: "This reset link is invalid or has expired. Request a new one.", fieldErrors: {} as Record<string, string> };
  }
  return redirect("/sign-in?reset=1");
}

export default function ResetPassword({ loaderData }: Route.ComponentProps) {
  const data = useActionData<typeof action>();
  const navigation = useNavigation();
  const errors: Record<string, string> = data?.fieldErrors ?? {};
  if (!loaderData.token || loaderData.invalid) {
    return (
      <AuthCard title="Link not valid" footer={<Link to="/forgot-password" className="text-label-sm text-primary-base hover:underline">Request a new link</Link>}>
        <Alert tone="error">This reset link is invalid or has expired.</Alert>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Choose a new password" description="Use at least 10 characters. You'll be signed out on other devices.">
      <Form method="post" className="flex flex-col gap-4" noValidate>
        {data?.error ? <Alert tone="error" live>{data.error}</Alert> : null}
        <input type="hidden" name="token" value={loaderData.token} />
        <Field label="New password" name="password" error={errors.password} required>
          {(p) => <Input type="password" autoComplete="new-password" autoFocus {...p} />}
        </Field>
        <Field label="Confirm password" name="confirm" error={errors.confirm} required>
          {(p) => <Input type="password" autoComplete="new-password" {...p} />}
        </Field>
        <Button type="submit" pending={navigation.state === "submitting"} className="w-full">
          Save password
        </Button>
      </Form>
    </AuthCard>
  );
}
