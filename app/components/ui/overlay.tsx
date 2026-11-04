// Align UI Modal, Drawer and Dropdown, on Radix primitives (focus trap, escape, ARIA).
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { RiCloseLine } from "@remixicon/react";
import { cn } from "~/lib/cn";

export const Modal = DialogPrimitive.Root;
export const ModalTrigger = DialogPrimitive.Trigger;
export const ModalClose = DialogPrimitive.Close;

export function ModalContent({ title, description, children, className, footer }: { title: string; description?: string; children?: React.ReactNode; className?: string; footer?: React.ReactNode }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[10px]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-20 bg-bg-white-0 shadow-regular-md",
          "focus:outline-none",
          className,
        )}
      >
        <div className="flex items-start gap-3.5 px-5 py-4">
          <div className="flex-1 space-y-1">
            <DialogPrimitive.Title className="text-label-sm text-text-strong-950">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="text-paragraph-xs text-text-sub-600">{description}</DialogPrimitive.Description> : null}
          </div>
          <DialogPrimitive.Close className="flex size-6 items-center justify-center rounded-md text-text-soft-400 hover:bg-bg-weak-50 hover:text-text-sub-600" aria-label="Close">
            <RiCloseLine className="size-[18px]" />
          </DialogPrimitive.Close>
        </div>
        {children ? <div className="border-t border-stroke-soft-200 px-5 py-4">{children}</div> : null}
        {footer ? <div className="flex items-center justify-end gap-3 border-t border-stroke-soft-200 px-5 py-4">{footer}</div> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Confirmation dialog for destructive actions (BRD §10). `children` is the footer: a cancel button is added automatically. */
export function ConfirmDialog({ trigger, title, description, children }: { trigger: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <Modal>
      <ModalTrigger asChild>{trigger}</ModalTrigger>
      <ModalContent
        title={title}
        description={description}
        footer={
          <>
            <ModalClose className="inline-flex h-9 items-center rounded-lg bg-bg-white-0 px-3 text-label-sm text-text-sub-600 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 hover:bg-bg-weak-50">
              Cancel
            </ModalClose>
            {children}
          </>
        }
      />
    </Modal>
  );
}

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;

export function DrawerContent({ title, children, className, onCloseHref }: { title: string; children: React.ReactNode; className?: string; onCloseHref?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn("fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-bg-white-0 shadow-regular-md focus:outline-none sm:inset-y-2 sm:right-2 sm:rounded-20", className)}
      >
        <div className="flex items-center gap-3 border-b border-stroke-soft-200 px-5 py-4">
          <DialogPrimitive.Title className="flex-1 text-label-lg text-text-strong-950">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close className="flex size-6 items-center justify-center rounded-md text-text-soft-400 hover:bg-bg-weak-50 hover:text-text-sub-600" aria-label="Close panel" data-close-href={onCloseHref}>
            <RiCloseLine className="size-5" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export function DropdownContent({ children, align = "end", className }: { children: React.ReactNode; align?: "start" | "end"; className?: string }) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={8}
        className={cn("z-50 min-w-[220px] overflow-hidden rounded-2xl bg-bg-white-0 p-2 shadow-regular-md ring-1 ring-inset ring-stroke-soft-200", className)}
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  );
}

export const DropdownItem = React.forwardRef<HTMLDivElement, DropdownPrimitive.DropdownMenuItemProps>(function DropdownItem({ className, ...rest }, ref) {
  return (
    <DropdownPrimitive.Item
      ref={ref}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg p-2 text-paragraph-sm text-text-strong-950 outline-none transition",
        "data-[highlighted]:bg-bg-weak-50 data-[disabled]:text-text-disabled-300",
        className,
      )}
      {...rest}
    />
  );
});

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return <DropdownPrimitive.Label className="px-2 py-1 text-subheading-xs uppercase text-text-sub-600">{children}</DropdownPrimitive.Label>;
}

export function DropdownSeparator() {
  return <DropdownPrimitive.Separator className="-mx-2 my-1 h-px bg-stroke-soft-200" />;
}
