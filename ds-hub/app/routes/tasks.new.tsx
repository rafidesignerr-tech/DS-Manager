import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import { RiArrowLeftLine } from "@remixicon/react";
import type { Route } from "./+types/tasks.new";
import { PageHeader } from "~/components/ui/page";
import { Alert } from "~/components/ui/feedback";
import { Button } from "~/components/ui/button";
import { Field, Input, Select, Textarea } from "~/components/ui/form";
import { RelatedItemsPicker } from "~/components/related-items-picker";
import { TASK_PRIORITIES } from "~/domain/tasks";
import { formString, getDb, getEnv, redirectWithFlash, requirePermission } from "~/server/request.server";
import { createTask, createTaskSchema, listMembers, TaskError } from "~/server/tasks.server";
import { referencePickerOptions } from "~/server/reference.server";

export const meta: Route.MetaFunction = () => [{ title: "Create task · D.S Hub" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  requirePermission(context, request, "task.create");
  const db = getDb(context);
  const [members, references] = await Promise.all([listMembers(db), referencePickerOptions(db)]);
  return { members: members.filter((m) => m.status === "active"), references };
}

export async function action({ request, context }: Route.ActionArgs) {
  const actor = requirePermission(context, request, "task.create");
  const form = await request.formData();
  const parsed = createTaskSchema.safeParse({
    title: formString(form, "title"),
    description: formString(form, "description"),
    status: formString(form, "status") || undefined,
    priority: formString(form, "priority") || undefined,
    assigneeId: formString(form, "assigneeId"),
    dueDate: formString(form, "dueDate"),
    relatedItemIds: form.getAll("relatedItemIds").filter((v): v is string => typeof v === "string"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Check the highlighted fields.", fieldErrors };
  }
  try {
    const id = await createTask(getDb(context), actor, parsed.data);
    return redirectWithFlash(getEnv(context), request, `/tasks/${id}`, { tone: "success", message: "Task created." });
  } catch (e) {
    if (e instanceof TaskError) return { error: e.message, fieldErrors: e.fieldErrors };
    throw e;
  }
}

export default function NewTask({ loaderData }: Route.ComponentProps) {
  const data = useActionData<typeof action>();
  const navigation = useNavigation();
  const errors: Record<string, string> = data?.fieldErrors ?? {};
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link to="/tasks" className="inline-flex w-fit items-center gap-1.5 text-label-sm text-text-sub-600 hover:text-text-strong-950">
        <RiArrowLeftLine className="size-4" aria-hidden /> Back to tasks
      </Link>
      <PageHeader title="Create task" description="Saved tasks are visible to the whole team." />
      <Form method="post" className="flex flex-col gap-5" noValidate>
        {data?.error ? <Alert tone="error" live>{data.error}</Alert> : null}
        <Field label="Title" name="title" error={errors.title} required>
          {(p) => <Input {...p} maxLength={160} autoFocus />}
        </Field>
        <Field label="Description" name="description" error={errors.description} optional hint="Context, acceptance criteria, links. Line breaks are kept.">
          {(p) => <Textarea {...p} rows={6} />}
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Start in" name="status" error={errors.status}>
            {(p) => (
              <Select {...p} defaultValue="backlog">
                <option value="backlog">Backlog: not ready yet</option>
                <option value="todo">To do: ready to pick up</option>
              </Select>
            )}
          </Field>
          <Field label="Priority" name="priority" error={errors.priority} required>
            {(p) => (
              <Select {...p} defaultValue="medium">
                {[...TASK_PRIORITIES].reverse().map((pr) => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Assignee" name="assigneeId" error={errors.assigneeId} optional hint="Leave unassigned so a contributor can pick it up.">
            {(p) => (
              <Select {...p} defaultValue="">
                <option value="">Unassigned</option>
                {loaderData.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Due date" name="dueDate" error={errors.dueDate} optional>
            {(p) => <Input {...p} type="date" />}
          </Field>
        </div>
        <RelatedItemsPicker options={loaderData.references} />
        <div className="flex justify-end gap-3 border-t border-stroke-soft-200 pt-5">
          <Button asChild variant="neutral" mode="stroke"><Link to="/tasks">Cancel</Link></Button>
          <Button type="submit" pending={navigation.state === "submitting"}>Create task</Button>
        </div>
      </Form>
    </div>
  );
}
