import * as Accordion from "@radix-ui/react-accordion";
import { Form, Link, useSearchParams } from "react-router";
import { RiArrowDownSLine, RiPaletteLine, RiSearchLine } from "@remixicon/react";
import type { Route } from "./+types/foundations";
import { PageHeader } from "~/components/ui/page";
import { Input } from "~/components/ui/form";
import { EmptyState } from "~/components/ui/feedback";
import { Badge, SampleBadge } from "~/components/ui/display";
import { getDb } from "~/server/request.server";
import { listGroups, listReferenceItems, parseReferenceFilters } from "~/server/reference.server";

export const meta: Route.MetaFunction = () => [{ title: "Foundations · D.S Hub" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = getDb(context);
  const filters = parseReferenceFilters(new URL(request.url));
  const [groups, { items }] = await Promise.all([
    listGroups(db, "foundation"),
    listReferenceItems(db, "foundation", { ...filters, sort: "title", dir: "asc" }, { paginate: false }),
  ]);
  return {
    q: filters.q,
    groups: groups.map((g) => ({ ...g, items: items.filter((i) => i.groupKey === g.key) })),
  };
}

export default function Foundations({ loaderData }: Route.ComponentProps) {
  const { groups, q } = loaderData;
  const [params] = useSearchParams();
  const visible = q ? groups.filter((g) => g.items.length) : groups;
  const openByDefault = visible.map((g) => g.key);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={RiPaletteLine} title="Foundations" description="The base decisions every component builds on." />

      <Form method="get" role="search" className="max-w-md" preventScrollReset>
        <label htmlFor="foundation-search" className="sr-only">Search foundations</label>
        <Input id="foundation-search" name="q" type="search" defaultValue={q} placeholder="Search foundations" leadingIcon={RiSearchLine} />
      </Form>

      {!groups.length ? (
        <EmptyState icon={RiPaletteLine} title="No foundation groups yet" description="Groups appear here once content is added." />
      ) : !visible.length ? (
        <EmptyState
          icon={RiSearchLine}
          title={`No results for “${q}”`}
          description="Try a different term."
          action={<Link to="?" className="text-label-sm text-primary-base hover:underline">Clear search</Link>}
        />
      ) : (
        <Accordion.Root type="multiple" defaultValue={openByDefault} key={params.toString()} className="flex flex-col gap-3">
          {visible.map((group) => (
            <Accordion.Item key={group.key} value={group.key} className="overflow-hidden rounded-2xl bg-bg-white-0 ring-1 ring-inset ring-stroke-soft-200">
              <Accordion.Header asChild>
                <h2>
                  <Accordion.Trigger className="group flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-bg-weak-50 focus-visible:bg-bg-weak-50">
                    <span className="flex-1">
                      <span className="block text-label-md text-text-strong-950">{group.label}</span>
                      {group.description ? <span className="block text-paragraph-xs text-text-sub-600">{group.description}</span> : null}
                    </span>
                    <Badge color="gray">{group.items.length}</Badge>
                    <RiArrowDownSLine className="size-5 text-text-sub-600 transition group-data-[state=open]:rotate-180" aria-hidden />
                  </Accordion.Trigger>
                </h2>
              </Accordion.Header>
              <Accordion.Content className="border-t border-stroke-soft-200">
                {group.items.length ? (
                  <ul className="divide-y divide-stroke-soft-200">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <Link
                          to={`/foundations/${item.id}`}
                          state={{ from: `/foundations${params.toString() ? `?${params}` : ""}` }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-bg-weak-50"
                        >
                          <span className="size-8 shrink-0 rounded-lg bg-bg-soft-200 ring-1 ring-inset ring-stroke-soft-200" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-label-sm text-text-strong-950">{item.title}</span>
                            <span className="block truncate text-paragraph-xs text-text-sub-600">{item.value ?? item.summary}</span>
                          </span>
                          {item.isSample ? <SampleBadge /> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-paragraph-sm text-text-sub-600">No entries in this group yet.</p>
                )}
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      )}
    </div>
  );
}
