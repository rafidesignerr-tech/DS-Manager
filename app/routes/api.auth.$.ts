import type { Route } from "./+types/api.auth.$";
import { createAuth } from "~/server/auth.server";
import { getEnv } from "~/server/request.server";

/** Accounts only come from invitations or first-run setup, so public sign-up is closed here. */
const BLOCKED = [/\/api\/auth\/sign-up\b/, /\/api\/auth\/update-user\b/, /\/api\/auth\/change-email\b/];

function handle(request: Request, env: Env) {
  const { pathname } = new URL(request.url);
  if (BLOCKED.some((re) => re.test(pathname))) return new Response("Not found", { status: 404 });
  return createAuth(env, request).handler(request);
}

export async function loader({ request, context }: Route.LoaderArgs) {
  return handle(request, getEnv(context));
}

export async function action({ request, context }: Route.ActionArgs) {
  return handle(request, getEnv(context));
}
