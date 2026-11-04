import { data } from "react-router";
import type { Route } from "./+types/foundations.track";
import { formString, getDb, requirePermission } from "~/server/request.server";
import { TrackingError, trackingUpdateSchema, updateTracking } from "~/server/foundations.server";

/** Saves tracking fields for one token. Only fields present in the form are changed. */
export async function action({ request, context }: Route.ActionArgs) {
  const actor = requirePermission(context, request, "foundation.track");
  const form = await request.formData();
  const pick = (k: string) => (form.has(k) ? formString(form, k) : undefined);
  const parsed = trackingUpdateSchema.safeParse({
    designStatus: pick("designStatus"),
    webStatus: pick("webStatus"),
    mobileStatus: pick("mobileStatus"),
    assigneeId: pick("assigneeId"),
    notes: pick("notes"),
    docsUrl: pick("docsUrl"),
  });
  if (!parsed.success) return data({ ok: false, error: parsed.error.issues[0]?.message ?? "Check the values." }, { status: 400 });
  try {
    await updateTracking(getDb(context), actor, formString(form, "tokenId"), parsed.data);
    return { ok: true, error: null };
  } catch (e) {
    if (e instanceof TrackingError) return data({ ok: false, error: e.message }, { status: e.status });
    throw e;
  }
}

export function loader() {
  return new Response("Not found", { status: 404 });
}
