import type { TtscSharedBuildTransformCache } from "./TtscSharedBuildTransformCache";

/**
 * Build-scoped caches shared by every adapter instance in the process with the
 * same resolved options (samchon/ttsc#1396).
 *
 * Webpack and Rspack call the adapter factory once per compiler, so the client,
 * server, and edge compilers of one Next build each owned a cache and compiled
 * the same program. Equal options compile the same program, so they share one
 * cache, and its lease spans all of their sessions.
 */
export const SHARED_BUILD_TRANSFORM_CACHES = new Map<
  string,
  TtscSharedBuildTransformCache
>();
