import { Link } from "react-router";
import { RiArrowRightSLine, RiHistoryLine } from "@remixicon/react";
import type { Route } from "./+types/changelog";
import { PageHeader, Pagination } from "~/components/ui/page";
import { EmptyState } from "~/components/ui/feedback";
import { Badge, SampleBadge } from "~/components/ui/display";
import { Button } from "~/components/ui/button";
import { can } from "~/domain/permissions";
import { formatDay } from "~/lib/format";
import { getActor, getDb } from "~/server/request.server";
import { listChangelog } from "~/server/changelog.server";

export const meta: Route.MetaFunction = () => [{ title: "Changelog · D.S Hub" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const actor = getActor(context);
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
  const result = await listChangelog(getDb(context), actor, { page, includeDrafts: false });
  return { ...result, page, canManage: can(actor, "changelog.viewDrafts") };
}

export default function Changelog({ loaderData }: Route.ComponentProps) {
  const { items, total, pageSize, page, canManage } = loaderData;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={RiHistoryLine}
        title="Changelog"
        description="What changed in the system, newest first."
        actions={
          canManage ? (
            <Button asChild variant="neutral" mode="stroke" size="small">
              <Link to="/manage/changelog">Manage entries</Link>
            </Button>
          ) : null
        }
      />
      {items.length ? (
        <>
          <ol className="relative flex flex-col gap-4 border-l border-stroke-soft-200 pl-6">
            {items.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[29px] top-5 size-2.5 rounded-full bg-primary-base ring-4 ring-bg-white-0" aria-hidden />
                <Link to={`/changelog/${e.id}`} className="group block rounded-2xl bg-bg-white-0 p-5 ring-1 ring-inset ring-stroke-soft-200 transition hover:ring-stroke-sub-300">
                  <div className="flex flex-wrap items-center gap-2">
                    <time dateTime={e.entryDate} className="text-paragraph-sm text-text-sub-600">{formatDay(e.entryDate)}</time>
                    {e.isSample ? <SampleBadge /> : null}
                  </div>
                  <h2 className="mt-2 flex items-center gap-1 text-label-lg text-text-strong-950">
                    {e.title}
                    <RiArrowRightSLine className="size-5 text-text-soft-400 transition group-hover:translate-x-0.5" aria-hidden />
                  </h2>
                  <p className="mt-1 text-paragraph-sm text-text-sub-600">{e.summary}</p>
                </Link>
              </li>
            ))}
          </ol>
          <Pagination page={page} total={total} pageSize={pageSize} label="Changelog pages" />
        </>
      ) : (
        <EmptyState icon={RiHistoryLine} title="No published updates yet" description="Published changelog entries will appear here." action={canManage ? <Badge color="gray">Drafts live in Manage entries</Badge> : undefined} />
      )}
    </div>
  );
}
