import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** Typography and shadow tokens defined in app.css. tailwind-merge must know them,
 *  otherwise `text-label-sm` and `text-text-sub-600` would be treated as conflicts. */
export const TEXT_SIZES = [
  "title-h1", "title-h2", "title-h3", "title-h4", "title-h5", "title-h6",
  "label-xl", "label-lg", "label-md", "label-sm", "label-xs", "label-2xs",
  "paragraph-xl", "paragraph-lg", "paragraph-md", "paragraph-sm", "paragraph-xs",
  "subheading-md", "subheading-sm", "subheading-xs", "subheading-2xs",
  "doc-label", "doc-paragraph",
] as const;

export const twMergeConfig = {
  extend: {
    classGroups: {
      "font-size": [{ text: [...TEXT_SIZES] }],
    },
  },
};

export const customTwMerge = extendTailwindMerge(twMergeConfig);

export function cn(...classes: ClassValue[]): string {
  return customTwMerge(clsx(...classes));
}
