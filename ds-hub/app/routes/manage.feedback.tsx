import { Link } from "react-router";
import { RiInbox2Line, RiMailLine } from "@remixicon/react";
import type { Route } from "./+types/manage.feedback";
import { Time } from "~/components/ui/time";
import { Card, PageHeader, Pagination } from "~/components/ui/page";
import { EmptyState } from "~/components/ui/feedback";
import { Badge, StatusBadge } from "~/components/ui/display";
import { FEEDBACK_TONES } from "~/components/feedback-tones";
import { FEEDBACK_STATUSES, FEEDBACK_TOPICS, feedbackStatusLabel, type FeedbackStatus } from "~/domain/feedback";
import { formatRelative } from "~/lib/format";
import { cn } from "~/lib/cn";
import { getDb, requirePermission } from "~/server/request.server";
import { listFeedback } from "~/server/feedback.server";

export const meta: Route.MetaFunction = () => [{ title: "Feedback inbox · D.S Hub" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  requirePermission(context, request, "feedback.view");
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") ?? "";
  const status = (FEEDBACK_STATUSES.some((s) => s.id === statusParam) ? statusParam : "") as FeedbackStatus | "";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  return { status, page, ...(await listFeedback(getDb(context), { status, page })) };
}

export default function FeedbackInbox({ loaderData }: Route.ComponentProps) {
  const { items, total, pageSize, page, status, counts } = loaderData;
  const all = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const topic = (id: string) => FEEDBACK_TOPICS.find((t) => t.id === id)?.label ?? id;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={RiInbox2Line} title="Feedback inbox" description="Private submissions from the feedback form. Never shown publicly." />
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {[{ id: "", label: "All", n: all }, ...FEEDBACK_STATUSES.map((s) => ({ id: s.id, label: s.label, n: counts[s.id] ?? 0 }))].map((s) => (
          <Link
            key={s.id || "all"}
            to={s.id ? `?status=${s.id}` : "?"}
            aria-current={status === s.id ? "true" : undefined}
            className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-label-xs ring-1 ring-inset", status === s.id ? "bg-bg-strong-950 text-text-white-0 ring-transparent" : "text-text-sub-600 ring-stroke-soft-200 hover:bg-bg-weak-50")}
          >
            {s.label} <span className="opacity-70">{s.n}</span>
          </Link>
        ))}
      </nav>
      {items.length ? (
        <>
          <Card>
            <ul className="divide-y divide-stroke-soft-200">
              {items.map((f) => (
                <li key={f.id}>
                  <Link to={`/manage/feedback/${f.id}`} className="flex flex-col gap-2 p-4 hover:bg-bg-weak-50 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge color="gray">{topic(f.topic)}</Badge>
                        {f.hasContact ? <span className="inline-flex items-center gap-1 text-paragraph-xs text-text-sub-600"><RiMailLine className="size-4" aria-hidden />Contact provided</span> : null}
                      </div>
                      <p className="line-clamp-2 text-paragraph-sm text-text-strong-950">{f.message}</p>
                    </div>
                    <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                      <StatusBadge tone={FEEDBACK_TONES[f.status]}>{feedbackStatusLabel(f.status)}</StatusBadge>
                      <Time value={f.createdAt} format="relative" className="text-paragraph-xs text-text-sub-600" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Pagination page={page} total={total} pageSize={pageSize} label="Feedback pages" />
        </>
      ) : (
        <EmptyState icon={RiInbox2Line} title={status ? `Nothing in ${feedbackStatusLabel(status)}` : "No feedback yet"} description="Submissions from the public feedback form land here." />
      )}
    </div>
  );
}
