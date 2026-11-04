import * as React from "react";
import { data, Form, Link, useActionData, useLocation, useNavigation } from "react-router";
import {
  RiArchiveLine,
  RiArrowGoBackLine,
  RiArrowLeftLine,
  RiChat3Line,
  RiDeleteBinLine,
  RiEditLine,
  RiErrorWarningFill,
  RiHistoryLine,
  RiLinksLine,
  RiUserAddLine,
} from "@remixicon/react";
import type { Route } from "./+types/tasks.$id";
import { Time } from "~/components/ui/time";
import { Card, CardHeader } from "~/components/ui/page";
import { Alert, EmptyState } from "~/components/ui/feedback";
import { Avatar, Badge, ProgressBar } from "~/components/ui/display";
import { Button } from "~/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "~/components/ui/form";
import { ConfirmDialog } from "~/components/ui/overlay";
import { DueLabel, PriorityLabel, TaskStatusBadge } from "~/components/task-badges";
import { RelatedItemsPicker } from "~/components/related-items-picker";
import { referenceHref } from "~/components/reference-detail";
import { priorityLabel, statusLabel, TASK_PRIORITIES, type TaskChange, type TaskPriority, type TaskStatus, STATUS_IDS, PRIORITY_IDS } from "~/domain/tasks";
import { formatDateTime, formatDay, formatRelative } from "~/lib/format";
import { cn } from "~/lib/cn";
import { formString, getDb, getEnv, notFound, redirectWithFlash, requirePermission } from "~/server/request.server";
import {
  addComment,
  commentSchema,
  deleteComment,
  editComment,
  getTaskDetail,
  listMembers,
  selfAssign,
  setArchived,
  TaskError,
  updateTask,
} from "~/server/tasks.server";
import { referencePickerOptions } from "~/server/reference.server";

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: loaderData ? `#${loaderData.task.number} ${loaderData.task.title} · D.S Hub` : "Task · D.S Hub" },
];

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const actor = requirePermission(context, request, "task.view");
  const db = getDb(context);
  const detail = await getTaskDetail(db, actor, params.id);
  if (!detail) throw notFound("This task doesn't exist or was removed.");
  const needsEditorData = detail.permissions.editable.assigneeId || detail.permissions.editable.relatedItemIds;
  const [members, references] = needsEditorData ? await Promise.all([listMembers(db), referencePickerOptions(db)]) : [[], []];
  return { ...detail, members: members.filter((m) => m.status === "active"), references, actorId: actor.id };
}

type ActionResult = { error: string; fieldErrors: Record<string, string>; intent: string };

function fail(intent: string, error: string, fieldErrors: Record<string, string> = {}, status = 400) {
  return data<ActionResult>({ error, fieldErrors, intent }, { status });
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const actor = requirePermission(context, request, "task.view");
  const db = getDb(context);
  const env = getEnv(context);
  const form = await request.formData();
  const intent = formString(form, "intent");
  const here = new URL(request.url).pathname;
  const done = (message: string) => redirectWithFlash(env, request, here, { tone: "success", message });

  try {
    switch (intent) {
      case "status": {
        const status = formString(form, "status") as TaskStatus;
        if (!STATUS_IDS.includes(status)) return fail(intent, "Choose a status.");
        const change: TaskChange = { status };
        if (status === "blocked") change.blockerReason = formString(form, "blockerReason");
        await updateTask(db, actor, params.id, change);
        return done(`Moved to ${statusLabel(status)}.`);
      }
      case "progress": {
        const progress = Number(formString(form, "progress"));
        await updateTask(db, actor, params.id, { progress: Number.isFinite(progress) ? Math.round(progress) : -1 });
        return done("Progress updated.");
      }
      case "details": {
        const priority = formString(form, "priority") as TaskPriority;
        if (!PRIORITY_IDS.includes(priority)) return fail(intent, "Choose a priority.", { priority: "Choose a priority." });
        const title = formString(form, "title").trim();
        if (title.length > 160) return fail(intent, "Check the highlighted fields.", { title: "Keep the title under 160 characters." });
        await updateTask(
          db,
          actor,
          params.id,
          {
            title,
            description: formString(form, "description").trim().slice(0, 10_000),
            priority,
            assigneeId: formString(form, "assigneeId") || null,
            dueDate: formString(form, "dueDate") || null,
          },
          form.getAll("relatedItemIds").filter((v): v is string => typeof v === "string"),
        );
        return done("Task saved.");
      }
      case "self_assign":
        await selfAssign(db, actor, params.id);
        return done("The task is yours. Move it to In progress when you start.");
      case "comment": {
        const body = commentSchema.safeParse(formString(form, "body"));
        if (!body.success) return fail(intent, body.error.issues[0]?.message ?? "Write a comment first.", { body: body.error.issues[0]?.message ?? "" });
        await addComment(db, actor, params.id, body.data);
        return done("Comment added.");
      }
      case "comment_edit": {
        const body = commentSchema.safeParse(formString(form, "body"));
        if (!body.success) return fail(intent, body.error.issues[0]?.message ?? "Write a comment first.");
        await editComment(db, actor, params.id, formString(form, "commentId"), body.data);
        return done("Comment updated.");
      }
      case "comment_delete":
        await deleteComment(db, actor, params.id, formString(form, "commentId"));
        return done("Comment deleted.");
      case "archive":
        await setArchived(db, actor, params.id, true);
        return done("Task archived. It's read-only until restored.");
      case "restore":
        await setArchived(db, actor, params.id, false);
        return done("Task restored.");
      default:
        return fail(intent, "Unknown action.");
    }
  } catch (e) {
    if (e instanceof TaskError) return fail(intent, e.message, e.fieldErrors, e.status);
    throw e;
  }
}

