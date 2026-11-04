import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";
import type { Route } from "./+types/root";
import { RiCompass3Line, RiErrorWarningLine } from "@remixicon/react";
import { Link } from "react-router";
import "./app.css";
import { AppShell } from "~/components/layout/app-shell";
import { AccessDenied, Alert, EmptyState } from "~/components/ui/feedback";
import { Button } from "~/components/ui/button";
import { HUB } from "~/config/hub";
import { actorContext, cloudflareContext } from "~/server/context";
import { createDb } from "~/server/db";
import { unreadCount } from "~/server/notifications.server";
import { getActor, getDb, getEnv, loadActor, readFlash } from "~/server/request.server";

/** Resolves the signed-in user once per request, before any loader or action runs. */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }) => {
    const { env } = context.get(cloudflareContext);
    context.set(actorContext, await loadActor(env, request));
  },
  async (_args, next) => {
    const res = await next();
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    return res;
  },
];

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const actor = getActor(context);
  const db = getDb(context);
  const [{ flash, setCookie }, unread, image] = await Promise.all([
    readFlash(env, request),
    actor ? unreadCount(db, actor.id) : Promise.resolve(0),
    actor ? createDb(env.DB).query.user.findFirst({ where: (u, { eq }) => eq(u.id, actor.id), columns: { image: true } }).then((u) => u?.image ?? null) : Promise.resolve(null),
  ]);
  return data(
    { actor: actor ? { ...actor, image } : null, unread, flash },
    { headers: flash ? { "Set-Cookie": setCookie } : undefined },
  );
}

/** Applies the saved or system theme before first paint, so there is no flash. */
const themeScript = `(function(){try{var t=localStorage.getItem('hub-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})();`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Meta />
        <Links />
      </head>
      <body className="antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function useRootData() {
  return useRouteLoaderData<typeof loader>("root");
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { actor, unread, flash } = loaderData;
  return (
    <AppShell actor={actor} unread={unread}>
      {flash ? (
        <Alert tone={flash.tone === "information" ? "information" : flash.tone} live className="mb-6">
          {flash.message}
        </Alert>
      ) : null}
      <Outlet />
    </AppShell>
  );
}

export function meta() {
  return [{ title: HUB.name }, { name: "description", content: HUB.tagline }];
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const root = useRootData();
  const actor = root?.actor ?? null;
  let content: React.ReactNode;

  if (isRouteErrorResponse(error) && (error.status === 403 || error.status === 401)) {
    content = <AccessDenied signedIn={!!actor} message={typeof error.data?.message === "string" ? error.data.message : undefined} />;
  } else if (isRouteErrorResponse(error) && error.status === 404) {
    content = (
      <EmptyState
        icon={RiCompass3Line}
        title="Page not found"
        description={typeof error.data?.message === "string" ? error.data.message : "The page may have moved, or the link is incomplete."}
        action={
          <Button asChild variant="neutral" mode="stroke" size="small">
            <Link to="/">Back to home</Link>
          </Button>
        }
      />
    );
  } else {
    const detail = import.meta.env.DEV && error instanceof Error ? error.message : undefined;
    content = (
      <EmptyState
        icon={RiErrorWarningLine}
        title="Something went wrong"
        description={detail ?? "Please try again. If it keeps happening, let the team know through the feedback form."}
        action={
          <Button variant="neutral" mode="stroke" size="small" onClick={() => window.location.reload()}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <AppShell actor={actor} unread={root?.unread ?? 0}>
      {content}
    </AppShell>
  );
}
