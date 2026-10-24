import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * Last native root report per invocation key, retained like learned case policy
 * and dependency names across generation disposal. Reports supply a primer,
 * never current filesystem proof. Entries live until the cache is collected;
 * distinct invocation keys and their path bytes have no independent cap.
 */
export const TRANSFORM_CACHE_MEMBERSHIP_POLICIES = new WeakMap<
  TtscTransformCache,
  Map<
    string,
    NonNullable<ITtscCompilerTransformation.IReferenceGraph["membership"]>
  >
>();