/* ------------------------------ timeline ------------------------------ */

type Detail = Route.ComponentProps["loaderData"];

function describeActivity(a: Detail["activity"][number]): React.ReactNode {
  const strong = (v: string | null) => <span className="text-label-sm text-text-strong-950">{v ?? "none"}</span>;
  switch (a.action) {
    case "created":
      return "created this task";
    case "self_assigned":
      return "assigned the task to themselves";
    case "assigned":
      return <>assigned the task to {strong(a.toValue)}</>;
    case "unassigned":
      return <>removed the assignee {a.fromValue ? <>({a.fromValue})</> : null}</>;
    case "archived":
      return "archived this task";
    case "restored":
      return "restored this task";
  }
  switch (a.field) {
    case "status":
      return <>changed status from {strong(statusLabel(a.fromValue ?? ""))} to {strong(statusLabel(a.toValue ?? ""))}</>;
    case "priority":
      return <>changed priority from {strong(priorityLabel(a.fromValue ?? ""))} to {strong(priorityLabel(a.toValue ?? ""))}</>;
    case "dueDate":
      return a.toValue ? <>set the due date to {strong(formatDay(a.toValue))}</> : "removed the due date";
    case "title":
      return <>renamed the task to {strong(a.toValue)}</>;
    case "blockerReason":
      return <>noted the blocker: {strong(a.toValue)}</>;
    case "relatedItems":
      return "updated related items";
  }
  return "updated the task";
}

