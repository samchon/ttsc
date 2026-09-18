import type { ITtscCompilerTransformation } from "ttsc";

/**
 * Envelopes a worker adopted from its session instead of compiling
 * (samchon/ttsc#1390).
 *
 * An adopted compile that then fails its proof here, because an input outside
 * the project walk changed since the publisher compiled, must not be adopted
 * again by the retry: every retry would find the same publication. The retry
 * compiles instead, still under the session's lock, and replaces the
 * publication for the other workers.
 */
export const TRANSFORM_ADOPTED_RESULTS =
  new WeakSet<ITtscCompilerTransformation>();
