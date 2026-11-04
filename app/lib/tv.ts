import { createTV } from "tailwind-variants";
import { customTwMerge } from "./cn";

export type { VariantProps } from "tailwind-variants";

/** Same merge rules as `cn`, so Align UI typography classes never collide with text colours. */
export const tv = createTV({ twMerge: customTwMerge });
