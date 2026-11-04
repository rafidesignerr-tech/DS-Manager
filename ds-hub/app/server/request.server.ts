import { createCookieSessionStorage, data, redirect, type RouterContextProvider } from "react-router";
import { eq } from "drizzle-orm";
import { assertCan, AuthorizationError, type Actor, type Permission } from "~/domain/permissions";
import { actorContext, cloudflareContext } from "./context";
import { createAuth } from "./auth.server";
import { createDb, schema } from "./db";

export function getEnv(context: Readonly<RouterContextProvider>): Env {
  return context.get(cloudflareContext).env;
}

export function getDb(context: Readonly<RouterContextProvider>) {
  return createDb(getEnv(context).DB);
}

export function getActor(context: Readonly<RouterContextProvider>): Actor | null {
  return context.get(actorContext);
}

/** Resolves the session cookie to an active user. Suspended users are treated as signed out. */
export async function loadActor(env: Env, request: Request): Promise<Actor | null> {
  const auth = createAuth(env, request);
  const result = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!result) return null;
  const db = createDb(env.DB);
  const row = await db.query.user.findFirst({ where: eq(schema.user.id, result.user.id) });
  if (!row || row.status !== "active") return null;
  return { id: row.id, role: row.role, name: row.name, email: row.email };
}

/**
 * Server-side authorization for loaders and actions. Visitors are sent to sign in;
 * signed-in users without the permission get a 403 response.
 */
export function requirePermission(
  context: Readonly<RouterContextProvider>,
  request: Request,
  permission: Permission,
): Actor {
  const actor = getActor(context);
  try {
    assertCan(actor, permission);
    return actor;
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      const url = new URL(request.url);
      throw redirect(`/sign-in?next=${encodeURIComponent(url.pathname + url.search)}`);
    }
    throw forbidden();
  }
}

export function forbidden(message = "You don't have access to this page or action.") {
  return data({ message }, { status: 403 });
}

export function notFound(message = "We couldn't find that page.") {
  return data({ message }, { status: 404 });
}

/* ------------------------------ flash ------------------------------ */

export type FlashTone = "success" | "error" | "information";
export interface Flash {
  tone: FlashTone;
  message: string;
}

function flashStorage(env: Env) {
  return createCookieSessionStorage<Record<string, never>, { flash: Flash }>({
    cookie: {
      name: "__hub_flash",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secrets: [env.BETTER_AUTH_SECRET],
      secure: env.PUBLIC_BASE_URL.startsWith("https://"),
    },
  });
}

/** Redirects and shows a one-time confirmation message on the next page. */
export async function redirectWithFlash(env: Env, request: Request, to: string, flash: Flash, init?: ResponseInit) {
  const storage = flashStorage(env);
  const session = await storage.getSession(request.headers.get("Cookie"));
  session.flash("flash", flash);
  const headers = new Headers(init?.headers);
  headers.append("Set-Cookie", await storage.commitSession(session));
  return redirect(to, { ...init, headers });
}

export async function readFlash(env: Env, request: Request): Promise<{ flash: Flash | null; setCookie: string }> {
  const storage = flashStorage(env);
  const session = await storage.getSession(request.headers.get("Cookie"));
  const flash = session.get("flash") ?? null;
  return { flash, setCookie: await storage.commitSession(session) };
}

/* ------------------------------ forms ------------------------------ */

export function formString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
export function safeRedirectPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
