import { Form, Link, useActionData, useNavigation } from "react-router";
import { RiArrowLeftLine, RiArrowRightSLine, RiHistoryLine, RiLinksLine } from "@remixicon/react";
import type { Route } from "./+types/foundations.token.$id";
import { Card, CardHeader } from "~/components/ui/page";
import { Alert, EmptyState } from "~/components/ui/feedback";
import { Avatar, Badge } from "~/components/ui/display";
import { Button } from "~/components/ui/button";
import { Field, Input, Select, Textarea } from "~/components/ui/form";
import { Time } from "~/components/ui/time";
import { Swatch, tokenHref, TRACK_OPTIONS, ValueText } from "~/components/foundations";
import { can } from "~/domain/permissions";
import {
  getToken,
  isColorLiteral,
  MODE_GROUPS,
  SECTIONS,
  TEXT_STYLE_PROPERTIES,
  TIER_LABELS,
  usedBy,
  valuesByMode,
  varyingGroup,
} from "~/foundations/model";
import { formString, getActor, getDb, getEnv, notFound, redirectWithFlash, requirePermission } from "~/server/request.server";
import { EMPTY_TRACKING, listUpdates, trackingFor, TrackingError, trackingUpdateSchema, updateTracking } from "~/server/foundations.server";
import { listMembers } from "~/server/tasks.server";

export const meta: Route.MetaFunction = ({ loaderData }) => [{ title: `${loaderData?.token.path ?? "Token"} · D.S Hub` }];

