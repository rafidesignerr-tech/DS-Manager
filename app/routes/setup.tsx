import { Form, redirect, useActionData, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/setup";
import { AuthCard } from "~/components/layout/auth-card";
import { Button } from "~/components/ui/button";
import { Alert } from "~/components/ui/feedback";
import { Field, Input } from "~/components/ui/form";
import { formString, getDb, getEnv, notFound } from "~/server/request.server";
import { createFirstManager, memberCount, passwordSchema, TeamError } from "~/server/team.server";

export const meta: Route.MetaFunction = () => [{ title: "First-time setup · D.S Hub" }, { name: "robots", content: "noindex" }];

/** Exists only until the first account is created. */
export async function loader({ context }: Route.LoaderArgs) {
  if ((await memberCount(getDb(context))) > 0) throw notFound();
  return null;
}

const formSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: z.email("Enter a valid email address.").transform((v) => v.toLowerCase()),
  password: passwordSchema,
});

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  if (formString(form, "password") !== formString(form, "confirm")) return { error: null, fieldErrors: { confirm: "Passwords don't match." } as Record<string, string> };
  const parsed = formSchema.safeParse({ name: formString(form, "name"), email: formString(form, "email").trim(), password: formString(form, "password") });
  if (!parsed.success) return { error: null, fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) as Record<string, string> };
  try {
    const headers = await createFirstManager(getDb(context), getEnv(context), request, parsed.data);
    return redirect("/team", { headers });
  } catch (e) {
    return { error: e instanceof TeamError ? e.message : "Setup failed. Try again.", fieldErrors: {} as Record<string, string> };
  }
}

export default function Setup() {
  const data = useActionData<typeof action>();
  const navigation = useNavigation();
  const errors: Record<string, string> = data?.fieldErrors ?? {};
  return (
    <AuthCard title="Set up the first manager" description="This page disappears once the first account exists. Invite everyone else from Team.">
      <Form method="post" className="flex flex-col gap-4" noValidate>
        {data?.error ? <Alert tone="error" live>{data.error}</Alert> : null}
        <Field label="Full name" name="name" error={errors.name} required>
          {(p) => <Input autoComplete="name" autoFocus {...p} />}
        </Field>
        <Field label="Email" name="email" error={errors.email} required>
          {(p) => <Input type="email" autoComplete="email" {...p} />}
        </Field>
        <Field label="Password" name="password" error={errors.password} hint="At least 10 characters." required>
          {(p) => <Input type="password" autoComplete="new-password" {...p} />}
        </Field>
        <Field label="Confirm password" name="confirm" error={errors.confirm} required>
          {(p) => <Input type="password" autoComplete="new-password" {...p} />}
        </Field>
        <Button type="submit" pending={navigation.state === "submitting"} className="w-full">
          Create manager account
        </Button>
      </Form>
    </AuthCard>
  );
}