function Timeline({ detail, actionData }: { detail: Detail; actionData?: ActionResult }) {
  type Entry = { kind: "comment"; at: number; c: Detail["comments"][number] } | { kind: "activity"; at: number; a: Detail["activity"][number] };
  const entries: Entry[] = [
    ...detail.comments.map((c) => ({ kind: "comment" as const, at: new Date(c.createdAt).getTime(), c })),
    ...detail.activity.map((a) => ({ kind: "activity" as const, at: new Date(a.createdAt).getTime(), a })),
  ].sort((x, y) => x.at - y.at);
  const [editing, setEditing] = React.useState<string | null>(null);
  const navigation = useNavigation();
  const posting = navigation.state === "submitting" && navigation.formData?.get("intent") === "comment";
  const formRef = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (navigation.state === "idle" && !actionData) formRef.current?.reset();
  }, [navigation.state, actionData]);

  return (
    <Card>
      <CardHeader title="Comments and activity" description="Comments are written by people. Activity is recorded by the system." />
      <ol className="flex flex-col gap-1 p-4">
        {entries.map((e) =>
          e.kind === "activity" ? (
            <li key={`a-${e.a.id}`} className="flex items-start gap-3 py-1.5 pl-2">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200" aria-hidden>
                <RiHistoryLine className="size-3.5 text-text-soft-400" />
              </span>
              <p className="text-paragraph-xs text-text-sub-600">
                <span className="sr-only">Activity: </span>
                <span className="text-label-xs text-text-strong-950">{e.a.actorName ?? "Former member"}</span> {describeActivity(e.a)} ·{" "}
                <Time value={e.a.createdAt} format="relative" />
              </p>
            </li>
          ) : (
            <li key={`c-${e.c.id}`} className="my-2 flex items-start gap-3">
              <Avatar name={e.c.authorName} image={e.c.authorImage} size={32} />
              <div className="min-w-0 flex-1 rounded-xl bg-bg-white-0 p-3 ring-1 ring-inset ring-stroke-soft-200">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-label-sm text-text-strong-950">{e.c.authorName}</span>
                  <span className="sr-only">commented</span>
                  <Time value={e.c.createdAt} format="relative" className="text-paragraph-xs text-text-sub-600" />
                  {e.c.editedAt && !e.c.deletedAt ? <span className="text-paragraph-xs text-text-sub-600">(edited)</span> : null}
                  {e.c.canModify ? (
                    <span className="ml-auto flex gap-1">
                      <Button variant="neutral" mode="ghost" size="xxsmall" iconOnly aria-label="Edit comment" onClick={() => setEditing(editing === e.c.id ? null : e.c.id)}>
                        <RiEditLine className="size-4" />
                      </Button>
                      <ConfirmDialog
                        title="Delete this comment?"
                        description="The comment text is removed. A note that a comment was deleted stays in the history."
                        trigger={
                          <Button variant="neutral" mode="ghost" size="xxsmall" iconOnly aria-label="Delete comment">
                            <RiDeleteBinLine className="size-4" />
                          </Button>
                        }
                      >
                        <Form method="post" preventScrollReset>
                          <input type="hidden" name="intent" value="comment_delete" />
                          <input type="hidden" name="commentId" value={e.c.id} />
                          <Button type="submit" variant="error" size="small">Delete comment</Button>
                        </Form>
                      </ConfirmDialog>
                    </span>
                  ) : null}
                </div>
                {e.c.deletedAt ? (
                  <p className="mt-1 text-paragraph-sm italic text-text-sub-600">This comment was deleted.</p>
                ) : editing === e.c.id ? (
                  <Form method="post" preventScrollReset className="mt-2 flex flex-col gap-2" onSubmit={() => setEditing(null)}>
                    <input type="hidden" name="intent" value="comment_edit" />
                    <input type="hidden" name="commentId" value={e.c.id} />
                    <label htmlFor={`edit-${e.c.id}`} className="sr-only">Edit comment</label>
                    <Textarea id={`edit-${e.c.id}`} name="body" defaultValue={e.c.body} rows={3} autoFocus />
                    <div className="flex justify-end gap-2">
                      <Button variant="neutral" mode="stroke" size="xsmall" onClick={() => setEditing(null)}>Cancel</Button>
                      <Button type="submit" size="xsmall">Save</Button>
                    </div>
                  </Form>
                ) : (
                  <p className="mt-1 whitespace-pre-line break-words text-paragraph-sm text-text-strong-950">{e.c.body}</p>
                )}
              </div>
            </li>
          ),
        )}
      </ol>
      {detail.permissions.canComment ? (
        <Form ref={formRef} method="post" preventScrollReset className="flex flex-col gap-2 border-t border-stroke-soft-200 p-4">
          <input type="hidden" name="intent" value="comment" />
          <Field label="Add a comment" name="body" error={actionData?.intent === "comment" ? actionData.fieldErrors.body : undefined}>
            {(p) => <Textarea {...p} rows={3} placeholder="Share progress, questions or decisions" maxLength={5000} />}
          </Field>
          <div className="flex justify-end">
            <Button type="submit" size="small" leadingIcon={RiChat3Line} pending={posting}>Comment</Button>
          </div>
        </Form>
      ) : null}
    </Card>
  );
}

/* ------------------------------ panels ------------------------------ */

