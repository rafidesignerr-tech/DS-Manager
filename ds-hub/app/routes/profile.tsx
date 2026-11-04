import { Form, useActionData, useNavigation } from "react-router";
import { eq } from "drizzle-orm";
import { RiImageAddLine, RiLockPasswordLine, RiLogoutBoxRLine, RiUser3Line } from "@remixicon/react";
import type { Route } from "./+types/profile";
import { Card, CardHeader, PageHeader } from "~/components/ui/page";
import { Alert } from "~/components/ui/feedback";
import { Avatar, Badge } from "~/components/ui/display";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/form";
import { POLICY } from "~/config/hub";
import { ROLE_LABELS } from "~/domain/permissions";
import { createAuth } from "~/server/auth.server";
import { schema } from "~/server/db";
import { formString, getDb, getEnv, redirectWithFlash, requirePermission } from "~/server/request.server";

export const meta: Route.MetaFunction = () => [{ title: "Profile · D.S Hub" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const actor = requirePermission(context, request, "profile.edit");
  const user = await getDb(context).query.user.findFirst({ where: eq(schema.user.id, actor.id) });
  if (!user) throw new Response("Not found", { status: 404 });
  return { user: { name: user.name, email: user.email, image: user.image, role: user.role, title: user.title, createdAt: user.createdAt } };
}

/** Detects the real image type from the file's first bytes; the browser-provided type is not trusted. */
function sniffImage(bytes: Uint8Array): { ext: "png" | "jpg" | "webp"; type: string } | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: "png", type: "image/png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const actor = requirePermission(context, request, "profile.edit");
  const env = getEnv(context);
  const db = getDb(context);
  const form = await request.formData();
  const intent = formString(form, "intent");

  if (intent === "profile") {
    const name = formString(form, "name").trim();
    const title = formString(form, "title").trim();
    const fieldErrors: Record<string, string> = {};
    if (!name) fieldErrors.name = "Enter your name.";
    if (name.length > 80) fieldErrors.name = "Keep your name under 80 characters.";
    if (title.length > 80) fieldErrors.title = "Keep the title under 80 characters.";
    if (Object.keys(fieldErrors).length) return { intent, error: "Check the highlighted fields.", fieldErrors };
    await db.update(schema.user).set({ name, title: title || null }).where(eq(schema.user.id, actor.id));
    return redirectWithFlash(env, request, "/profile", { tone: "success", message: "Profile saved." });
  }

  if (intent === "avatar") {
    const file = form.get("avatar");
    if (!(file instanceof File) || file.size === 0) return { intent, error: "Choose an image to upload.", fieldErrors: {} as Record<string, string> };
    if (file.size > POLICY.avatarMaxBytes) return { intent, error: "The image must be 2 MB or smaller.", fieldErrors: {} as Record<string, string> };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) return { intent, error: "Use a PNG, JPG or WebP image.", fieldErrors: {} as Record<string, string> };
    const key = `${crypto.randomUUID()}.${kind.ext}`;
    await env.MEDIA.put(`avatars/${key}`, bytes, { httpMetadata: { contentType: kind.type } });
    const previous = await db.query.user.findFirst({ where: eq(schema.user.id, actor.id), columns: { image: true } });
    await db.update(schema.user).set({ image: `/media/avatars/${key}` }).where(eq(schema.user.id, actor.id));
    if (previous?.image?.startsWith("/media/avatars/")) await env.MEDIA.delete(`avatars/${previous.image.split("/").pop()}`);
    return redirectWithFlash(env, request, "/profile", { tone: "success", message: "Profile image updated." });
  }

  if (intent === "remove_avatar") {
    const previous = await db.query.user.findFirst({ where: eq(schema.user.id, actor.id), columns: { image: true } });
    await db.update(schema.user).set({ image: null }).where(eq(schema.user.id, actor.id));
    if (previous?.image?.startsWith("/media/avatars/")) await env.MEDIA.delete(`avatars/${previous.image.split("/").pop()}`);
    return redirectWithFlash(env, request, "/profile", { tone: "success", message: "Profile image removed." });
  }

  if (intent === "reset_password") {
    const origin = new URL(request.url).origin;
    await createAuth(env, request)
      .api.requestPasswordReset({ body: { email: actor.email, redirectTo: `${origin}/reset-password` }, headers: request.headers })
      .catch(() => null);
    return redirectWithFlash(env, request, "/profile", { tone: "success", message: `A reset link was sent to ${actor.email}.` });
  }

  return { intent, error: "Unknown action.", fieldErrors: {} as Record<string, string> };
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const data = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = (intent: string) => navigation.state === "submitting" && navigation.formData?.get("intent") === intent;
  const errors: Record<string, string> = data?.intent === "profile" ? data.fieldErrors : {};

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader icon={RiUser3Line} title="Profile" description="How you appear to your team." />
      {data?.error ? <Alert tone="error" live>{data.error}</Alert> : null}

      <Card>
        <CardHeader title="Profile image" description="PNG, JPG or WebP, up to 2 MB." />
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <Avatar name={user.name} image={user.image} size={80} />
          <Form method="post" encType="multipart/form-data" className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="intent" value="avatar" />
            <div className="flex-1 space-y-1">
              <label htmlFor="avatar" className="text-label-sm text-text-strong-950">Upload a new image</label>
              <input
                id="avatar"
                name="avatar"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="block w-full text-paragraph-sm text-text-sub-600 file:mr-3 file:h-9 file:rounded-lg file:border-0 file:bg-bg-weak-50 file:px-3 file:text-label-sm file:text-text-strong-950 hover:file:bg-bg-soft-200"
              />
            </div>
            <Button type="submit" size="small" leadingIcon={RiImageAddLine} pending={busy("avatar")}>Upload</Button>
          </Form>
          {user.image ? (
            <Form method="post">
              <input type="hidden" name="intent" value="remove_avatar" />
              <Button type="submit" size="small" variant="neutral" mode="ghost">Remove</Button>
            </Form>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Details" />
        <Form method="post" className="flex flex-col gap-4 p-4" noValidate>
          <input type="hidden" name="intent" value="profile" />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name" name="name" error={errors.name} required>
              {(p) => <Input {...p} defaultValue={user.name} autoComplete="name" maxLength={80} />}
            </Field>
            <Field label="Job title" name="title" error={errors.title} optional>
              {(p) => <Input {...p} defaultValue={user.title ?? ""} maxLength={80} />}
            </Field>
            <Field label="Email" name="email" hint="Ask a manager if your email needs to change.">
              {(p) => <Input {...p} value={user.email} readOnly disabled />}
            </Field>
            <div className="flex flex-col gap-1">
              <span className="text-label-sm text-text-strong-950">Role</span>
              <div className="flex h-10 items-center"><Badge color="blue">{ROLE_LABELS[user.role]}</Badge></div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="small" pending={busy("profile")}>Save profile</Button>
          </div>
        </Form>
      </Card>

      <Card>
        <CardHeader title="Security" />
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-paragraph-sm text-text-sub-600">Change your password through a secure link sent to your email. Other sessions are signed out after the change.</p>
          <Form method="post">
            <input type="hidden" name="intent" value="reset_password" />
            <Button type="submit" size="small" variant="neutral" mode="stroke" leadingIcon={RiLockPasswordLine} pending={busy("reset_password")}>Send reset link</Button>
          </Form>
          <Form method="post" action="/sign-out">
            <Button type="submit" size="small" variant="error" mode="lighter" leadingIcon={RiLogoutBoxRLine}>Sign out</Button>
          </Form>
        </div>
      </Card>
    </div>
  );
}
