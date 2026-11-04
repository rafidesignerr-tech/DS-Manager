import { Form, Link, useActionData, useLocation, useNavigation } from "react-router";
import { RiArrowLeftLine, RiExternalLinkLine, RiHistoryLine, RiLinksLine } from "@remixicon/react";
import type { Route } from "./+types/components.$id";
import { Card, CardHeader } from "~/components/ui/page";
import { Alert } from "~/components/ui/feedback";
import { Avatar, Badge, SampleBadge } from "~/components/ui/display";
import { Button } from "~/components/ui/button";
import { Field, Input, Select, Textarea } from "~/components/ui/form";
import { Time } from "~/components/ui/time";
import { levelLabel, ReferenceDetail, ReferenceStatus } from "~/components/reference-detail";
import { ComponentPreview } from "~/components/component-preview";
import { TRACK_OPTIONS } from "~/components/foundations";
import { figmaUrl, getComponentEntry, isBuildingBlock, type ComponentSet } from "~/catalog/components";
import { can } from "~/domain/permissions";
import { formString, getActor, getDb, getEnv, notFound, redirectWithFlash, requirePermission } from "~/server/request.server";
import { getReferenceItem } from "~/server/reference.server";
import { EMPTY_TRACKING, listUpdates, trackingFor, TrackingError, trackingUpdateSchema, updateTracking } from "~/server/foundations.server";
import { listMembers } from "~/server/tasks.server";

export const meta: Route.MetaFunction = ({ loaderData }) => [{ title: `${loaderData?.item.title ?? "Component"} · D.S Hub` }];

