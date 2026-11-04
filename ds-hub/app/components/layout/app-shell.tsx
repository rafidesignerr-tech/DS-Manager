import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Form, Link, NavLink, useLocation, useNavigation } from "react-router";
import {

  RiBox3Line,
  RiCloseLine,
  RiContrast2Line,
  RiFeedbackLine,
  RiGridLine,
  RiHistoryLine,
  RiHome5Line,
  RiLayoutGridLine,
  RiLogoutBoxRLine,
  RiMenuLine,
  RiNotification3Line,
  RiPaletteLine,
  RiShapesLine,
  RiTaskLine,
  RiTeamLine,
  RiUser3Line,
  RiInbox2Line,
  RiArticleLine,
} from "@remixicon/react";
import { HUB } from "~/config/hub";
import type { Actor, Permission } from "~/domain/permissions";
import { can, ROLE_LABELS } from "~/domain/permissions";
import { cn } from "~/lib/cn";
import { Avatar, Badge } from "~/components/ui/display";
import { Button } from "~/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "~/components/ui/overlay";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
  badge?: "soon" | "count";
  end?: boolean;
};

const PUBLIC_NAV: NavItem[] = [
  { to: "/", label: "Home", icon: RiHome5Line, permission: "reference.view", end: true },
  { to: "/foundations", label: "Foundations", icon: RiPaletteLine, permission: "reference.view" },
  { to: "/components", label: "Components", icon: RiShapesLine, permission: "reference.view" },
  { to: "/icons", label: "Icons", icon: RiGridLine, permission: "reference.view" },
  { to: "/product-kit", label: "Product Kit", icon: RiBox3Line, permission: "reference.view", badge: "soon" },
  { to: "/changelog", label: "Changelog", icon: RiHistoryLine, permission: "changelog.viewPublished" },
  { to: "/feedback", label: "Feedback", icon: RiFeedbackLine, permission: "feedback.submit" },
];

const WORKSPACE_NAV: NavItem[] = [
  { to: "/tasks", label: "Tasks", icon: RiTaskLine, permission: "task.view" },
  { to: "/notifications", label: "Notifications", icon: RiNotification3Line, permission: "notifications.view", badge: "count" },
];

const MANAGE_NAV: NavItem[] = [
  { to: "/manage/feedback", label: "Feedback inbox", icon: RiInbox2Line, permission: "feedback.view" },
  { to: "/manage/changelog", label: "Changelog entries", icon: RiArticleLine, permission: "changelog.viewDrafts" },
  { to: "/team", label: "Team", icon: RiTeamLine, permission: "team.manage" },
];

function NavSection({ title, items, actor, unread, onNavigate }: { title: string; items: NavItem[]; actor: Actor | null; unread: number; onNavigate?: () => void }) {
  const visible = items.filter((i) => can(actor, i.permission));
  if (!visible.length) return null;
  return (
    <div className="space-y-2">
      <p className="px-3 text-subheading-xs uppercase text-text-sub-600">{title}</p>
      <ul className="space-y-1">
        {visible.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-2 rounded-lg px-3 py-2 text-label-sm transition duration-200",
                  isActive ? "bg-bg-weak-50 text-text-strong-950" : "text-text-sub-600 hover:bg-bg-weak-50 hover:text-text-strong-950",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn("absolute -left-5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-base transition", isActive ? "opacity-100" : "opacity-0")} aria-hidden />
                  <item.icon className={cn("size-5 shrink-0", isActive ? "text-primary-base" : "text-text-soft-400 group-hover:text-text-sub-600")} aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  {item.badge === "soon" ? <Badge color="gray">Soon</Badge> : null}
                  {item.badge === "count" && unread > 0 ? (
                    <Badge color="red">
                      {unread > 99 ? "99+" : unread}
                      <span className="sr-only"> unread</span>
                    </Badge>
                  ) : null}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3 rounded-lg p-1">
      <span className="flex size-10 items-center justify-center rounded-full bg-primary-base text-static-white" aria-hidden>
        <RiLayoutGridLine className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-label-sm text-text-strong-950">{HUB.name}</span>
        <span className="block truncate text-paragraph-xs text-text-sub-600">Design system hub</span>
      </span>
    </Link>
  );
}

function SidebarNav({ actor, unread, onNavigate }: { actor: Actor | null; unread: number; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      <NavSection title="Browse" items={PUBLIC_NAV} actor={actor} unread={unread} onNavigate={onNavigate} />
      <NavSection title="Workspace" items={WORKSPACE_NAV} actor={actor} unread={unread} onNavigate={onNavigate} />
      <NavSection title="Manage" items={MANAGE_NAV} actor={actor} unread={unread} onNavigate={onNavigate} />
    </nav>
  );
}