export async function loader({ params, context }: Route.LoaderArgs) {
  const token = getToken(params.id);
  if (!token) throw notFound("This token isn't in the current tokens file. It may have been renamed or removed.");
  const actor = getActor(context);
  const team = can(actor, "foundation.track");
  const db = getDb(context);
  const [tracking, history, members] = team
    ? await Promise.all([trackingFor(db, [token.id]), listUpdates(db, { page: 1, tokenId: token.id }), listMembers(db)])
    : [null, null, []];
  return {
    token: { id: token.id, path: token.path, name: token.name, section: token.section, tier: token.tier, set: token.set, type: token.type, description: token.description, webVar: token.webVar },
    team,
    tracking: tracking?.get(token.id) ?? { tokenId: token.id, ...EMPTY_TRACKING },
    history: history?.items ?? [],
    members: members.filter((m) => m.status === "active"),
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

const FIELD_NAMES: Record<string, string> = { design: "Design status", web: "Web status", mobile: "Mobile status", assignee: "Assignee", notes: "Notes", "docs link": "Docs link" };

export default function TokenDetail({ loaderData }: Route.ComponentProps) {
  const { token: t, team, tracking, history, members } = loaderData;
  const token = getToken(t.id)!;
  const data = useActionData<typeof action>();
  const navigation = useNavigation();
  const section = SECTIONS.find((s) => s.id === t.section)!;
  const isStyle = t.set === "typography-semantic";
  const group = varyingGroup(token);
  const consumers = usedBy(t.id);

  // Full reference chain under the default context, for the "Resolves through" list.
  const chain = valuesByMode(token)[0]?.resolved.chain ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Link to={`/foundations/${t.section}?tab=${t.tier}`} className="inline-flex w-fit items-center gap-1.5 text-label-sm text-text-sub-600 hover:text-text-strong-950">
        <RiArrowLeftLine className="size-4" aria-hidden /> {section.label} · {TIER_LABELS[t.tier]}
      </Link>

      <header className="space-y-3 border-b border-stroke-soft-200 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="blue">{section.label}</Badge>
          <Badge color="purple">{TIER_LABELS[t.tier]}</Badge>
          <Badge color="gray">{t.type}</Badge>
          {group ? <Badge color="teal">Varies by {MODE_GROUPS[group].label.toLowerCase()}</Badge> : null}
        </div>
        <h1 className="break-all font-mono text-title-h6 text-text-strong-950">{t.path}</h1>
        {t.webVar ? <p className="font-mono text-paragraph-sm text-text-sub-600">{t.webVar}</p> : null}
        {t.description ? <p className="max-w-2xl text-paragraph-md text-text-sub-600">{t.description}</p> : null}
      </header>

      {data?.error ? <Alert tone="error" live>{data.error}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader title="Values" description={group ? `Resolved for each ${MODE_GROUPS[group].label.toLowerCase()}.` : "Resolved value."} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left">
                <thead>
                  <tr className="bg-bg-weak-50 text-subheading-xs uppercase text-text-sub-600">
                    {isStyle ? <th scope="col" className="px-4 py-2 font-medium">Property</th> : null}
                    <th scope="col" className="px-4 py-2 font-medium">Mode</th>
                    <th scope="col" className="px-4 py-2 font-medium">Points to</th>
                    <th scope="col" className="px-4 py-2 font-medium">Resolved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke-soft-200">
                  {(isStyle ? TEXT_STYLE_PROPERTIES : [""]).flatMap((prop) =>
                    valuesByMode(token, prop).map((v) => (
                      <tr key={`${prop}-${v.mode}`}>
                        {isStyle ? <td className="px-4 py-2.5 font-mono text-paragraph-xs text-text-sub-600">{prop}</td> : null}
                        <td className="px-4 py-2.5 text-paragraph-sm text-text-strong-950">{v.mode}</td>
                        <td className="px-4 py-2.5">
                          {v.raw?.ref ? (
                            <Link to={tokenHref(v.raw.ref)} className="font-mono text-paragraph-xs text-primary-base hover:underline">
                              {v.raw.ref.split("--")[1]}
                            </Link>
                          ) : (
                            <span className="text-paragraph-xs text-text-sub-600">Literal value</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-2">
                            {isColorLiteral(v.resolved.value) ? <Swatch color={v.resolved.value} /> : null}
                            <ValueText token={token} value={v.resolved.value} property={prop} />
                          </span>
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {!isStyle && chain.length > 1 ? (
            <Card>
              <CardHeader title="Resolves through" />
              <ol className="flex flex-wrap items-center gap-1 p-4">
                <li className="font-mono text-paragraph-xs text-text-strong-950">{t.path}</li>
                {chain.map((id) => (
                  <li key={id} className="flex items-center gap-1">
                    <RiArrowRightSLine className="size-4 text-text-soft-400" aria-hidden />
                    <Link to={tokenHref(id)} className="font-mono text-paragraph-xs text-primary-base hover:underline">
                      {id.split("--")[1]}
                    </Link>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Used by" description={`${consumers.length} ${consumers.length === 1 ? "token points" : "tokens point"} to this token.`} />
            {consumers.length ? (
              <ul className="divide-y divide-stroke-soft-200">
                {consumers.slice(0, 50).map((c) => (
                  <li key={c.id}>
                    <Link to={tokenHref(c.id)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-weak-50">
                      <RiLinksLine className="size-4 text-text-soft-400" aria-hidden />
                      <span className="flex-1 font-mono text-paragraph-xs text-text-strong-950">{c.path}</span>
                      <Badge color="gray">{TIER_LABELS[c.tier]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState className="py-6" icon={RiLinksLine} title="Nothing points here" />
            )}
          </Card>
        </div>

        {team ? (
          <aside className="flex flex-col gap-6" aria-label="Tracking">
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
                        <span className="text-label-xs text-text-strong-950">{h.actorName ?? "Former member"}</span> changed {FIELD_NAMES[h.field ?? ""]?.toLowerCase() ?? h.field}
                        {h.toValue ? <> to <span className="text-label-xs text-text-strong-950">{h.toValue}</span></> : " (cleared)"} · <Time value={h.createdAt} />
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="p-4 text-paragraph-sm text-text-sub-600">No changes yet.</p>
              )}
            </Card>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
