import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";

/** Internal retained clock-probe ownership for published generations. */
export const TRANSFORM_CLOCK_REFERENCE_DIRECTORIES = new WeakMap<
  TtscCachedProjectTransform,
  string
>();
