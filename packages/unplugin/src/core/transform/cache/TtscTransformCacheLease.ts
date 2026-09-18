/**
 * The lifetime of a build-scoped cache across the sessions that use it
 * (samchon/ttsc#1396).
 */
export interface TtscTransformCacheLease {
  /** Start a session that uses the cache, cancelling a pending release. */
  acquire(): void;
  /** End a session; the last one schedules the cache's release. */
  release(): void;
}