export async function loader({ params, context }: Route.LoaderArgs) {
  const db = getDb(context);
  const detail = await getReferenceItem(db, "component", params.id);
  if (!detail) throw notFound("This component doesn't exist.");
  const entry = getComponentEntry(params.id) ?? null;
  const team = !!entry && can(getActor(context), "foundation.track");
  const [tracking, history, members] = team
    ? await Promise.all([trackingFor(db, [params.id]), listUpdates(db, { page: 1, tokenId: params.id, targetType: "component" }), listMembers(db)])
    : [null, null, []];
  return {
    ...detail,
    entry,
    team,
    tracking: tracking?.get(params.id) ?? { tokenId: params.id, ...EMPTY_TRACKING },
    history: history?.items ?? [],
    members: members.filter((m) => m.status === "active").map((m) => ({ id: m.id, name: m.name })),
  };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const actor = requirePermission(context, request, "foundation.track");
  const form = await request.formData();
  const parsed = trackingUpdateSchema.safeParse({
    designStatus: formString(form, "designStatus"),
    webStatus: formString(form, "webStatus"),
    mobileStatus: formString(form, "mobileStatus"),
    assigneeId: formString(form, "assigneeId"),
    notes: formString(form, "notes"),
    docsUrl: formString(form, "docsUrl"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the values." };
  try {
    await updateTracking(getDb(context), actor, params.id, parsed.data);
  } catch (e) {
    if (e instanceof TrackingError) return { error: e.message };
    throw e;
  }
  return redirectWithFlash(getEnv(context), request, new URL(request.url).pathname, { tone: "success", message: "Tracking saved." });
}

const KIND_BADGE: Record<ComponentSet["kind"], { label: string; color: "gray" | "red" } | null> = {
  public: null,
  internal: { label: "Internal part", color: "gray" },
  deprecated: { label: "Deprecated", color: "red" },
};

const FIELD_NAMES: Record<string, string> = { design: "design status", web: "web status", mobile: "mobile status", assignee: "assignee", notes: "notes", "docs link": "docs link" };

function SetCard({ set }: { set: ComponentSet }) {
  const badge = KIND_BADGE[set.kind];
  const axes = Object.entries(set.axes);
  return (
    <Card as="li">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stroke-soft-200 p-4">
        <div className="min-w-0 space-y-1">
          <h3 className="flex flex-wrap items-center gap-2 text-label-md text-text-strong-950">
            {set.name}
            {badge ? <Badge color={badge.color}>{badge.label}</Badge> : null}
          </h3>
          <p className="font-mono text-paragraph-xs text-text-sub-600">{set.figmaName}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-paragraph-xs text-text-sub-600">
            {set.variants} {set.variants === 1 ? "variant" : "variants"}
          </span>
          <a href={figmaUrl(set.figmaId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-label-xs text-primary-base hover:underline">
            Open in Figma <RiExternalLinkLine className="size-3.5" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </div>
      <div className="space-y-4 p-4">
        {set.description ? <p className="whitespace-pre-line text-paragraph-sm text-text-sub-600">{set.description}</p> : null}
        {axes.length ? (
          <div className="space-y-2">
            <h4 className="text-subheading-xs uppercase text-text-sub-600">Variants</h4>
            <dl className="space-y-2">
              {axes.map(([name, options]) => (
                <div key={name} className="grid gap-1 sm:grid-cols-[160px_1fr]">
                  <dt className="text-label-sm text-text-strong-950">{name}</dt>
                  <dd className="flex flex-wrap gap-1">
                    {options.map((o) => (
                      <span key={o} className="rounded-md bg-bg-weak-50 px-1.5 py-0.5 text-paragraph-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">
                        {o}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
        {set.properties.length ? (
          <div className="space-y-2">
            <h4 className="text-subheading-xs uppercase text-text-sub-600">Properties</h4>
            <ul className="flex flex-wrap gap-1.5">
              {set.properties.map((p, i) => (
                <li key={`${p.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-md bg-bg-white-0 px-2 py-1 text-paragraph-xs ring-1 ring-inset ring-stroke-soft-200">
                  <span className="text-text-strong-950">{p.name}</span>
                  <span className="text-text-sub-600">{p.type}</span>
                </li>
              ))}
              {set.moreProperties ? <li className="px-2 py-1 text-paragraph-xs text-text-sub-600">+{set.moreProperties} more in Figma</li> : null}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function Linked({ title, items, empty }: { title: string; items: { id: string; title: string }[]; empty: string }) {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return (
    <Card>
      <CardHeader title={title} />
      {items.length ? (
        <ul className="divide-y divide-stroke-soft-200">
          {items.map((r) => (
            <li key={r.id}>
              <Link to={`/components/${r.id}`} state={{ from }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-weak-50">
                <RiLinksLine className="size-4 text-text-soft-400" aria-hidden />
                <span className="flex-1 text-label-sm text-text-strong-950">{r.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-paragraph-sm text-text-sub-600">{empty}</p>
      )}
    </Card>
  );
}

export default function ComponentDetail({ loaderData }: Route.ComponentProps) {
  const { item, groupLabel, uses, usedBy, related, entry, team, tracking, history, members } = loaderData;
  const location = useLocation();
  const data = useActionData<typeof action>();
  const navigation = useNavigation();

  // Items without catalog details (e.g. old sample rows) keep the generic layout.
  if (!entry) return <ReferenceDetail listHref="/components" listLabel="Components" item={item} groupLabel={groupLabel} uses={uses} usedBy={usedBy} related={related} />;

  const back = (location.state as { from?: string } | null)?.from ?? "/components";
  const order = { public: 0, internal: 1, deprecated: 2 } as const;
  const sets = [...entry.sets].sort((a, b) => order[a.kind] - order[b.kind]);

  return (
    <div className="flex flex-col gap-6">
      <Link to={back} className="inline-flex w-fit items-center gap-1.5 text-label-sm text-text-sub-600 hover:text-text-strong-950">
        <RiArrowLeftLine className="size-4" aria-hidden /> Back to Components
      </Link>

      <header className="flex flex-col gap-5 border-b border-stroke-soft-200 pb-6 lg:flex-row lg:items-start">
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="blue">{groupLabel}</Badge>
            {item.level ? <Badge color="purple">{levelLabel(item.level)}</Badge> : null}
            {isBuildingBlock(entry) ? <Badge color="gray">Building block</Badge> : null}
            <ReferenceStatus status={item.status} />
            {item.isSample ? <SampleBadge /> : null}
          </div>
          <h1 className="text-title-h5 text-text-strong-950">{item.title}</h1>
          <p className="max-w-2xl text-paragraph-md text-text-sub-600">{item.summary}</p>
          {isBuildingBlock(entry) ? (
            <p className="max-w-2xl text-paragraph-sm text-text-sub-600">Building block: its parts are used inside other components rather than placed on screens directly.</p>
          ) : null}
          <a href={figmaUrl(entry.figmaPage)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-label-sm text-primary-base hover:underline">
            Open the Figma page <RiExternalLinkLine className="size-4" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
        <ComponentPreview id={entry.id} alt={`${item.title} preview`} className="h-48 w-full rounded-2xl lg:w-96" />
      </header>

      {data?.error ? <Alert tone="error" live>{data.error}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section aria-labelledby="sets-heading" className="space-y-3">
            <h2 id="sets-heading" className="text-label-lg text-text-strong-950">
              Component sets <span className="text-text-sub-600">· {entry.sets.length}</span>
            </h2>
            <ul className="flex flex-col gap-4">
              {sets.map((s) => (
                <SetCard key={s.figmaId} set={s} />
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          {team ? (
            <>
              <Card>
                <CardHeader title="Tracking" description={tracking.updatedAt ? <>Last updated <Time value={tracking.updatedAt} /></> : "Not started yet."} />
                <Form method="post" className="flex flex-col gap-4 p-4" key={String(tracking.updatedAt)}>
                  {(["designStatus", "webStatus", "mobileStatus"] as const).map((f) => (
                    <Field key={f} label={f === "designStatus" ? "Design" : f === "webStatus" ? "Web" : "Mobile"} name={f}>
                      {(p) => (
                        <Select {...p} defaultValue={tracking[f]}>
                          {TRACK_OPTIONS.map((o) => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  ))}
                  <Field label="Assignee" name="assigneeId">
                    {(p) => (
                      <Select {...p} defaultValue={tracking.assigneeId ?? ""}>
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Docs link" name="docsUrl" optional>
                    {(p) => <Input {...p} type="url" defaultValue={tracking.docsUrl ?? ""} placeholder="https://" />}
                  </Field>
                  <Field label="Notes" name="notes" optional>
                    {(p) => <Textarea {...p} rows={4} defaultValue={tracking.notes} maxLength={5000} />}
                  </Field>
                  <Button type="submit" size="small" pending={navigation.state === "submitting"}>Save tracking</Button>
                </Form>
              </Card>
              <Card>
                <CardHeader title="History" action={<RiHistoryLine className="size-5 text-text-soft-400" aria-hidden />} />
                {history.length ? (
                  <ol className="space-y-3 p-4">
                    {history.map((h) => (
                      <li key={h.id} className="flex items-start gap-2">
                        <Avatar name={h.actorName} image={h.actorImage} size={24} />
                        <p className="text-paragraph-xs text-text-sub-600">
                          <span className="text-label-xs text-text-strong-950">{h.actorName ?? "Former member"}</span> changed {FIELD_NAMES[h.field ?? ""] ?? h.field}
                          {h.toValue ? <> to <span className="text-label-xs text-text-strong-950">{h.toValue}</span></> : " (cleared)"} · <Time value={h.createdAt} />
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="p-4 text-paragraph-sm text-text-sub-600">No changes yet.</p>
                )}
              </Card>
            </>
          ) : null}
          <Linked title="Built with" items={uses} empty="Doesn't use other library components." />
          <Linked title="Used by" items={usedBy} empty="No other component uses this one." />
        </div>
      </div>
    </div>
  );
}
