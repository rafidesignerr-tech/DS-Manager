import type { Route } from "./+types/components.$id";
import { ReferenceDetail } from "~/components/reference-detail";
import { getDb, notFound } from "~/server/request.server";
import { getReferenceItem } from "~/server/reference.server";

export const meta: Route.MetaFunction = ({ loaderData }) => [{ title: `${loaderData?.item.title ?? "Component"} · D.S Hub` }];

export async function loader({ params, context }: Route.LoaderArgs) {
  const detail = await getReferenceItem(getDb(context), "component", params.id);
  if (!detail) throw notFound("This component doesn't exist.");
  return detail;
}

export default function ComponentDetail({ loaderData }: Route.ComponentProps) {
  return <ReferenceDetail listHref="/components" listLabel="Components" {...loaderData} />;
}
