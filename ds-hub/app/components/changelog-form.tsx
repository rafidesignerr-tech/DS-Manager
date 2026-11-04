import { Form, Link, useNavigation } from "react-router";
import { Alert } from "~/components/ui/feedback";
import { Button } from "~/components/ui/button";
import { Field, Input, Textarea } from "~/components/ui/form";
import { RelatedItemsPicker } from "~/components/related-items-picker";

type Values = { title: string; summary: string; details: string; entryDate: string; relatedItemIds: string[] };

export function ChangelogForm({
  defaults,
  references,
  error,
  fieldErrors = {},
  submitLabel,
  cancelTo,
}: {
  defaults: Values;
  references: { id: string; title: string; kind: string }[];
  error?: string | null;
  fieldErrors?: Record<string, string>;
  submitLabel: string;
  cancelTo: string;
}) {
  const navigation = useNavigation();
  return (
    <Form method="post" className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="intent" value="save" />
      {error ? <Alert tone="error" live>{error}</Alert> : null}
      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Title" name="title" error={fieldErrors.title} required className="md:col-span-2">
          {(p) => <Input {...p} defaultValue={defaults.title} maxLength={160} />}
        </Field>
        <Field label="Date" name="entryDate" error={fieldErrors.entryDate} required>
          {(p) => <Input {...p} type="date" defaultValue={defaults.entryDate} />}
        </Field>
      </div>
      <Field label="Summary" name="summary" error={fieldErrors.summary} required hint="One or two sentences shown in the list.">
        {(p) => <Textarea {...p} defaultValue={defaults.summary} rows={2} maxLength={500} />}
      </Field>
      <Field label="Details" name="details" error={fieldErrors.details} optional hint="Line breaks are kept.">
        {(p) => <Textarea {...p} defaultValue={defaults.details} rows={8} />}
      </Field>
      <RelatedItemsPicker options={references} defaultSelected={defaults.relatedItemIds} />
      <div className="flex justify-end gap-3 border-t border-stroke-soft-200 pt-5">
        <Button asChild variant="neutral" mode="stroke"><Link to={cancelTo}>Cancel</Link></Button>
        <Button type="submit" pending={navigation.state === "submitting" && navigation.formData?.get("intent") === "save"}>{submitLabel}</Button>
      </div>
    </Form>
  );
}