function StatusPanel({ detail, actionData }: { detail: Detail; actionData?: ActionResult }) {
  const { task, permissions } = detail;
  const [next, setNext] = React.useState<string>("");
  const navigation = useNavigation();
  const pending = navigation.state === "submitting" && navigation.formData?.get("intent") === "status";
  if (!permissions.statusOptions.length) return null;
  return (
    <Form method="post" preventScrollReset className="flex flex-col gap-3 border-t border-stroke-soft-200 p-4">
      <input type="hidden" name="intent" value="status" />
      <Field label="Move to" name="status">
        {(p) => (
          <Select {...p} value={next} onChange={(e) => setNext(e.target.value)} required>
            <option value="" disabled>Choose a status</option>
            {permissions.statusOptions.map((s) => <option key={s} value={s}>{task.status === "done" ? `Reopen as ${statusLabel(s)}` : statusLabel(s)}</option>)}
          </Select>
        )}
      </Field>
      {next === "blocked" ? (
        <Field label="What's blocking it?" name="blockerReason" required error={actionData?.intent === "status" ? actionData.fieldErrors.blockerReason : undefined} hint="Shown on the task in every view.">
          {(p) => <Textarea {...p} rows={3} maxLength={500} autoFocus />}
        </Field>
      ) : null}
      <Button type="submit" size="small" variant="neutral" mode="stroke" disabled={!next} pending={pending}>Update status</Button>
    </Form>
  );
}

function ProgressPanel({ detail }: { detail: Detail }) {
  const [value, setValue] = React.useState(detail.task.progress);
  React.useEffect(() => setValue(detail.task.progress), [detail.task.progress]);
  if (!detail.permissions.editable.progress || detail.task.status === "done") return null;
  return (
    <Form method="post" preventScrollReset className="flex items-end gap-2 border-t border-stroke-soft-200 p-4">
      <input type="hidden" name="intent" value="progress" />
      <div className="flex-1 space-y-1">
        <Label htmlFor="progress">Progress (%)</Label>
        <Input id="progress" name="progress" type="number" min={0} max={100} step={5} size="small" value={value} onChange={(e) => setValue(Number(e.target.value))} />
      </div>
      <Button type="submit" size="small" variant="neutral" mode="stroke" disabled={value === detail.task.progress}>Save</Button>
    </Form>
  );
}

