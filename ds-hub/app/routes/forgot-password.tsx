import { Form, Link, useActionData, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/forgot-password";
import { AuthCard } from "~/components/layout/auth-card";
import { Button } from "~/components/ui/button";
import { Alert } from "~/components/ui/feedback";
import { Field, Input } from "~/components/ui/form";
import { createAuth } from "~/server/auth.server";
import { formString, getEnv } from "~/server/request.server";

export const meta: Route.MetaFunction = () => [{ title: "Reset password · D.S Hub" }];

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const email = z.email().safeParse(formString(form, "email").trim().toLowerCase());
  if (!email.success) return { sent: false, error: "Enter a valid email address." };
  const origin = new URL(request.url).origin;
  // Same response whether or not the account exists, so emails can't be probed.
  await createAuth(getEnv(context), request)
    .api.requestPasswordReset({ body: { email: email.data, redirectTo: `${origin}/reset-password` }, headers: request.headers })
    .catch(() => null);
  return { sent: true, error: null };
}

export default function ForgotPassword() {
  const data = useActionData<typeof action>();
  const navigation = useNavigation();
  return (
    <AuthCard title="Reset your password" description="We'll email you a link to choose a new password." footer={<Link to="/sign-in" className="text-label-sm text-primary-base hover:underline">Back to sign in</Link>}>
      {data?.sent ? (
        <Alert tone="success" live title="Check your inbox">
          If an account exists for that email, a reset link is on its way. The link expires in one hour.
        </Alert>
      ) : (
        <Form method="post" className="flex flex-col gap-4" noValidate>
          <Field label="Email" name="email" error={data?.error ?? undefined} required>
            {(p) => <Input type="email" autoComplete="email" autoFocus {...p} />}
          </Field>
          <Button type="submit" pending={navigation.state === "submitting"} className="w-full">
            Send reset link
          </Button>
        </Form>
      )}
    </AuthCard>
  );
}
