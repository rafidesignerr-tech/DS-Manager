import { Link } from "react-router";
import { RiArrowRightLine, RiPaletteLine } from "@remixicon/react";
import type { Route } from "./+types/foundations";
import { Card, PageHeader } from "~/components/ui/page";
import { Badge } from "~/components/ui/display";
import { DoneBar, FoundationNav, Swatch } from "~/components/foundations";
import { can } from "~/domain/permissions";
import { allTokens, getToken, resolve, SECTIONS, sectionStats, tokenId, type SectionId } from "~/foundations/model";
import { getActor, getDb } from "~/server/request.server";
import { allTracking } from "~/server/foundations.server";

export const meta: Route.MetaFunction = () => [{ title: "Foundations · D.S Hub" }];

/** A few representative values per section for the card preview. */
const PREVIEWS: Record<SectionId, string[]> = {
  colors: ["colors.purple.500", "colors.purple.300", "colors.green.700", "colors.yellow.600", "colors.red.600", "colors.coolgray.700"],
  typography: [],
  spacing: [],
  radius: [],
  elevation: [],
  layout: [],
};

export async function loader({ context }: Route.LoaderArgs) {
  const actor = getActor(context);
  const team = can(actor, "foundation.track");
  const sections = SECTIONS.map((s) => ({
    ...s,
    stats: sectionStats(s.id),
    swatches: PREVIEWS[s.id].map((p) => getToken(tokenId("primitives", p))).filter(Boolean).map((t) => String(resolve(t!).value)),
  }));
  if (!team) return { sections, progress: null, team };
  const rows = await allTracking(getDb(context));
  const bySection = new Map(allTokens().map((t) => [t.id, t.section]));
  const progress: Record<string, { design: number; web: number; mobile: number }> = {};
  for (const r of rows) {
    const sec = bySection.get(r.tokenId);
    if (!sec) continue;
    const p = (progress[sec] ??= { design: 0, web: 0, mobile: 0 });
    if (r.designStatus === "done") p.design++;
    if (r.webStatus === "done") p.web++;
    if (r.mobileStatus === "done") p.mobile++;
  }
  return { sections, progress, team };
}

export default function Foundations({ loaderData }: Route.ComponentProps) {
  const { sections, progress, team } = loaderData;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={RiPaletteLine} title="Foundations" description="The base decisions every component builds on: tokens, values and how to use them." />
      <FoundationNav showUpdates={team} />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((s) => {
          const p = progress?.[s.id];
          return (
            <Card as="li" key={s.id} className="flex flex-col">
              <Link to={`/foundations/${s.id}`} className="group flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-1 text-label-lg text-text-strong-950">
                      {s.label}
                      <RiArrowRightLine className="size-4 text-text-soft-400 transition group-hover:translate-x-0.5" aria-hidden />
                    </h2>
                    <p className="mt-1 text-paragraph-sm text-text-sub-600">{s.description}</p>
                  </div>
                  <span className="text-title-h5 text-text-strong-950">{s.stats.total}</span>
                </div>
                {s.swatches.length ? (
                  <div className="flex gap-1.5" aria-hidden>
                    {s.swatches.map((c) => (
                      <Swatch key={c} color={c} />
                    ))}
                  </div>
                ) : null}
                <div className="mt-auto flex flex-wrap gap-2">
                  {s.stats.scale ? <Badge color="gray">{s.stats.scale} scale</Badge> : null}
                  {s.stats.primitive ? <Badge color="blue">{s.stats.primitive} primitive</Badge> : null}
                  {s.stats.semantic ? <Badge color="purple">{s.stats.semantic} semantic</Badge> : null}
                </div>
              </Link>
              {team ? (
                <div className="space-y-2 border-t border-stroke-soft-200 p-5">
                  <DoneBar label="Design" done={p?.design ?? 0} total={s.stats.total} />
                  <DoneBar label="Web" done={p?.web ?? 0} total={s.stats.total} />
                  <DoneBar label="Mobile" done={p?.mobile ?? 0} total={s.stats.total} />
                </div>
              ) : null}
            </Card>
          );
        })}
      </ul>
    </div>
  );
}