function DetailsEditor({ detail, actionData, onDone }: { detail: Detail; actionData?: ActionResult; onDone: () => void }) {
  const { task } = detail;
  const errors = actionData?.intent === "details" ? actionData.fieldErrors : {};
  const navigation = useNavigation();
  return (
    <Card className="p-5">
      <Form method="post" preventScrollReset className="flex flex-col gap-4" onSubmit={() => setTimeout(onDone, 0)}>
        <input type="hidden" name="intent" value="details" />
        <Field label="Title" name="title" error={errors.title} required>
          {(p) => <Input {...p} defaultValue={task.title} maxLength={160} />}
        </Field>
        <Field label="Description" name="description" optional>
          {(p) => <Textarea {...p} defaultValue={task.description} rows={6} />}
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Priority" name="priority" error={errors.priority} required>
            {(p) => (
              <Select {...p} defaultValue={task.priority}>
                {[...TASK_PRIORITIES].reverse().map((pr) => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Assignee" name="assigneeId" error={errors.assigneeId}>
            {(p) => (
              <Select {...p} defaultValue={task.assigneeId ?? ""}>
                <option value="">Unassigned</option>
                {detail.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Due date" name="dueDate" error={errors.dueDate} optional>
            {(p) => <Input {...p} type="date" defaultValue={task.dueDate ?? ""} />}
          </Field>
        </div>
        <RelatedItemsPicker options={detail.references} defaultSelected={detail.related.map((r) => r.id)} />
        <div className="flex justify-end gap-2">
          <Button variant="neutral" mode="stroke" size="small" onClick={onDone}>Cancel</Button>
          <Button type="submit" size="small" pending={navigation.state === "submitting" && navigation.formData?.get("intent") === "details"}>Save changes</Button>
        </div>
      </Form>
    </Card>
  );
}

export default function TaskDetail({ loaderData }: Route.ComponentProps) {
  const detail = loaderData;
  const { task, permissions, related } = detail;
  const actionData = useActionData<ActionResult>();
  const location = useLocation();
  const back = (location.state as { from?: string } | null)?.from ?? "/tasks";
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => {
    if (actionData?.intent === "details") setEditing(true);
  }, [actionData]);
  const archived = !!task.archivedAt;

  return (
    <div className="flex flex-col gap-6">
      <Link to={back} className="inline-flex w-fit items-center gap-1.5 text-label-sm text-text-sub-600 hover:text-text-strong-950">
        <RiArrowLeftLine className="size-4" aria-hidden /> Back to tasks
      </Link>

      {actionData?.error ? <Alert tone="error" live>{actionData.error}</Alert> : null}
      {archived ? <Alert tone="warning" title="Archived">This task is read-only. A manager can restore it.</Alert> : null}

      <header className="flex flex-col gap-4 border-b border-stroke-soft-200 pb-5 md:flex-row md:items-start">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label-sm text-text-sub-600">#{task.number}</span>
            <TaskStatusBadge status={task.status} />
            <PriorityLabel priority={task.priority} />
            <DueLabel dueDate={task.dueDate} status={task.status} />
          </div>
          <h1 className="text-title-h5 text-text-strong-950">{task.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {permissions.canSelfAssign ? (
            <Form method="post" preventScrollReset>
              <input type="hidden" name="intent" value="self_assign" />
              <Button type="submit" size="small" leadingIcon={RiUserAddLine}>Assign to me</Button>
            </Form>
          ) : null}
          {permissions.editable.title && !editing ? (
            <Button size="small" variant="neutral" mode="stroke" leadingIcon={RiEditLine} onClick={() => setEditing(true)}>Edit</Button>
          ) : null}
          {permissions.canArchive ? (
            <ConfirmDialog
              title="Archive this task?"
              description="It leaves the active lists and becomes read-only. History is kept, and a manager can restore it."
              trigger={<Button size="small" variant="neutral" mode="stroke" leadingIcon={RiArchiveLine}>Archive</Button>}
            >
              <Form method="post">
                <input type="hidden" name="intent" value="archive" />
                <Button type="submit" variant="error" size="small">Archive task</Button>
              </Form>
            </ConfirmDialog>
          ) : null}
          {permissions.canRestore ? (
            <Form method="post">
              <input type="hidden" name="intent" value="restore" />
              <Button type="submit" size="small" variant="neutral" mode="stroke" leadingIcon={RiArrowGoBackLine}>Restore</Button>
            </Form>
          ) : null}
        </div>
      </header>

      {task.status === "blocked" ? (
        <div className="flex items-start gap-3 rounded-xl bg-error-lighter p-4" role="note" aria-label="Blocker">
          <RiErrorWarningFill className="size-5 shrink-0 text-error-base" aria-hidden />
          <div>
            <p className="text-label-sm text-text-strong-950">Blocked</p>
            <p className="text-paragraph-sm text-text-sub-600">{task.blockerReason}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {editing ? (
            <DetailsEditor detail={detail} actionData={actionData} onDone={() => setEditing(false)} />
          ) : (
            <Card className="p-5">
              <h2 className="text-label-md text-text-strong-950">Description</h2>
              <p className={cn("mt-2 whitespace-pre-line break-words text-paragraph-sm", task.description ? "text-text-strong-950" : "text-text-sub-600")}>
                {task.description || "No description."}
              </p>
            </Card>
          )}
          <Timeline detail={detail} actionData={actionData} />
        </div>

        <aside className="flex flex-col gap-6" aria-label="Task properties">
          <Card>
            <CardHeader title="Properties" />
            <dl className="space-y-3 p-4 text-paragraph-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-sub-600">Status</dt>
                <dd><TaskStatusBadge status={task.status} /></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-sub-600">Priority</dt>
                <dd><PriorityLabel priority={task.priority} /></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-sub-600">Assignee</dt>
                <dd className="flex items-center gap-2 text-text-strong-950">
                  <Avatar name={task.assigneeName} image={task.assigneeImage} size={24} />
                  {task.assigneeName ?? "Unassigned"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-sub-600">Due date</dt>
                <dd className="text-text-strong-950">{task.dueDate ? <DueLabel dueDate={task.dueDate} status={task.status} /> : "—"}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <dt className="text-text-sub-600">Progress</dt>
                <dd className="text-text-strong-950">{task.progress}%</dd>
                <dd className="w-full"><ProgressBar value={task.progress} label="Task progress" /></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-sub-600">Created by</dt>
                <dd className="text-text-strong-950">{task.creatorName ?? "Former member"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-sub-600">Created</dt>
                <dd className="text-text-strong-950"><Time value={task.createdAt} format="datetime" /></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-sub-600">Updated</dt>
                <dd className="text-text-strong-950"><Time value={task.updatedAt} format="datetime" /></dd>
              </div>
            </dl>
            <StatusPanel detail={detail} actionData={actionData} />
            <ProgressPanel detail={detail} />
          </Card>

          <Card>
            <CardHeader title="Related items" />
            {related.length ? (
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
            ) : (
              <EmptyState className="py-6" icon={RiLinksLine} title="No related items" />
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
