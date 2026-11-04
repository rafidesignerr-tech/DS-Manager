// Align UI Alert, Empty state, Access-denied state, Skeleton.
import * as React from "react";
import { Link } from "react-router";
import {
  RiAlertFill,
  RiCheckboxCircleFill,
  RiErrorWarningFill,
  RiInformationFill,
  RiLockLine,
  RiInboxLine,
} from "@remixicon/react";
import { cn } from "~/lib/cn";
import { Button } from "./button";

const alertStyles = {
  success: { box: "bg-success-lighter text-text-strong-950", icon: RiCheckboxCircleFill, iconColor: "text-success-base" },
  error: { box: "bg-error-lighter text-text-strong-950", icon: RiErrorWarningFill, iconColor: "text-error-base" },
  warning: { box: "bg-warning-lighter text-text-strong-950", icon: RiAlertFill, iconColor: "text-warning-base" },
  information: { box: "bg-information-lighter text-text-strong-950", icon: RiInformationFill, iconColor: "text-information-base" },
} as const;

export function Alert({
  tone,
  title,
  children,
  className,
  live,
}: {
  tone: keyof typeof alertStyles;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  /** Announce to screen readers when it appears. */
  live?: boolean;
}) {
  const s = alertStyles[tone];
  const Icon = s.icon;
  return (
    <div
      role={live ? (tone === "error" ? "alert" : "status") : undefined}
      className={cn("flex items-start gap-2.5 rounded-xl p-3 text-paragraph-sm", s.box, className)}
    >
      <Icon className={cn("mt-px size-5 shrink-0", s.iconColor)} aria-hidden />
      <div className="space-y-1">
        {title ? <p className="text-label-sm">{title}</p> : null}
        {children ? <div className="text-text-sub-600">{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon = RiInboxLine,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 rounded-2xl px-6 py-12 text-center", className)}>
      <div className="flex size-14 items-center justify-center rounded-full bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200">
        <Icon className="size-6 text-text-soft-400" aria-hidden />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-label-md text-text-strong-950">{title}</p>
        {description ? <p className="text-paragraph-sm text-text-sub-600">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function AccessDenied({ signedIn, message }: { signedIn: boolean; message?: string }) {
  return (
    <EmptyState
      icon={RiLockLine}
      title={signedIn ? "You don't have access" : "Sign in to continue"}
      description={message ?? (signedIn ? "This area is limited to a specific role. Ask a manager if you need access." : "This area is for team members.")}
      action={
        signedIn ? (
          <Button asChild variant="neutral" mode="stroke" size="small">
            <Link to="/">Back to home</Link>
          </Button>
        ) : (
          <Button asChild size="small">
            <Link to="/sign-in">Sign in</Link>
          </Button>
        )
      }
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-bg-weak-50", className)} aria-hidden />;
}
