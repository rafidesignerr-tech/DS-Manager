// Align UI Button — variant × mode × size, built on the Align UI token classes.
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { tv, type VariantProps } from "~/lib/tv";

export const buttonVariants = tv({
  slots: {
    root: [
      "group relative inline-flex items-center justify-center whitespace-nowrap outline-none",
      "transition duration-200 ease-out",
      "focus:outline-none focus-visible:outline-none",
      "disabled:pointer-events-none disabled:bg-bg-weak-50 disabled:text-text-disabled-300 disabled:ring-transparent",
      "aria-disabled:pointer-events-none aria-disabled:bg-bg-weak-50 aria-disabled:text-text-disabled-300",
    ],
    icon: "flex size-5 shrink-0 items-center justify-center",
  },
  variants: {
    variant: { primary: {}, neutral: {}, error: {} },
    mode: { filled: {}, stroke: { root: "ring-1 ring-inset" }, lighter: { root: "ring-1 ring-inset" }, ghost: { root: "ring-1 ring-inset" } },
    size: {
      medium: { root: "h-10 gap-3 rounded-10 px-3.5 text-label-sm", icon: "-mx-1" },
      small: { root: "h-9 gap-3 rounded-lg px-3 text-label-sm", icon: "-mx-1" },
      xsmall: { root: "h-8 gap-2.5 rounded-lg px-2.5 text-label-sm", icon: "-mx-1" },
      xxsmall: { root: "h-7 gap-2.5 rounded-lg px-2 text-label-sm", icon: "-mx-1" },
    },
    iconOnly: { true: {} },
  },
  compoundVariants: [
    // primary
    // In dark mode the base blue is lighter, so filled buttons step down one shade to keep white text at AA contrast.
    { variant: "primary", mode: "filled", class: { root: ["bg-primary-base text-static-white dark:bg-primary-dark", "hover:bg-primary-darker", "focus-visible:shadow-button-primary-focus"] } },
    { variant: "primary", mode: "stroke", class: { root: ["bg-bg-white-0 text-primary-base ring-primary-base", "hover:bg-primary-alpha-10 hover:ring-transparent", "focus-visible:shadow-button-primary-focus"] } },
    { variant: "primary", mode: "lighter", class: { root: ["bg-primary-alpha-10 text-primary-base ring-transparent", "hover:bg-bg-white-0 hover:ring-primary-base", "focus-visible:bg-bg-white-0 focus-visible:shadow-button-primary-focus focus-visible:ring-primary-base"] } },
    { variant: "primary", mode: "ghost", class: { root: ["bg-transparent text-primary-base ring-transparent", "hover:bg-primary-alpha-10", "focus-visible:bg-bg-white-0 focus-visible:shadow-button-primary-focus focus-visible:ring-primary-base"] } },
    // neutral
    { variant: "neutral", mode: "filled", class: { root: ["bg-bg-strong-950 text-text-white-0", "hover:bg-bg-surface-800", "focus-visible:shadow-button-important-focus"] } },
    { variant: "neutral", mode: "stroke", class: { root: ["bg-bg-white-0 text-text-sub-600 shadow-regular-xs ring-stroke-soft-200", "hover:bg-bg-weak-50 hover:text-text-strong-950 hover:shadow-none hover:ring-transparent", "focus-visible:text-text-strong-950 focus-visible:shadow-button-important-focus focus-visible:ring-stroke-strong-950"] } },
    { variant: "neutral", mode: "lighter", class: { root: ["bg-bg-weak-50 text-text-sub-600 ring-transparent", "hover:bg-bg-white-0 hover:text-text-strong-950 hover:shadow-regular-xs hover:ring-stroke-soft-200", "focus-visible:bg-bg-white-0 focus-visible:text-text-strong-950 focus-visible:shadow-button-important-focus focus-visible:ring-stroke-strong-950"] } },
    { variant: "neutral", mode: "ghost", class: { root: ["bg-transparent text-text-sub-600 ring-transparent", "hover:bg-bg-weak-50 hover:text-text-strong-950", "focus-visible:bg-bg-white-0 focus-visible:text-text-strong-950 focus-visible:shadow-button-important-focus focus-visible:ring-stroke-strong-950"] } },
    // error
    { variant: "error", mode: "filled", class: { root: ["bg-error-base text-static-white", "hover:bg-red-700", "focus-visible:shadow-button-error-focus"] } },
    { variant: "error", mode: "stroke", class: { root: ["bg-bg-white-0 text-error-base ring-error-base", "hover:bg-red-alpha-10 hover:ring-transparent", "focus-visible:shadow-button-error-focus"] } },
    { variant: "error", mode: "lighter", class: { root: ["bg-red-alpha-10 text-error-dark ring-transparent", "hover:bg-bg-white-0 hover:ring-error-base", "focus-visible:bg-bg-white-0 focus-visible:shadow-button-error-focus focus-visible:ring-error-base"] } },
    { variant: "error", mode: "ghost", class: { root: ["bg-transparent text-error-base ring-transparent", "hover:bg-red-alpha-10", "focus-visible:bg-bg-white-0 focus-visible:shadow-button-error-focus focus-visible:ring-error-base"] } },
    // icon only
    { iconOnly: true, size: "medium", class: { root: "w-10 px-0" } },
    { iconOnly: true, size: "small", class: { root: "w-9 px-0" } },
    { iconOnly: true, size: "xsmall", class: { root: "w-8 px-0" } },
    { iconOnly: true, size: "xxsmall", class: { root: "w-7 px-0" } },
  ],
  defaultVariants: { variant: "primary", mode: "filled", size: "medium" },
});

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {
  asChild?: boolean;
  leadingIcon?: React.ComponentType<{ className?: string }>;
  trailingIcon?: React.ComponentType<{ className?: string }>;
  /** Shows a pending state and blocks repeated submits. */
  pending?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { asChild, variant, mode, size, iconOnly, className, leadingIcon: Leading, trailingIcon: Trailing, pending, children, disabled, ...rest },
  ref,
) {
  const { root, icon } = buttonVariants({ variant, mode, size, iconOnly });
  const Comp = asChild ? Slot : "button";
  if (asChild) {
    return (
      <Comp ref={ref} className={root({ class: className })} {...rest}>
        {children}
      </Comp>
    );
  }
  return (
    <button
      ref={ref}
      type={rest.type ?? "button"}
      className={root({ class: className })}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {pending ? <Spinner className={icon()} /> : Leading ? <Leading className={icon()} aria-hidden /> : null}
      {children}
      {Trailing && !pending ? <Trailing className={icon()} aria-hidden /> : null}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden>
      <svg viewBox="0 0 20 20" className="size-4 animate-spin" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5" />
        <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}
