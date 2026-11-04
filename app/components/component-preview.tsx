import { cn } from "~/lib/cn";
import { previewSrc } from "~/catalog/components";

/**
 * Picture of a component's default variant, exported from Figma. Always shown on
 * a light surface because the library's components are drawn for light screens.
 */
export function ComponentPreview({ id, alt = "", className }: { id: string; alt?: string; className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-center overflow-hidden bg-[#f5f7fa] p-4 ring-1 ring-inset ring-stroke-soft-200", className)}
      aria-hidden={alt ? undefined : true}
    >
      <img src={previewSrc(id)} alt={alt} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
    </div>
  );
}
