import { Link } from "react-router";
import { RiBox3Line, RiNotification3Line } from "@remixicon/react";
import type { Route } from "./+types/product-kit";
import { Badge } from "~/components/ui/display";
import { Button } from "~/components/ui/button";

export const meta: Route.MetaFunction = () => [{ title: "Product Kit · D.S Hub" }];

/**
 * Coming-soon state (BRD §6.5). No inactive controls are shown. To enable the
 * section later, replace this route's component; the navigation entry already exists.
 */
export default function ProductKit() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-6 py-12 text-center" aria-labelledby="pk-title">
      <div className="relative">
        <div className="absolute inset-0 -m-6 rounded-full bg-primary-alpha-10" aria-hidden />
        <div className="relative flex size-20 items-center justify-center rounded-full bg-bg-white-0 shadow-regular-md ring-1 ring-inset ring-stroke-soft-200">
          <RiBox3Line className="size-9 text-primary-base" aria-hidden />
        </div>
      </div>
      <Badge color="blue">Coming soon</Badge>
      <div className="space-y-2">
        <h1 id="pk-title" className="text-title-h4 text-text-strong-950">Product Kit</h1>
        <p className="text-paragraph-md text-text-sub-600">
          Ready-made product patterns built from the system. This section isn't available yet. Follow the changelog to hear when it launches.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild variant="neutral" mode="stroke" leadingIcon={RiNotification3Line}>
          <Link to="/changelog">Follow the changelog</Link>
        </Button>
        <Button asChild variant="neutral" mode="ghost">
          <Link to="/feedback">Tell us what you need</Link>
        </Button>
      </div>
    </section>
  );
}