function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const dark = !root.classList.contains("dark");
    root.classList.toggle("dark", dark);
    try {
      localStorage.setItem("hub-theme", dark ? "dark" : "light");
    } catch {
      /* storage unavailable: the choice lasts for this page view */
    }
  };
  return (
    <Button variant="neutral" mode="ghost" size="small" iconOnly onClick={toggle} aria-label="Toggle dark mode">
      <RiContrast2Line className="size-5" aria-hidden />
    </Button>
  );
}

function AccountMenu({ actor }: { actor: Actor & { image?: string | null } }) {
  return (
    <Dropdown>
      <DropdownTrigger className="flex items-center gap-2 rounded-10 p-1 pr-2 hover:bg-bg-weak-50 focus-visible:shadow-button-important-focus">
        <span aria-hidden><Avatar name={actor.name} image={actor.image} size={32} /></span>
        <span className="sr-only lg:hidden">{actor.name}, account menu</span>
        <span className="hidden text-left lg:block">
          <span className="block max-w-36 truncate text-label-sm text-text-strong-950">{actor.name}</span>
          <span className="block text-paragraph-xs text-text-sub-600">{ROLE_LABELS[actor.role]}</span>
        </span>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownLabel>{actor.email}</DropdownLabel>
        <DropdownItem asChild>
          <Link to="/profile">
            <RiUser3Line className="size-5 text-text-sub-600" aria-hidden /> Profile
          </Link>
        </DropdownItem>
        <DropdownSeparator />
        <Form method="post" action="/sign-out">
          <DropdownItem asChild>
            <button type="submit" className="w-full">
              <RiLogoutBoxRLine className="size-5 text-text-sub-600" aria-hidden /> Sign out
            </button>
          </DropdownItem>
        </Form>
      </DropdownContent>
    </Dropdown>
  );
}

function NavigationProgress() {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5" aria-hidden>
      <div className={cn("h-full bg-primary-base transition-all duration-500 ease-out", busy ? "w-3/4 opacity-100" : "w-full opacity-0")} />
    </div>
  );
}

export function AppShell({ actor, unread, children }: { actor: (Actor & { image?: string | null }) | null; unread: number; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const location = useLocation();
  React.useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="min-h-dvh bg-bg-white-0">
      <a href="#main" className="skip-link rounded-lg bg-bg-strong-950 px-3 py-2 text-label-sm text-text-white-0">
        Skip to content
      </a>
      <NavigationProgress />

      <aside className="fixed inset-y-0 left-0 hidden w-[272px] flex-col border-r border-stroke-soft-200 bg-bg-white-0 lg:flex">
        <div className="p-3">
          <Brand />
        </div>
        <div className="mx-5 h-px bg-stroke-soft-200" />
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <SidebarNav actor={actor} unread={unread} />
        </div>
        {!actor ? (
          <div className="border-t border-stroke-soft-200 p-4">
            <p className="mb-3 text-paragraph-xs text-text-sub-600">Team members sign in to see tasks and notifications.</p>
            <Button asChild variant="neutral" mode="stroke" size="small" className="w-full">
              <Link to="/sign-in">Sign in</Link>
            </Button>
          </div>
        ) : null}
      </aside>

      <div className="lg:pl-[272px]">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-stroke-soft-200 bg-bg-white-0/95 px-4 backdrop-blur lg:px-8">
          <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogPrimitive.Trigger asChild>
              <Button variant="neutral" mode="ghost" size="small" iconOnly className="lg:hidden" aria-label="Open navigation">
                <RiMenuLine className="size-5" aria-hidden />
              </Button>
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay lg:hidden" />
              <DialogPrimitive.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 flex w-[288px] max-w-[85vw] flex-col bg-bg-white-0 shadow-regular-md focus:outline-none lg:hidden">
                <div className="flex items-center justify-between p-3">
                  <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
                  <Brand />
                  <DialogPrimitive.Close className="flex size-8 items-center justify-center rounded-lg text-text-sub-600 hover:bg-bg-weak-50" aria-label="Close navigation">
                    <RiCloseLine className="size-5" />
                  </DialogPrimitive.Close>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <SidebarNav actor={actor} unread={unread} onNavigate={() => setMobileOpen(false)} />
                </div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>

          <div className="lg:hidden">
            <Link to="/" className="text-label-md text-text-strong-950">
              {HUB.name}
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {actor ? (
              <>
                <Button asChild variant="neutral" mode="ghost" size="small" iconOnly className="relative">
                  <Link to="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
                    <RiNotification3Line className="size-5" aria-hidden />
                    {unread > 0 ? <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-error-base ring-2 ring-bg-white-0" aria-hidden /> : null}
                  </Link>
                </Button>
                <AccountMenu actor={actor} />
              </>
            ) : (
              <Button asChild size="small">
                <Link to="/sign-in">Sign in</Link>
              </Button>
            )}
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1200px] px-4 py-6 focus:outline-none lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

