import { Form, Link, useFetcher, useLocation, useSearchParams } from "react-router";
import { RiAddLine, RiKanbanView, RiListUnordered, RiSearchLine, RiTaskLine } from "@remixicon/react";
import type { Route } from "./+types/tasks";
import { Time } from "~/components/ui/time";
import { ActiveFilters, chipList, Card, PageHeader, Pagination, SegmentedLinks } from "~/components/ui/page";
import { EmptyState } from "~/components/ui/feedback";
import { Avatar, Badge, ProgressBar } from "~/components/ui/display";
import { Button } from "~/components/ui/button";
import { CatalogToolbar } from "~/components/catalog-toolbar";
import { DueLabel, PriorityLabel, TaskStatusBadge } from "~/components/task-badges";
import { can } from "~/domain/permissions";
import { allowedStatusTransitions, priorityLabel, statusLabel, TASK_PRIORITIES, TASK_STATUSES, type TaskStatus } from "~/domain/tasks";
import { formatRelative } from "~/lib/format";
import { getDb, requirePermission } from "~/server/request.server";
import { boardTasks, listMembers, listTasks, parseTaskFilters, type TaskListItem } from "~/server/tasks.server";

export const meta: Route.MetaFunction = () => [{ title: "Tasks · D.S Hub" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const actor = requirePermission(context, request, "task.view");
  const db = getDb(context);
  const filters = parseTaskFilters(new URL(request.url));
  const members = await listMembers(db);
  // Quick status moves exclude Blocked, which needs a reason on the task page.
  const withMoves = (t: TaskListItem) => ({
    ...t,
    moves: allowedStatusTransitions(actor, { ...t, description: "", createdById: "", archivedAt: t.archivedAt }).filter((s) => s !== "blocked"),
  });
  if (filters.view === "board") {
    const columns = await boardTasks(db, actor, filters);
    return { view: "board" as const, filters, members, canCreate: can(actor, "task.create"), actorId: actor.id, columns: columns.map((c) => ({ ...c, items: c.items.map(withMoves) })), list: null };
  }
  const list = await listTasks(db, actor, filters);
  return { view: "list" as const, filters, members, canCreate: can(actor, "task.create"), actorId: actor.id, columns: null, list: { ...list, items: list.items.map(withMoves) } };
}

type Row = TaskListItem & { moves: TaskStatus[] };

function QuickMove({ task }: { task: Row }) {
  const fetcher = useFetcher();
  if (!task.moves.length) return null;
  return (
    <fetcher.Form method="post" action={`/tasks/${task.id}`} className="contents">
      <input type="hidden" name="intent" value="status" />
      <label htmlFor={`move-${task.id}`} className="sr-only">Move #{task.number} to</label>
      <select
        id={`move-${task.id}`}
        name="status"
        defaultValue=""
        disabled={fetcher.state !== "idle"}
        onChange={(e) => e.currentTarget.value && fetcher.submit(e.currentTarget.form)}
        className="h-7 rounded-md bg-bg-white-0 px-1.5 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200 hover:bg-bg-weak-50"
      >
        <option value="" disabled>Move to…</option>
        {task.moves.map((s) => (
          <option key={s} value={s}>{statusLabel(s)}</option>
        ))}
      </select>
    </fetcher.Form>
  );
}

function TaskCard({ task, from }: { task: Row; from: string }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl bg-bg-white-0 p-3 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200">
      <div className="flex items-start gap-2">
        <Link to={`/tasks/${task.id}`} state={{ from }} className="flex-1 text-label-sm text-text-strong-950 hover:underline">
          <span className="text-text-sub-600">#{task.number}</span> {task.title}
        </Link>
      </div>
      {task.status === "blocked" && task.blockerReason ? <p className="rounded-lg bg-error-lighter px-2 py-1.5 text-paragraph-xs text-error-dark">Blocked: {task.blockerReason}</p> : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <PriorityLabel priority={task.priority} />
        <DueLabel dueDate={task.dueDate} status={task.status} />
      </div>
      {task.progress > 0 && task.status !== "done" ? <ProgressBar value={task.progress} label={`Progress for #${task.number}`} /> : null}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-paragraph-xs text-text-sub-600">
          <Avatar name={task.assigneeName} image={task.assigneeImage} size={20} />
          {task.assigneeName ?? "Unassigned"}
        </span>
        <QuickMove task={task} />
      </div>
    </article>
  );
}

function groupRows(rows: Row[], group: string, members: { id: string; name: string }[]) {
  if (group === "status") return TASK_STATUSES.map((s) => ({ key: s.id, label: s.label, rows: rows.filter((r) => r.status === s.id) })).filter((g) => g.rows.length);
  if (group === "priority") return [...TASK_PRIORITIES].reverse().map((p) => ({ key: p.id, label: p.label, rows: rows.filter((r) => r.priority === p.id) })).filter((g) => g.rows.length);
  if (group === "assignee") {
    const keys = [...new Set(rows.map((r) => r.assigneeId ?? ""))];
    return keys.map((k) => ({ key: k || "none", label: k ? (members.find((m) => m.id === k)?.name ?? "Former member") : "Unassigned", rows: rows.filter((r) => (r.assigneeId ?? "") === k) }));
  }
  return [{ key: "all", label: "", rows }];
}

export default function Tasks({ loaderData }: Route.ComponentProps) {
  const { filters, members, canCreate, view } = loaderData;
  const location = useLocation();
  const [params] = useSearchParams();
  const from = location.pathname + location.search;
  const memberName = (id: string) => (id === "me" ? "Assigned to me" : id === "unassigned" ? "Unassigned" : (members.find((m) => m.id === id)?.name ?? "Member"));

  const chips = chipList(
    filters.q && { key: "q", label: `Search: ${filters.q}`, remove: { q: null } },
    ...filters.status.map((s) => ({ key: `status-${s}`, label: statusLabel(s), remove: { status: filters.status.filter((x) => x !== s) } })),
    ...filters.priority.map((p) => ({ key: `priority-${p}`, label: `${priorityLabel(p)} priority`, remove: { priority: filters.priority.filter((x) => x !== p) } })),
    filters.assignee && { key: "assignee", label: memberName(filters.assignee), remove: { assignee: null } },
    filters.due && { key: "due", label: filters.due === "overdue" ? "Overdue" : "Due soon", remove: { due: null } },
    filters.archived && { key: "archived", label: "Archived", remove: { archived: null } },
  );

  const empty = (
    <EmptyState
      icon={chips.length ? RiSearchLine : RiTaskLine}
      title={chips.length ? "No tasks match these filters" : "No tasks yet"}
      description={chips.length ? "Remove a filter to see more." : canCreate ? "Create the first task to get the team started." : "Tasks created by a manager will appear here."}
      action={
        chips.length ? (
          <Link to={`?view=${view}`} className="text-label-sm text-primary-base hover:underline">Clear filters</Link>
        ) : canCreate ? (
          <Button asChild size="small" leadingIcon={RiAddLine}><Link to="/tasks/new">Create task</Link></Button>
        ) : undefined
      }
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={RiTaskLine}
        title="Tasks"
        description="Plan, claim and track the team's work."
        actions={
          <>
            <SegmentedLinks label="View" param="view" value={view} options={[{ value: "list", label: "List", icon: RiListUnordered }, { value: "board", label: "Board", icon: RiKanbanView }]} />
            {canCreate ? (
              <Button asChild size="small" leadingIcon={RiAddLine}><Link to="/tasks/new">Create task</Link></Button>
            ) : null}
          </>
        }
      />

      <nav aria-label="Quick filters" className="flex flex-wrap gap-2">
        {[
          { label: "All open", to: `?view=${view}` },
          { label: "Assigned to me", to: `?view=${view}&assignee=me` },
          { label: "Unassigned to-do", to: `?view=${view}&assignee=unassigned&status=todo` },
          { label: "Blocked", to: `?view=${view}&status=blocked` },
          { label: "Overdue", to: `?view=${view}&due=overdue` },
        ].map((q) => {
          const active = `?${params.toString()}` === q.to;
          return (
            <Link key={q.label} to={q.to} aria-current={active ? "true" : undefined} className={active ? "rounded-full bg-bg-strong-950 px-3 py-1 text-label-xs text-text-white-0" : "rounded-full px-3 py-1 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200 hover:bg-bg-weak-50"}>
              {q.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3">
        <CatalogToolbar
          searchLabel="Search title or #number"
          q={filters.q}
          keep={["view"]}
          selects={[
            { name: "status", label: "Status", value: filters.status[0] ?? "", allLabel: "Any status", options: TASK_STATUSES.map((s) => ({ value: s.id, label: s.label })) },
            { name: "priority", label: "Priority", value: filters.priority[0] ?? "", allLabel: "Any priority", options: [...TASK_PRIORITIES].reverse().map((p) => ({ value: p.id, label: p.label })) },
            {
              name: "assignee",
              label: "Assignee",
              value: filters.assignee,
              allLabel: "Anyone",
              options: [{ value: "me", label: "Me" }, { value: "unassigned", label: "Unassigned" }, ...members.map((m) => ({ value: m.id, label: m.name }))],
            },
            {
              name: "sort",
              label: "Sort by",
              value: filters.sort,
              options: [
                { value: "updated", label: "Last updated" },
                { value: "created", label: "Date created" },
                { value: "due", label: "Due date" },
                { value: "priority", label: "Priority" },
                { value: "title", label: "Title" },
              ],
            },
            { name: "dir", label: "Sort direction", value: filters.dir, options: [{ value: "desc", label: "Descending" }, { value: "asc", label: "Ascending" }] },
            ...(view === "list"
              ? [{ name: "group", label: "Group by", value: filters.group, options: [{ value: "none", label: "No grouping" }, { value: "status", label: "Group: Status" }, { value: "priority", label: "Group: Priority" }, { value: "assignee", label: "Group: Assignee" }] }]
              : []),
          ]}
        />
        <ActiveFilters chips={chips} />
        <Form method="get" className="flex items-center gap-2 text-paragraph-xs text-text-sub-600">
          {[...params.entries()].filter(([k]) => k !== "archived" && k !== "page").map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
          {filters.archived ? null : <input type="hidden" name="archived" value="1" />}
          <button type="submit" className="underline-offset-2 hover:text-text-strong-950 hover:underline">
            {filters.archived ? "Back to active tasks" : "Show archived tasks"}
          </button>
        </Form>
      </div>

      {loaderData.columns ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
          <div className="flex gap-4" style={{ minWidth: `${loaderData.columns.length * 272}px` }}>
            {loaderData.columns.map((col) => (
              <section key={col.status} aria-labelledby={`col-${col.status}`} className="flex w-[272px] shrink-0 flex-col gap-3 rounded-2xl bg-bg-weak-50 p-3 ring-1 ring-inset ring-stroke-soft-200">
                <h2 id={`col-${col.status}`} className="flex items-center justify-between px-1">
                  <TaskStatusBadge status={col.status} />
                  <Badge color="gray">{col.total}</Badge>
                </h2>
                {col.items.length ? (
                  <ul className="flex flex-col gap-2">
                    {col.items.map((t) => (
                      <li key={t.id}><TaskCard task={t} from={from} /></li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-1 py-4 text-center text-paragraph-xs text-text-sub-600">No tasks</p>
                )}
                {col.total > col.items.length ? (
                  <Link to={`?view=list&status=${col.status}`} className="px-1 text-label-xs text-primary-base hover:underline">
                    Showing {col.items.length} of {col.total}. See all in list
                  </Link>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      ) : loaderData.list && loaderData.list.items.length ? (
        <div className="space-y-6">
          {groupRows(loaderData.list.items, filters.group, members).map((g) => (
            <section key={g.key} aria-label={g.label || "Tasks"}>
              {g.label ? <h2 className="mb-2 flex items-center gap-2 text-label-sm text-text-sub-600">{g.label} <Badge color="gray">{g.rows.length}</Badge></h2> : null}
              <Card className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <caption className="sr-only">Tasks{g.label ? `: ${g.label}` : ""}</caption>
                  <thead>
                    <tr className="bg-bg-weak-50 text-paragraph-sm text-text-sub-600">
                      <th scope="col" className="px-4 py-2 font-normal">Task</th>
                      <th scope="col" className="px-4 py-2 font-normal">Status</th>
                      <th scope="col" className="px-4 py-2 font-normal">Priority</th>
                      <th scope="col" className="px-4 py-2 font-normal">Assignee</th>
                      <th scope="col" className="px-4 py-2 font-normal">Due</th>
                      <th scope="col" className="px-4 py-2 font-normal">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroke-soft-200">
                    {g.rows.map((t) => (
                      <tr key={t.id} className="hover:bg-bg-weak-50">
                        <td className="max-w-xs px-4 py-3">
                          <Link to={`/tasks/${t.id}`} state={{ from }} className="text-label-sm text-text-strong-950 hover:underline">
                            <span className="text-text-sub-600">#{t.number}</span> {t.title}
                          </Link>
                          {t.status === "blocked" && t.blockerReason ? <p className="line-clamp-1 text-paragraph-xs text-error-base">Blocked: {t.blockerReason}</p> : null}
                        </td>
                        <td className="px-4 py-3"><TaskStatusBadge status={t.status} /></td>
                        <td className="px-4 py-3"><PriorityLabel priority={t.priority} /></td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2 text-paragraph-sm text-text-sub-600">
                            <Avatar name={t.assigneeName} image={t.assigneeImage} size={24} />
                            {t.assigneeName ?? "Unassigned"}
                          </span>
                        </td>
                        <td className="px-4 py-3">{t.dueDate ? <DueLabel dueDate={t.dueDate} status={t.status} /> : <span className="text-paragraph-sm text-text-sub-600">—</span>}</td>
                        <td className="px-4 py-3 text-paragraph-sm text-text-sub-600"><Time value={t.updatedAt} format="relative" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>
          ))}
          <Pagination page={filters.page} total={loaderData.list.total} pageSize={loaderData.list.pageSize} label="Task pages" />
        </div>
      ) : (
        empty
      )}
    </div>
  );
}
