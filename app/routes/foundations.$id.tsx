import type { Route } from "./+types/foundations.$id";
import { ReferenceDetail } from "~/components/reference-detail";
import { getDb, notFound } from "~/server/request.server";
import { getReferenceItem } from "~/server/reference.server";

export const meta: Route.MetaFunction = ({ loaderData }) => [{ title: `${loaderData?.item.title ?? "Foundation"} · D.S Hub` }];

export async function loader({ params, context }: Route.LoaderArgs) {
  const detail = await getReferenceItem(getDb(context), "foundation", params.id);
  if (!detail) throw notFound("This foundation entry doesn't exist.");
  return detail;
}

export default function FoundationDetail({ loaderData }: Route.ComponentProps) {
  return <ReferenceDetail listHref="/foundations" listLabel="Foundations" {...loaderData} />;
}
