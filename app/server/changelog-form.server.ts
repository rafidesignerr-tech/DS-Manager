import { changelogSchema } from "./changelog.server";
import { formString } from "./request.server";

export function parseChangelogForm(form: FormData) {
  const parsed = changelogSchema.safeParse({
    title: formString(form, "title"),
    summary: formString(form, "summary"),
    details: formString(form, "details"),
    entryDate: formString(form, "entryDate"),
    relatedItemIds: form.getAll("relatedItemIds").filter((v): v is string => typeof v === "string"),
  });
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
  return { ok: false as const, fieldErrors };
}
