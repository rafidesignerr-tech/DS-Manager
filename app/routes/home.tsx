import { Link } from "react-router";
import {
  RiArrowRightLine,
  RiBox3Line,
  RiGridLine,
  RiHistoryLine,
  RiPaletteLine,
  RiShapesLine,
  RiTaskLine,
  RiTeamLine,
} from "@remixicon/react";
import type { Route } from "./+types/home";
import { Time } from "~/components/ui/time";
import { Card, CardHeader } from "~/components/ui/page";
import { Avatar, Badge, SampleBadge } from "~/components/ui/display";
import { EmptyState } from "~/components/ui/feedback";
import { Button } from "~/components/ui/button";
import { HUB } from "~/config/hub";
import { can, ROLE_LABELS } from "~/domain/permissions";
import { statusLabel, TASK_STATUSES } from "~/domain/tasks";
import { formatRelative, plural } from "~/lib/format";
import { getActor, getDb } from "~/server/request.server";
import { referenceCounts } from "~/server/reference.server";
import { allTokens } from "~/foundations/model";
import { myOpenTaskCount, recentTaskActivity, taskCountsByStatus, listMembers } from "~/server/tasks.server";

export const meta: Route.MetaFunction = () => [{ title: HUB.name }];

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDb(context);
  const actor = getActor(context);
  const counts = await referenceCounts(db);
  if (!actor || !can(actor, "task.view")) return { counts, team: null };
  const [activity, byStatus, mine, members] = await Promise.all([
    recentTaskActivity(db, 8),
    taskCountsByStatus(db),
    myOpenTaskCount(db, actor.id),
    listMembers(db),
  ]);
  return { counts, team: { activity, byStatus, mine, members: members.filter((m) => m.status === "active") } };
}

function activityText(a: { action: string; field: string | null; toValue: string | null }) {
  if (a.action === "created") return "created";
  if (a.action === "self_assigned") return "picked up";
  if (a.action === "assigned") return `assigned ${a.toValue ?? "someone"} to`;
  if (a.action === "unassigned") return "unassigned";
  if (a.action === "archived") return "archived";
  if (a.action === "restored") return "restored";
  if (a.field === "status") return `moved to ${statusLabel(a.toValue ?? "")}`;
  if (a.field === "priority") return "changed priority of";
  if (a.field === "dueDate") return "changed the due date of";
  if (a.field === "blockerReason") return "noted a blocker on";
  if (a.field === "title") return "renamed";
  return "updated";
}

const ENTRY_POINTS = [
  { to: "/foundations", title: "Foundations", description: "Colors, typography, spacing, radius, elevation and layout tokens.", icon: RiPaletteLine },
  { to: "/components", title: "Components", description: "Search, filter and explore how components relate.", icon: RiShapesLine },
  { to: "/icons", title: "Icons", description: "Browse the icon gallery by name and category.", icon: RiGridLine },
];

