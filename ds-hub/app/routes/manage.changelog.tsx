import { Form, Link } from "react-router";
import { RiAddLine, RiArticleLine, RiEditLine, RiEyeLine } from "@remixicon/react";
import type { Route } from "./+types/manage.changelog";
import { Card, PageHeader, Pagination } from "~/components/ui/page";
import { EmptyState } from "~/components/ui/feedback";
import { StatusBadge } from "~/components/ui/display";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/overlay";
import { can } from "~/domain/permissions";
import { formatDay } from "~/lib/format";
import { formString, getDb, getEnv, redirectWithFlash, requirePermission } from "~/server/request.server";
import { deleteChangelogDraft, listChangelog, setChangelogPublished } from "~/server/changelog.server";

export const meta: Route.MetaFunction = () => [{ title: "Changelog entries · D.S Hub" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const actor = requirePermission(context, request, "changelog.viewDrafts");
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
  const result = await listChangelog(getDb(context), actor, { page, includeDrafts: true });
  return { ...result, page, canDraft: can(actor, "changelog.draft"), canPublish: can(actor, "changelog.publish") };
}

export async function action({ request, context }: Route.ActionArgs) {
  const actor = requirePermission(context, request, "changelog.publish");
  const form = await request.formData();
  const intent = formString(form, "intent");
  const id = formString(form, "id");
  const db = getDb(context);
  const env = getEnv(context);
  if (intent === "publish" || intent === "unpublish") {
    await setChangelogPublished(db, actor, id, intent === "publish");
    return redirectWithFlash(env, request, "/manage/changelog", { tone: "success", message: intent === "publish" ? "Published. It's now on the public changelog." : "Moved back to draft." });
  }
  if (intent === "delete") {
    await deleteChangelogDraft(db, actor, id);
    return redirectWithFlash(env, request, "/manage/changelog", { tone: "success", message: "Draft deleted." });
  }
  return redirectWithFlash(env, request, "/manage/changelog", { tone: "error", message: "Unknown action." });
}

export default function ManageChangelog({ loaderData }: Route.ComponentProps) {
  const { items, total, pageSize, page, canDraft, canPublish } = loaderData;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={RiArticleLine}
        title="Changelog entries"
        description="Drafts are private to the team. Published entries appear on the public changelog."
        actions={canDraft ? <Button asChild size="small" leadingIcon={RiAddLine}><Link to="/manage/changelog/new">New entry</Link></Button> : null}
      />
      {items.length ? (
        <>
          <Card>
            <ul className="divide-y divide-stroke-soft-200">
              {items.map((e) => (
                <li key={e.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {e.status === "published" ? <StatusBadge tone="completed">Published</StatusBadge> : <StatusBadge tone="pending">Draft</StatusBadge>}
                      <time dateTime={e.entryDate} className="text-paragraph-xs text-text-sub-600">{formatDay(e.entryDate)}</time>
                    </div>
                    <p className="mt-1 text-label-sm text-text-strong-950">{e.title}</p>
                    <p className="line-clamp-1 text-paragraph-xs text-text-sub-600">{e.summary}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="xxsmall" variant="neutral" mode="ghost" leadingIcon={RiEyeLine}><Link to={`/changelog/${e.id}`}>View</Link></Button>
                    {canDraft ? <Button asChild size="xxsmall" variant="neutral" mode="ghost" leadingIcon={RiEditLine}><Link to={`/manage/changelog/${e.id}/edit`}>Edit</Link></Button> : null}
                    {canPublish && e.status === "draft" ? (
                      <>
                        <ConfirmDialog title="Delete this draft?" description="The draft is removed permanently. Published entries can't be deleted." trigger={<Button size="xxsmall" variant="error" mode="ghost">Delete</Button>}>
                          <Form method="post">
                            <input type="hidden" name="intent" value="delete" />
                            <input type="hidden" name="id" value={e.id} />
                            <Button type="submit" size="small" variant="error">Delete draft</Button>
                          </Form>
                        </ConfirmDialog>
                        <ConfirmDialog title="Publish this entry?" description="It becomes visible to everyone on the public changelog, and the team is notified." trigger={<Button size="xxsmall">Publish</Button>}>
                          <Form method="post">
                            <input type="hidden" name="intent" value="publish" />
                            <input type="hidden" name="id" value={e.id} />
                            <Button type="submit" size="small">Publish</Button>
                          </Form>
                        </ConfirmDialog>
                      </>
                    ) : null}
                    {canPublish && e.status === "published" ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="unpublish" />
                        <input type="hidden" name="id" value={e.id} />
                        <Button type="submit" size="xxsmall" variant="neutral" mode="stroke">Unpublish</Button>
                      </Form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Pagination page={page} total={total} pageSize={pageSize} label="Changelog entry pages" />
        </>
      ) : (
        <EmptyState icon={RiArticleLine} title="No entries yet" description="Write a draft, then publish it when it's ready." action={canDraft ? <Button asChild size="small" leadingIcon={RiAddLine}><Link to="/manage/changelog/new">New entry</Link></Button> : undefined} />
      )}
    </div>
  );
}
