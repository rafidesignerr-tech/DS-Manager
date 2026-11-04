import { useActionData } from "react-router";
import type { Route } from "./+types/manage.changelog.new";
import { PageHeader } from "~/components/ui/page";
import { ChangelogForm } from "~/components/changelog-form";
import { getDb, getEnv, redirectWithFlash, requirePermission } from "~/server/request.server";
import { saveChangelogDraft } from "~/server/changelog.server";
import { parseChangelogForm } from "~/server/changelog-form.server";
import { referencePickerOptions } from "~/server/reference.server";

export const meta: Route.MetaFunction = () => [{ title: "New changelog entry · D.S Hub" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  requirePermission(context, request, "changelog.draft");
  return { references: await referencePickerOptions(getDb(context)), today: new Date().toISOString().slice(0, 10) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const actor = requirePermission(context, request, "changelog.draft");
  const parsed = parseChangelogForm(await request.formData());
  if (!parsed.ok) return { error: "Check the highlighted fields.", fieldErrors: parsed.fieldErrors };
  await saveChangelogDraft(getDb(context), actor, parsed.data);
  return redirectWithFlash(getEnv(context), request, "/manage/changelog", { tone: "success", message: "Draft saved. Publish it when it's ready." });
}

export default function NewChangelog({ loaderData }: Route.ComponentProps) {
  const data = useActionData<typeof action>();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="New changelog entry" description="Saved as a private draft." />
      <ChangelogForm
        defaults={{ title: "", summary: "", details: "", entryDate: loaderData.today, relatedItemIds: [] }}
        references={loaderData.references}
        error={data?.error}
        fieldErrors={data?.fieldErrors}
        submitLabel="Save draft"
        cancelTo="/manage/changelog"
      />
    </div>
  );
}
