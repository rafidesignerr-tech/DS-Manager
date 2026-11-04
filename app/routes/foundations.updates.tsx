import { Link } from "react-router";
import { RiHistoryLine } from "@remixicon/react";
import type { Route } from "./+types/foundations.updates";
import { Card, PageHeader, Pagination } from "~/components/ui/page";
import { EmptyState } from "~/components/ui/feedback";
import { Avatar } from "~/components/ui/display";
import { Time } from "~/components/ui/time";
import { FoundationNav, tokenHref } from "~/components/foundations";
import { getToken } from "~/foundations/model";
import { getDb, requirePermission } from "~/server/request.server";
import { listUpdates } from "~/server/foundations.server";

export const meta: Route.MetaFunction = () => [{ title: "Foundation updates · D.S Hub" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  requirePermission(context, request, "foundation.track");
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
  const result = await listUpdates(getDb(context), { page });
  return {
    page,
    ...result,
    items: result.items.map((i) => ({ ...i, path: getToken(i.tokenId)?.path ?? null })),
  };
}

export default function FoundationUpdates({ loaderData }: Route.ComponentProps) {
  const { items, total, pageSize, page } = loaderData;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={RiHistoryLine} title="Updates" description="Every tracking change on foundation tokens: who changed what, and when." />
      <FoundationNav showUpdates />
      {items.length ? (
        <>
          <Card>
            <ul className="divide-y divide-stroke-soft-200">
              {items.map((u) => (
                <li key={u.id} className="flex items-start gap-3 px-4 py-3">
                  <Avatar name={u.actorName} image={u.actorImage} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-paragraph-sm text-text-sub-600">
                      <span className="text-label-sm text-text-strong-950">{u.actorName ?? "Former member"}</span> changed {u.field} on{" "}
                      {u.path ? (
                        <Link to={tokenHref(u.tokenId)} className="font-mono text-paragraph-xs text-primary-base hover:underline">
                          {u.path}
                        </Link>
                      ) : (
                        <span className="font-mono text-paragraph-xs">{u.tokenId.split("--")[1]} (no longer in tokens file)</span>
                      )}
                    </p>
                    <p className="text-paragraph-xs text-text-sub-600">
                      {u.fromValue ?? "empty"} → <span className="text-text-strong-950">{u.toValue ?? "empty"}</span> · <Time value={u.createdAt} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Pagination page={page} total={total} pageSize={pageSize} label="Update pages" />
        </>
      ) : (
        <EmptyState icon={RiHistoryLine} title="No updates yet" description="Status, assignee and notes changes on tokens will be listed here." />
      )}
    </div>
  );
}
