import { notFound } from "~/server/request.server";

export function loader() {
  throw notFound();
}

export default function NotFound() {
  return null;
}
