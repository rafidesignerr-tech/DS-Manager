import * as React from "react";
import { RiSearchLine } from "@remixicon/react";
import { Checkbox, Input } from "~/components/ui/form";
import { Badge } from "~/components/ui/display";

type Option = { id: string; title: string; kind: string };

/** Searchable checklist that submits `relatedItemIds` values with the surrounding form. */
export function RelatedItemsPicker({ options, defaultSelected = [], name = "relatedItemIds" }: { options: Option[]; defaultSelected?: string[]; name?: string }) {
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(defaultSelected));
  const visible = options.filter((o) => o.title.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1">
        <span className="flex items-center gap-1 text-label-sm text-text-strong-950">
          Related items <span className="text-paragraph-sm text-text-sub-600">(Optional · {selected.size} selected)</span>
        </span>
      </legend>
      {options.length ? (
        <>
          <label htmlFor={`${name}-search`} className="sr-only">Filter related items</label>
          <Input id={`${name}-search`} type="search" size="small" placeholder="Filter items" leadingIcon={RiSearchLine} value={query} onChange={(e) => setQuery(e.target.value)} />
          <ul className="max-h-56 overflow-y-auto rounded-10 p-1 ring-1 ring-inset ring-stroke-soft-200">
            {visible.map((o) => (
              <li key={o.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-bg-weak-50">
                  <Checkbox name={name} value={o.id} checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                  <span className="flex-1 text-paragraph-sm text-text-strong-950">{o.title}</span>
                  <Badge color="gray">{o.kind}</Badge>
                </label>
              </li>
            ))}
            {!visible.length ? <li className="px-2 py-3 text-paragraph-sm text-text-sub-600">No matching items.</li> : null}
          </ul>
          {/* Selected items hidden by the filter still submit. */}
          {[...selected].filter((id) => !visible.some((v) => v.id === id)).map((id) => <input key={id} type="hidden" name={name} value={id} />)}
        </>
      ) : (
        <p className="text-paragraph-sm text-text-sub-600">No reference items exist yet.</p>
      )}
    </fieldset>
  );
}
