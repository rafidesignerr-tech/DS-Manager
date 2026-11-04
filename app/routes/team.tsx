import { Form, useActionData, useNavigation } from "react-router";
import { RiMailSendLine, RiTeamLine, RiUserForbidLine, RiUserFollowLine } from "@remixicon/react";
import type { Route } from "./+types/team";
import { Time } from "~/components/ui/time";
import { Card, CardHeader, PageHeader } from "~/components/ui/page";
import { Alert, EmptyState } from "~/components/ui/feedback";
import { Avatar, Badge, StatusBadge } from "~/components/ui/display";
import { Button } from "~/components/ui/button";
import { Field, Input, Select } from "~/components/ui/form";
import { ConfirmDialog } from "~/components/ui/overlay";
import { ROLE_LABELS, type Role } from "~/domain/permissions";
import { formatDay, formatRelative } from "~/lib/format";
import { formString, getDb, getEnv, redirectWithFlash, requirePermission } from "~/server/request.server";
import { changeRole, inviteMember, inviteSchema, listTeam, revokeInvitation, setMemberStatus, TeamError } from "~/server/team.server";

export const meta: Route.MetaFunction = () => [{ title: "Team · D.S Hub" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const actor = requirePermission(context, request, "team.manage");
  return { ...(await listTeam(getDb(context))), actorId: actor.id };
}

export async function action({ request, context }: Route.ActionArgs) {
  const actor = requirePermission(context, request, "team.manage");
  const db = getDb(context);
  const env = getEnv(context);
  const form = await request.formData();
  const intent = formString(form, "intent");
  const ok = (message: string) => redirectWithFlash(env, request, "/team", { tone: "success", message });
  try {
    switch (intent) {
      case "invite": {
        const parsed = inviteSchema.safeParse({ email: formString(form, "email"), role: formString(form, "role") });
        if (!parsed.success) return { intent, error: "Check the highlighted fields.", fieldErrors: { email: parsed.error.issues[0]?.message ?? "" } as Record<string, string> };
        await inviteMember(db, env, new URL(request.url).origin, actor, parsed.data);
        return ok(`Invitation sent to ${parsed.data.email}.`);
      }
      case "revoke":
        await revokeInvitation(db, actor, formString(form, "id"));
        return ok("Invitation revoked.");
      case "role": {
        const role = formString(form, "role");
        if (role !== "manager" && role !== "contributor") return { intent, error: "Choose a role.", fieldErrors: {} as Record<string, string> };
        await changeRole(db, actor, formString(form, "id"), role);
        return ok(`Role changed to ${ROLE_LABELS[role]}.`);
      }
      case "suspend":
        await setMemberStatus(db, actor, formString(form, "id"), "suspended");
        return ok("Member suspended. They've been signed out.");
      case "reactivate":
        await setMemberStatus(db, actor, formString(form, "id"), "active");
        return ok("Member reactivated.");
    }
  } catch (e) {
    if (e instanceof TeamError) return { intent, error: e.message, fieldErrors: {} as Record<string, string> };
    throw e;
  }
  return { intent, error: "Unknown action.", fieldErrors: {} as Record<string, string> };
}

export default function Team({ loaderData }: Route.ComponentProps) {
  const { members, invitations, actorId } = loaderData;
  const data = useActionData<typeof action>();
  const navigation = useNavigation();
  const inviting = navigation.state === "submitting" && navigation.formData?.get("intent") === "invite";
  const errors: Record<string, string> = data?.intent === "invite" ? data.fieldErrors : {};

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={RiTeamLine} title="Team" description="Invite people, set roles and manage access. Managers only." />
      {data?.error && data.intent !== "invite" ? <Alert tone="error" live>{data.error}</Alert> : null}

      <Card>
        <CardHeader title="Invite a team member" description="They'll get an email link to create their account." />
        <Form method="post" className="flex flex-col gap-4 p-4 md:flex-row md:items-start" noValidate>
          <input type="hidden" name="intent" value="invite" />
          <Field label="Email" name="email" error={errors.email ?? (data?.intent === "invite" && !errors.email ? data.error : undefined)} required className="flex-1">
            {(p) => <Input {...p} type="email" autoComplete="off" placeholder="name@company.com" />}
          </Field>
          <Field label="Role" name="role" className="md:w-48">
            {(p) => (
              <Select {...p} defaultValue="contributor">
                <option value="contributor">Contributor</option>
                <option value="manager">Manager</option>
              </Select>
            )}
          </Field>
          <Button type="submit" className="md:mt-6" leadingIcon={RiMailSendLine} pending={inviting}>Send invite</Button>
        </Form>
      </Card>

      <Card>
        <CardHeader title="Members" description={`${members.length} ${members.length === 1 ? "person" : "people"}`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <caption className="sr-only">Team members</caption>
            <thead>
              <tr className="bg-bg-weak-50 text-paragraph-sm text-text-sub-600">
                <th scope="col" className="px-4 py-2 font-normal">Member</th>
                <th scope="col" className="px-4 py-2 font-normal">Role</th>
                <th scope="col" className="px-4 py-2 font-normal">Account</th>
                <th scope="col" className="px-4 py-2 font-normal">Joined</th>
                <th scope="col" className="px-4 py-2 font-normal"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke-soft-200">
              {members.map((m) => {
                const self = m.id === actorId;
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} image={m.image} size={32} />
                        <div>
                          <p className="text-label-sm text-text-strong-950">{m.name} {self ? <span className="text-paragraph-xs text-text-sub-600">(you)</span> : null}</p>
                          <p className="text-paragraph-xs text-text-sub-600">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {self ? (
                        <Badge color="blue">{ROLE_LABELS[m.role]}</Badge>
                      ) : (
                        <Form method="post" className="flex items-center gap-2">
                          <input type="hidden" name="intent" value="role" />
                          <input type="hidden" name="id" value={m.id} />
                          <label htmlFor={`role-${m.id}`} className="sr-only">Role for {m.name}</label>
                          <Select id={`role-${m.id}`} name="role" size="xsmall" defaultValue={m.role} className="w-36" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
                            {(["contributor", "manager"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                          </Select>
                          <noscript><Button type="submit" size="xxsmall" variant="neutral" mode="stroke">Save</Button></noscript>
                        </Form>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {m.status === "active" ? <StatusBadge tone="completed">Active</StatusBadge> : <StatusBadge tone="failed">Suspended</StatusBadge>}
                    </td>
                    <td className="px-4 py-3 text-paragraph-sm text-text-sub-600">{formatDay(new Date(m.createdAt).toISOString().slice(0, 10))}</td>
                    <td className="px-4 py-3 text-right">
                      {self ? null : m.status === "active" ? (
                        <ConfirmDialog
                          title={`Suspend ${m.name}?`}
                          description="They'll be signed out and can't sign in until reactivated. Their work and history stay as they are."
                          trigger={<Button size="xxsmall" variant="neutral" mode="ghost" leadingIcon={RiUserForbidLine}>Suspend</Button>}
                        >
                          <Form method="post">
                            <input type="hidden" name="intent" value="suspend" />
                            <input type="hidden" name="id" value={m.id} />
                            <Button type="submit" size="small" variant="error">Suspend member</Button>
                          </Form>
                        </ConfirmDialog>
                      ) : (
                        <Form method="post">
                          <input type="hidden" name="intent" value="reactivate" />
                          <input type="hidden" name="id" value={m.id} />
                          <Button type="submit" size="xxsmall" variant="neutral" mode="stroke" leadingIcon={RiUserFollowLine}>Reactivate</Button>
                        </Form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Pending invitations" />
        {invitations.length ? (
          <ul className="divide-y divide-stroke-soft-200">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="text-label-sm text-text-strong-950">{i.email}</p>
                  <p className="text-paragraph-xs text-text-sub-600">
                    {ROLE_LABELS[i.role]} · invited by {i.invitedByName ?? "a manager"} <Time value={i.createdAt} format="relative" />
                  </p>
                </div>
                {i.expired ? <StatusBadge tone="failed">Expired</StatusBadge> : <StatusBadge tone="pending">Expires <Time value={i.expiresAt} format="relative" /></StatusBadge>}
                <Form method="post">
                  <input type="hidden" name="intent" value="revoke" />
                  <input type="hidden" name="id" value={i.id} />
                  <Button type="submit" size="xxsmall" variant="neutral" mode="ghost">{i.expired ? "Remove" : "Revoke"}</Button>
                </Form>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState className="py-8" icon={RiMailSendLine} title="No pending invitations" description="Invitations you send appear here until they're accepted." />
        )}
      </Card>
    </div>
  );
}
