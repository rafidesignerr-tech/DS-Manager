import { Form, Link, useNavigation } from "react-router";
import { RiCheckDoubleLine, RiNotification3Line } from "@remixicon/react";
import type { Route } from "./+types/notifications";
import { Time } from "~/components/ui/time";
import { Card, PageHeader, SegmentedLinks } from "~/components/ui/page";
import { EmptyState } from "~/components/ui/feedback";
import { Avatar } from "~/components/ui/display";
import { Button } from "~/components/ui/button";
import { notificationHref, notificationLabel } from "~/domain/notifications";
import { formatDateTime, formatRelative } from "~/lib/format";
import { cn } from "~/lib/cn";
import { formString, getDb, getEnv, redirectWithFlash, requirePermission, safeRedirectPath } from "~/server/request.server";
import { listNotifications, markRead } from "~/server/notifications.server";

export const meta: Route.MetaFunction = () => [{ title: "Notifications · D.S Hub" }];

const PAGE = 30;

export async function loader({ request, context }: Route.LoaderArgs) {
  const actor = requirePermission(context, request, "notifications.view");
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") === "unread" ? "unread" : "all";
  const beforeParam = Number(url.searchParams.get("before"));
  const result = await listNotifications(getDb(context), actor.id, {
    unreadOnly: filter === "unread",
    before: beforeParam ? new Date(beforeParam) : undefined,
    limit: PAGE,
  });
  return { filter, ...result };
}

export async function action({ request, context }: Route.ActionArgs) {
  const actor = requirePermission(context, request, "notifications.view");
  const form = await request.formData();
  const intent = formString(form, "intent");
  const db = getDb(context);
  if (intent === "open") {
    // Mark as read, then go to the record it points to.
    await markRead(db, actor.id, [formString(form, "id")]);
    return Response.redirect(new URL(safeRedirectPath(formString(form, "to"), "/notifications"), request.url), 303);
  }
  if (intent === "read") await markRead(db, actor.id, [formString(form, "id")]);
  if (intent === "read_all") await markRead(db, actor.id, "all");
  return redirectWithFlash(getEnv(context), request, new URL(request.url).pathname + new URL(request.url).search, {
    tone: "success",
    message: intent === "read_all" ? "All notifications marked as read." : "Marked as read.",
  });
}

export default function Notifications({ loaderData }: Route.ComponentProps) {
  const { items, hasMore, filter } = loaderData;
  const navigation = useNavigation();
  const unreadOnPage = items.some((n) => !n.readAt);
  const last = items.at(-1);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        icon={RiNotification3Line}
        title="Notifications"
        description="Updates on your tasks, feedback and published changes."
        actions={
          <Form method="post" preventScrollReset>
            <input type="hidden" name="intent" value="read_all" />
            <Button type="submit" size="small" variant="neutral" mode="stroke" leadingIcon={RiCheckDoubleLine} disabled={!unreadOnPage && filter === "unread"} pending={navigation.formData?.get("intent") === "read_all"}>
              Mark all as read
            </Button>
          </Form>
        }
      />
      <SegmentedLinks label="Filter notifications" param="filter" value={filter} options={[{ value: "all", label: "All" }, { value: "unread", label: "Unread" }]} />

      {items.length ? (
        <Card>
          <ul className="divide-y divide-stroke-soft-200">
            {items.map((n) => {
              const unread = !n.readAt;
              const href = notificationHref(n.targetType, n.targetId);
              return (
                <li key={n.id} className={cn("flex items-start gap-3 p-4", unread && "bg-bg-weak-25")}>
                  <Avatar name={n.actorName ?? "System"} image={n.actorImage} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-label-xs uppercase text-text-sub-600">
                      {notificationLabel(n.event)}
                      {unread ? <span className="sr-only"> (unread)</span> : null}
                    </p>
                    <Form method="post">
                      <input type="hidden" name="intent" value="open" />
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name="to" value={href} />
                      <button type="submit" className="mt-0.5 text-left text-label-sm text-text-strong-950 hover:underline">
                        {n.title}
                      </button>
                    </Form>
                    <p className="mt-0.5 text-paragraph-xs text-text-sub-600">
                      {n.actorName ? `${n.actorName} · ` : null}
                      <Time value={n.createdAt} format="relative" />
                    </p>
                  </div>
                  {unread ? (
                    <Form method="post" preventScrollReset className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-primary-base" aria-hidden />
                      <input type="hidden" name="intent" value="read" />
                      <input type="hidden" name="id" value={n.id} />
                      <Button type="submit" size="xxsmall" variant="neutral" mode="ghost">Mark as read</Button>
                    </Form>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {hasMore && last ? (
            <div className="border-t border-stroke-soft-200 p-3 text-center">
              <Link to={`?filter=${filter}&before=${new Date(last.createdAt).getTime()}`} className="text-label-sm text-primary-base hover:underline">
                Show older
              </Link>
            </div>
          ) : null}
        </Card>
      ) : (
        <EmptyState
          icon={RiNotification3Line}
          title={filter === "unread" ? "You're all caught up" : "No notifications yet"}
          description={filter === "unread" ? "No unread notifications." : "You'll be notified when tasks are assigned to you or change."}
        />
      )}
    </div>
  );
}
