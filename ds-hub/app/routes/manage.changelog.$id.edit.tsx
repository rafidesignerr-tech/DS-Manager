import { useActionData } from "react-router";
import type { Route } from "./+types/manage.changelog.$id.edit";
import { PageHeader } from "~/components/ui/page";
import { Alert } from "~/components/ui/feedback";
import { ChangelogForm } from "~/components/changelog-form";
import { getDb, getEnv, notFound, redirectWithFlash, requirePermission } from "~/server/request.server";
import { getChangelogEntry, saveChangelogDraft } from "~/server/changelog.server";
import { parseChangelogForm } from "~/server/changelog-form.server";
import { referencePickerOptions } from "~/server/reference.server";

export const meta: Route.MetaFunction = () => [{ title: "Edit changelog entry · D.S Hub" }];

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const actor = requirePermission(context, request, "changelog.draft");
  const db = getDb(context);
  const found = await getChangelogEntry(db, actor, params.id);
  if (!found) throw notFound("This entry doesn't exist.");
  return { ...found, references: await referencePickerOptions(db) };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const actor = requirePermission(context, request, "changelog.draft");
  const parsed = parseChangelogForm(await request.formData());
  if (!parsed.ok) return { error: "Check the highlighted fields.", fieldErrors: parsed.fieldErrors };
  await saveChangelogDraft(getDb(context), actor, parsed.data, params.id);
  return redirectWithFlash(getEnv(context), request, "/manage/changelog", { tone: "success", message: "Entry saved." });
}

export default function EditChangelog({ loaderData }: Route.ComponentProps) {
  const data = useActionData<typeof action>();
  const { entry, related, references } = loaderData;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Edit changelog entry" />
      {entry.status === "published" ? <Alert tone="warning">This entry is published. Changes appear publicly as soon as you save.</Alert> : null}
      <ChangelogForm
        defaults={{ title: entry.title, summary: entry.summary, details: entry.details, entryDate: entry.entryDate, relatedItemIds: related.map((r) => r.id) }}
        references={references}
        error={data?.error}
        fieldErrors={data?.fieldErrors}
        submitLabel="Save changes"
        cancelTo="/manage/changelog"
      />
    </div>
  );
}
