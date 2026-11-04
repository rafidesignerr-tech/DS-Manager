// Align UI form controls: Label, Hint, Input, Textarea, Select, Checkbox, Field.
import * as React from "react";
import { RiArrowDownSLine, RiErrorWarningFill, RiInformationFill } from "@remixicon/react";
import { cn } from "~/lib/cn";

export function Label({ className, children, required, optional, ...rest }: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean; optional?: boolean }) {
  return (
    <label className={cn("flex items-center gap-1 text-label-sm text-text-strong-950", className)} {...rest}>
      {children}
      {required ? <span className="text-primary-base" aria-hidden>*</span> : null}
      {optional ? <span className="text-paragraph-sm text-text-sub-600">(Optional)</span> : null}
    </label>
  );
}

export function Hint({ id, error, children, className }: { id?: string; error?: boolean; children: React.ReactNode; className?: string }) {
  const Icon = error ? RiErrorWarningFill : RiInformationFill;
  return (
    <p id={id} className={cn("flex items-start gap-1 text-paragraph-xs", error ? "text-error-base" : "text-text-sub-600", className)}>
      <Icon className={cn("mt-px size-4 shrink-0", error ? "text-error-base" : "text-text-soft-400")} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

const controlBase = [
  "w-full rounded-10 bg-bg-white-0 text-paragraph-sm text-text-strong-950 shadow-regular-xs",
  "ring-1 ring-inset ring-stroke-soft-200 transition duration-200 ease-out",
  "placeholder:text-text-soft-400",
  "hover:bg-bg-weak-50 hover:ring-transparent hover:shadow-none",
  "focus:outline-none focus:bg-bg-white-0 focus:shadow-button-important-focus focus:ring-stroke-strong-950",
  "disabled:cursor-not-allowed disabled:bg-bg-weak-50 disabled:text-text-disabled-300 disabled:shadow-none disabled:ring-transparent",
  "aria-[invalid=true]:ring-error-base aria-[invalid=true]:hover:ring-error-base aria-[invalid=true]:focus:shadow-button-error-focus",
];

export const inputSizes = { medium: "h-10 px-3", small: "h-9 px-2.5", xsmall: "h-8 px-2" } as const;

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: keyof typeof inputSizes;
  leadingIcon?: React.ComponentType<{ className?: string }>;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, size = "medium", leadingIcon: Icon, ...rest }, ref) {
  if (!Icon) return <input ref={ref} className={cn(controlBase, inputSizes[size], className)} {...rest} />;
  return (
    <div className="relative w-full">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-soft-400" aria-hidden />
      <input ref={ref} className={cn(controlBase, inputSizes[size], "pl-9", className)} {...rest} />
    </div>
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(controlBase, "min-h-24 resize-y px-3 py-2.5", className)} {...rest} />;
});

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: keyof typeof inputSizes;
}

/** Native select styled as the Align UI Select trigger: works without JavaScript and with every assistive technology. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, size = "medium", children, ...rest }, ref) {
  return (
    <div className="relative w-full">
      <select ref={ref} className={cn(controlBase, inputSizes[size], "appearance-none pr-9", className)} {...rest}>
        {children}
      </select>
      <RiArrowDownSLine className="pointer-events-none absolute right-2.5 top-1/2 size-5 -translate-y-1/2 text-text-sub-600" aria-hidden />
    </div>
  );
});

export function Checkbox({ className, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 shrink-0 cursor-pointer appearance-none rounded border-0 bg-bg-white-0 ring-1 ring-inset ring-stroke-sub-300 transition",
        "checked:bg-primary-base checked:ring-primary-base",
        "checked:bg-[url(\"data:image/svg+xml,%3Csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6.5 10.6 3.9 8l-.9.9 3.5 3.5 6.5-6.5-.9-.9z'/%3E%3C/svg%3E\")] bg-center bg-no-repeat",
        "focus-visible:shadow-button-primary-focus",
        className,
      )}
      {...rest}
    />
  );
}

interface FieldProps {
  label: string;
  name: string;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; name: string; "aria-invalid"?: true; "aria-describedby"?: string; required?: boolean }) => React.ReactNode;
}

/** Wires label, hint and error message to a control with the right ARIA attributes. */
export function Field({ label, name, error, hint, required, optional, className, children }: FieldProps) {
  const id = `field-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label htmlFor={id} required={required} optional={optional}>
        {label}
      </Label>
      {children({ id, name, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, required })}
      {error ? (
        <Hint id={`${id}-error`} error>
          {error}
        </Hint>
      ) : hint ? (
        <Hint id={`${id}-hint`}>{hint}</Hint>
      ) : null}
    </div>
  );
}