export default function Home({ loaderData }: Route.ComponentProps) {
  const { counts, team } = loaderData;
  const metrics = [
    { label: "Foundation tokens", value: allTokens().length },
    { label: "Components", value: counts.components },
    { label: "Component categories", value: counts.componentCategories },
    { label: "Icons", value: counts.icons },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-20 bg-bg-weak-50 p-6 ring-1 ring-inset ring-stroke-soft-200 md:p-10">
        <div className="relative z-10 max-w-2xl space-y-4">
          <SampleBadge />
          <h1 className="text-title-h4 text-text-strong-950 md:text-title-h3">{HUB.name}</h1>
          <p className="text-paragraph-lg text-text-sub-600">
            {HUB.tagline} Sample introduction text. Replace it with a short description of your system and who it serves.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild trailingIcon={RiArrowRightLine}>
              <Link to="/components">Browse components</Link>
            </Button>
            <Button asChild variant="neutral" mode="stroke">
              <Link to="/feedback">Share feedback</Link>
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-16 hidden size-72 rounded-full bg-primary-alpha-10 md:block" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 right-24 hidden size-56 rounded-full bg-primary-alpha-16 md:block" aria-hidden />
      </section>

      <section aria-labelledby="metrics-title">
        <h2 id="metrics-title" className="sr-only">Catalog at a glance</h2>
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {metrics.map((m) => (
            <Card as="li" key={m.label} className="p-4">
              <p className="text-paragraph-sm text-text-sub-600">{m.label}</p>
              <p className="mt-1 text-title-h4 text-text-strong-950">{m.value.toLocaleString("en")}</p>
            </Card>
          ))}
        </ul>
        <p className="mt-2 text-paragraph-xs text-text-sub-600">Counts are calculated from the catalog. Foundations come from the tokens file; components and icons are still sample entries.</p>
      </section>

      <section aria-labelledby="explore-title" className="space-y-4">
        <h2 id="explore-title" className="text-label-lg text-text-strong-950">Explore</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {ENTRY_POINTS.map((e) => (
            <Link key={e.to} to={e.to} className="group rounded-2xl bg-bg-white-0 p-5 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 transition hover:ring-stroke-sub-300 focus-visible:shadow-button-primary-focus">
              <e.icon className="size-6 text-primary-base" aria-hidden />
              <p className="mt-4 flex items-center gap-1 text-label-md text-text-strong-950">
                {e.title}
                <RiArrowRightLine className="size-4 text-text-soft-400 transition group-hover:translate-x-0.5" aria-hidden />
              </p>
              <p className="mt-1 text-paragraph-sm text-text-sub-600">{e.description}</p>
            </Link>
          ))}
          <div className="rounded-2xl bg-bg-weak-50 p-5 ring-1 ring-inset ring-stroke-soft-200" aria-label="Product Kit, coming soon">
            <RiBox3Line className="size-6 text-text-soft-400" aria-hidden />
            <p className="mt-4 flex items-center gap-2 text-label-md text-text-sub-600">
              Product Kit <Badge color="gray">Coming soon</Badge>
            </p>
            <p className="mt-1 text-paragraph-sm text-text-sub-600">Ready-made product patterns. Planned for a later release.</p>
          </div>
        </div>
      </section>

      {team ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Recent task activity"
              action={
                <Button asChild variant="neutral" mode="ghost" size="xsmall">
                  <Link to="/tasks">All tasks</Link>
                </Button>
              }
            />
            {team.activity.length ? (
              <ul className="divide-y divide-stroke-soft-200">
                {team.activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                    <Avatar name={a.actorName} image={a.actorImage} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-paragraph-sm text-text-sub-600">
                        <span className="text-label-sm text-text-strong-950">{a.actorName ?? "Former member"}</span> {activityText(a)}{" "}
                        <Link to={`/tasks/${a.taskId}`} className="text-label-sm text-text-strong-950 hover:underline">
                          #{a.taskNumber} {a.taskTitle}
                        </Link>
                      </p>
                      <p className="text-paragraph-xs text-text-sub-600">
                        <Time value={a.createdAt} format="relative" />
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={RiTaskLine} title="No activity yet" description="Task updates from the team will show up here." />
            )}
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader title="Work overview" description={`You have ${plural(team.mine, "open task")} assigned.`} />
              <ul className="space-y-2 p-4">
                {TASK_STATUSES.map((s) => (
                  <li key={s.id}>
                    <Link to={`/tasks?status=${s.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-paragraph-sm text-text-sub-600 hover:bg-bg-weak-50">
                      {s.label}
                      <span className="text-label-sm text-text-strong-950">{team.byStatus[s.id] ?? 0}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Team" description={plural(team.members.length, "active member")} />
              <ul className="space-y-3 p-4">
                {team.members.slice(0, 6).map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <Avatar name={m.name} image={m.image} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-label-sm text-text-strong-950">{m.name}</p>
                      <p className="text-paragraph-xs text-text-sub-600">{ROLE_LABELS[m.role]}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {team.members.length > 6 ? (
                <p className="px-4 pb-4 text-paragraph-xs text-text-sub-600">
                  <RiTeamLine className="mr-1 inline size-4" aria-hidden />+{team.members.length - 6} more
                </p>
              ) : null}
            </Card>
          </div>
        </div>
      ) : (
        <Card className="flex flex-col items-start gap-3 p-5 md:flex-row md:items-center">
          <RiHistoryLine className="size-6 text-text-soft-400" aria-hidden />
          <p className="flex-1 text-paragraph-sm text-text-sub-600">See what changed recently in the system.</p>
          <Button asChild variant="neutral" mode="stroke" size="small">
            <Link to="/changelog">Open changelog</Link>
          </Button>
        </Card>
      )}
    </div>
  );
}
