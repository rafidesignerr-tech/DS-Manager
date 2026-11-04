import { Form, useSearchParams, useSubmit } from "react-router";
import { RiSearchLine } from "@remixicon/react";
import { Input, Select } from "~/components/ui/form";

export type ToolbarSelect = {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  /** Label for the empty option, e.g. "All categories". Omit to require a value. */
  allLabel?: string;
};

/**
 * GET form for list pages. Filters apply on change (with JavaScript) or with the
 * Apply button; the URL always holds the state, so views are linkable.
 */
export function CatalogToolbar({ searchLabel, q, selects, keep = [] }: { searchLabel: string; q: string; selects: ToolbarSelect[]; keep?: string[] }) {
  const submit = useSubmit();
  const [params] = useSearchParams();
  return (
    <Form
      method="get"
      role="search"
      preventScrollReset
      className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end"
      onChange={(e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === "SELECT") submit(e.currentTarget, { preventScrollReset: true, replace: true });
      }}
    >
      {keep.map((k) => {
        const v = params.get(k);
        return v ? <input key={k} type="hidden" name={k} value={v} /> : null;
      })}
      <div className="md:w-72">
        <label htmlFor="catalog-search" className="sr-only">
          {searchLabel}
        </label>
        <Input id="catalog-search" name="q" type="search" defaultValue={q} placeholder={searchLabel} leadingIcon={RiSearchLine} size="small" key={q} />
      </div>
      {selects.map((s) => (
        <div key={s.name} className="md:w-44">
          <label htmlFor={`filter-${s.name}`} className="sr-only">
            {s.label}
          </label>
          <Select id={`filter-${s.name}`} name={s.name} defaultValue={s.value} size="small" key={`${s.name}-${s.value}`}>
            {s.allLabel !== undefined ? <option value="">{s.allLabel}</option> : null}
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      ))}
      <button type="submit" className="h-9 rounded-lg px-3 text-label-sm text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200 hover:bg-bg-weak-50">
        Apply
      </button>
    </Form>
  );
}
