import { and, asc, count, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { POLICY } from "~/config/hub";
import { can, type Actor, type Role } from "~/domain/permissions";
import type { Database } from "./db";
import { schema } from "./db";
import { createAuth } from "./auth.server";
import { sendEmail } from "./email.server";
import { managerIds, notificationInserts } from "./notifications.server";

const { user, invitation, session, activityEvent } = schema;

export class TeamError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409 | 410,
    message: string,
  ) {
    super(message);
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.");

export const inviteSchema = z.object({
  email: z.email("Enter a valid email address.").transform((v) => v.trim().toLowerCase()),
  role: z.enum(["manager", "contributor"]),
});

export async function memberCount(db: Database): Promise<number> {
  const [row] = await db.select({ n: count() }).from(user);
  return row?.n ?? 0;
}

export async function listTeam(db: Database) {
  const [members, invites] = await Promise.all([
    db
      .select({ id: user.id, name: user.name, email: user.email, image: user.image, role: user.role, status: user.status, createdAt: user.createdAt })
      .from(user)
      .orderBy(asc(user.name)),
    db
      .select({ id: invitation.id, email: invitation.email, role: invitation.role, status: invitation.status, expiresAt: invitation.expiresAt, createdAt: invitation.createdAt, invitedByName: user.name })
      .from(invitation)
      .leftJoin(user, eq(user.id, invitation.invitedById))
      .where(eq(invitation.status, "pending"))
      .orderBy(desc(invitation.createdAt)),
  ]);
  const now = Date.now();
  return {
    members,
    invitations: invites.map((i) => ({ ...i, expired: i.expiresAt.getTime() < now })),
  };
}

export async function inviteMember(db: Database, env: Env, origin: string, actor: Actor, input: z.infer<typeof inviteSchema>) {
  if (!can(actor, "team.manage")) throw new TeamError(403, "Only managers can invite people.");
  const existing = await db.query.user.findFirst({ where: eq(user.email, input.email) });
  if (existing) throw new TeamError(409, "This person already has an account.");
  const token = newToken();
  const expiresAt = new Date(Date.now() + POLICY.invitationExpiryDays * 86_400_000);
  await db.batch([
    // Any earlier pending invite for the same email stops working.
    db.update(invitation).set({ status: "revoked" }).where(and(eq(invitation.email, input.email), eq(invitation.status, "pending"))),
    db.insert(invitation).values({ email: input.email, role: input.role, tokenHash: await sha256(token), invitedById: actor.id, expiresAt }),
  ]);
  await sendEmail(env, {
    to: input.email,
    subject: `You're invited to ${env.APP_NAME}`,
    text: `${actor.name} invited you to join ${env.APP_NAME}.\n\nAccept the invitation and choose a password:\n${origin}/invite/${token}\n\nThis link expires in ${POLICY.invitationExpiryDays} days.`,
  });
}

export async function revokeInvitation(db: Database, actor: Actor, id: string) {
  if (!can(actor, "team.manage")) throw new TeamError(403, "Only managers can revoke invitations.");
  await db.update(invitation).set({ status: "revoked" }).where(and(eq(invitation.id, id), eq(invitation.status, "pending")));
}

export async function findInvitation(db: Database, token: string) {
  const row = await db.query.invitation.findFirst({ where: eq(invitation.tokenHash, await sha256(token)) });
  if (!row) return { state: "invalid" as const };
  if (row.status !== "pending") return { state: row.status === "accepted" ? ("used" as const) : ("invalid" as const) };
  if (row.expiresAt.getTime() < Date.now()) return { state: "expired" as const };
  return { state: "valid" as const, invitation: row };
}

async function activeManagerCount(db: Database) {
  const [row] = await db.select({ n: count() }).from(user).where(and(eq(user.role, "manager"), eq(user.status, "active")));
  return row?.n ?? 0;
}

export async function changeRole(db: Database, actor: Actor, memberId: string, role: Role) {
  if (!can(actor, "team.manage")) throw new TeamError(403, "Only managers can change roles.");
  if (memberId === actor.id) throw new TeamError(400, "You can't change your own role.");
  const member = await db.query.user.findFirst({ where: eq(user.id, memberId) });
  if (!member) throw new TeamError(404, "This member no longer exists.");
  if (member.role === role) return;
  if (member.role === "manager" && (await activeManagerCount(db)) <= 1) throw new TeamError(409, "The team needs at least one manager.");
  await db.batch([
    db.update(user).set({ role }).where(eq(user.id, memberId)),
    db.insert(activityEvent).values({ actorId: actor.id, targetType: "member", targetId: memberId, action: "changed", field: "role", fromValue: member.role, toValue: role }),
  ]);
}

/** Suspension blocks sign-in and ends active sessions; it is reversible. */
export async function setMemberStatus(db: Database, actor: Actor, memberId: string, status: "active" | "suspended") {
  if (!can(actor, "team.manage")) throw new TeamError(403, "Only managers can change member access.");
  if (memberId === actor.id) throw new TeamError(400, "You can't suspend yourself.");
  const member = await db.query.user.findFirst({ where: eq(user.id, memberId) });
  if (!member) throw new TeamError(404, "This member no longer exists.");
  if (member.status === status) return;
  if (status === "suspended" && member.role === "manager" && (await activeManagerCount(db)) <= 1) {
    throw new TeamError(409, "The team needs at least one active manager.");
  }
  await db.batch([
    db.update(user).set({ status }).where(eq(user.id, memberId)),
    ...(status === "suspended" ? [db.delete(session).where(eq(session.userId, memberId))] : []),
    db.insert(activityEvent).values({ actorId: actor.id, targetType: "member", targetId: memberId, action: "changed", field: "status", fromValue: member.status, toValue: status }),
  ]);
}

/**
 * Creates the account behind an invitation. Better Auth hashes the password;
 * the role comes from the invitation, never from the form.
 */
export async function acceptInvitation(
  db: Database,
  env: Env,
  request: Request,
  token: string,
  input: { name: string; password: string },
) {
  const found = await findInvitation(db, token);
  if (found.state !== "valid") throw new TeamError(410, "This invitation is no longer valid.");
  const inv = found.invitation;
  const existing = await db.query.user.findFirst({ where: eq(user.email, inv.email) });
  if (existing) throw new TeamError(409, "An account with this email already exists. Sign in instead.");

  const auth = createAuth(env, request);
  const result = await auth.api.signUpEmail({
    body: { name: input.name, email: inv.email, password: input.password },
    headers: request.headers,
    returnHeaders: true,
  });
  const userId = result.response.user.id;
  const managers = await managerIds(db, userId);
  const claimed = await db
    .update(invitation)
    .set({ status: "accepted", acceptedUserId: userId })
    .where(and(eq(invitation.id, inv.id), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date())))
    .returning({ id: invitation.id });
  if (!claimed.length) {
    await db.delete(user).where(eq(user.id, userId));
    throw new TeamError(410, "This invitation is no longer valid.");
  }
  const statements = [
    db.update(user).set({ role: inv.role, emailVerified: true }).where(eq(user.id, userId)),
    ...notificationInserts(
      db,
      managers.map((recipientId) => ({ recipientId, event: "invitation_accepted" as const, targetType: "member" as const, targetId: userId, title: `${input.name} joined the team` })),
      userId,
    ),
  ];
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
  return result.headers;
}

/** One-time setup: only works while the database has no users at all. */
export async function createFirstManager(
  db: Database,
  env: Env,
  request: Request,
  input: { name: string; email: string; password: string },
) {
  if ((await memberCount(db)) > 0) throw new TeamError(410, "Setup is already complete.");
  const auth = createAuth(env, request);
  const result = await auth.api.signUpEmail({
    body: { name: input.name, email: input.email, password: input.password },
    headers: request.headers,
    returnHeaders: true,
  });
  await db.update(user).set({ role: "manager", emailVerified: true }).where(eq(user.id, result.response.user.id));
  return result.headers;
}
