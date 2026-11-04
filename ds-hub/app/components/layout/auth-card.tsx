import * as React from "react";
import { RiLayoutGridLine } from "@remixicon/react";

/** Centered card used by sign-in, password reset, invitation and setup pages. */
export function AuthCard({ title, description, children, footer }: { title: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-6 py-6 md:py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="mb-2 flex size-16 items-center justify-center rounded-full bg-gradient-to-b from-primary-alpha-16 to-transparent">
          <span className="flex size-12 items-center justify-center rounded-full bg-bg-white-0 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200">
            <RiLayoutGridLine className="size-6 text-primary-base" aria-hidden />
          </span>
        </div>
        <h1 className="text-title-h5 text-text-strong-950">{title}</h1>
        {description ? <p className="text-paragraph-md text-text-sub-600">{description}</p> : null}
      </div>
      <div className="rounded-20 bg-bg-white-0 p-5 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 md:p-6">{children}</div>
      {footer ? <div className="text-center text-paragraph-sm text-text-sub-600">{footer}</div> : null}
    </div>
  );
}
