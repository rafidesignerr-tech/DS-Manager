import type { Route } from "./+types/media.avatars.$key";
import { getActor, getEnv } from "~/server/request.server";

/** Profile images are visible to signed-in team members only. */
export async function loader({ params, context }: Route.LoaderArgs) {
  if (!getActor(context)) return new Response("Not found", { status: 404 });
  if (!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(params.key)) return new Response("Not found", { status: 404 });
  const object = await getEnv(context).MEDIA.get(`avatars/${params.key}`);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
