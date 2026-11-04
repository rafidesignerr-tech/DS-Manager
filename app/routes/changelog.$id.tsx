import { Link } from "react-router";
import { RiArrowLeftLine, RiEditLine, RiLinksLine } from "@remixicon/react";
import type { Route } from "./+types/changelog.$id";
import { Card, CardHeader } from "~/components/ui/page";
import { Badge, SampleBadge } from "~/components/ui/display";
import { Alert } from "~/components/ui/feedback";
import { Button } from "~/components/ui/button";
import { referenceHref } from "~/components/reference-detail";
import { can } from "~/domain/permissions";
import { formatDay } from "~/lib/format";
import { getActor, getDb, notFound } from "~/server/request.server";
import { getChangelogEntry } from "~/server/changelog.server";

export const meta: Route.MetaFunction = ({ loaderData }) => [{ title: `${loaderData?.entry.title ?? "Changelog"} · D.S Hub` }];

export async function loader({ params, context }: Route.LoaderArgs) {
  const actor = getActor(context);
  const found = await getChangelogEntry(getDb(context), actor, params.id);
  // Drafts return 404 for anyone without draft access, so their existence isn't revealed.
  if (!found) throw notFound("This changelog entry doesn't exist.");
  return { ...found, canEdit: can(actor, "changelog.draft") };
}

export default function ChangelogEntry({ loaderData }: Route.ComponentProps) {
  const { entry, related, canEdit, authorName } = loaderData;
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link to="/changelog" className="inline-flex w-fit items-center gap-1.5 text-label-sm text-text-sub-600 hover:text-text-strong-950">
        <RiArrowLeftLine className="size-4" aria-hidden /> Back to changelog
      </Link>
      {entry.status === "draft" ? <Alert tone="warning" title="Draft">Only team members can see this entry until it's published.</Alert> : null}
      <header className="space-y-3 border-b border-stroke-soft-200 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <time dateTime={entry.entryDate} className="text-paragraph-sm text-text-sub-600">{formatDay(entry.entryDate)}</time>
          {entry.status === "draft" ? <Badge color="orange">Draft</Badge> : null}
          {entry.isSample ? <SampleBadge /> : null}
        </div>
        <h1 className="text-title-h4 text-text-strong-950">{entry.title}</h1>
        <p className="text-paragraph-lg text-text-sub-600">{entry.summary}</p>
        {canEdit ? (
          <Button asChild variant="neutral" mode="stroke" size="small" leadingIcon={RiEditLine}>
            <Link to={`/manage/changelog/${entry.id}/edit`}>Edit entry</Link>
          </Button>
        ) : null}
      </header>
      {entry.details ? <div className="whitespace-pre-line text-paragraph-md text-text-strong-950">{entry.details}</div> : null}
      {related.length ? (
        <Card>
          <CardHeader title="Related items" />
          <ul className="divide-y divide-stroke-soft-200">
            {related.map((r) => (
              <li key={r.id}>
                <Link to={referenceHref(r.kind, r.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-bg-weak-50">
                  <RiLinksLine className="size-5 text-text-soft-400" aria-hidden />
                  <span className="flex-1 text-label-sm text-text-strong-950">{r.title}</span>
                  <Badge color="gray">{r.kind}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {canEdit && authorName ? <p className="text-paragraph-xs text-text-sub-600">Written by {authorName}</p> : null}
    </article>
  );
}
