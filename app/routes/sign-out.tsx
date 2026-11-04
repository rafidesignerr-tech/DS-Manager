import { redirect } from "react-router";
import type { Route } from "./+types/sign-out";
import { createAuth } from "~/server/auth.server";
import { getEnv } from "~/server/request.server";

export async function action({ request, context }: Route.ActionArgs) {
  const auth = createAuth(getEnv(context), request);
  const result = await auth.api.signOut({ headers: request.headers, returnHeaders: true }).catch(() => null);
  return redirect("/", { headers: result?.headers });
}

export function loader() {
  return redirect("/");
}
