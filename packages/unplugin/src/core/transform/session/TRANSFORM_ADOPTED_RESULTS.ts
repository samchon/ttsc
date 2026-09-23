import type { ITtscCompilerTransformation } from "ttsc";

/**
 * Envelopes a worker adopted from its session instead of compiling, each with
 * the project state the publication it came from was compiled for
 * (samchon/ttsc#1390).
 *
 * An adopted compile that then fails its proof here, because an input outside
 * the project walk changed since the publisher compiled, must not be adopted
 * again by a retry for the same state: that retry would find the same
 * publication. It compiles instead, still under the session's lock, and
 * replaces the publication for the other workers. A retry whose project has
 * moved to another state claims another publication, which nothing has found
 * wanting, and adopts it like any other.
 */
export const TRANSFORM_ADOPTED_RESULTS = new WeakMap<
  ITtscCompilerTransformation,
  string
>();
