import type { TtscCompilerMembershipHint } from "../generation/TtscCompilerMembershipHint";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * Qualified native root hint per invocation key, retained across generation
 * disposal. Its config-policy basis must match before priming a new walk;
 * neither the match nor report proves current filesystem state. Entries live
 * until the cache is collected; distinct invocation keys and their path bytes
 * have no independent cap.
 */
export const TRANSFORM_CACHE_MEMBERSHIP_POLICIES = new WeakMap<
  TtscTransformCache,
  Map<string, TtscCompilerMembershipHint>
>();
