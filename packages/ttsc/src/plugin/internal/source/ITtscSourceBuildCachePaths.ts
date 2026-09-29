/**
 * Source-plugin cache locations resolved for one ttsc invocation.
 *
 * @evidence contracts/common.md#principled-implementation Separate binary and Go object roots preserve independent cache selection; the source discriminant identifies whether ttsc or the caller controls object-cache reclamation.
 * @evidence contracts/common.md#clear-and-simple-design One resolved-location object shares the same roots with build, pruning and clean without repeating resolution policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Ownership follows explicit selection provenance rather than assuming every configured directory is disposable.
 * @evidence contracts/common.md#meaningful-documentation Member comments identify content-addressed binaries, GOCACHE and selection provenance, with blank lines between fields.
 * @evidence contracts/portability.md#os-neutral-implementation Members carry native directory spellings and a platform-independent provenance union; resolvers use node:path rather than assuming slash spelling or case policy.
 */
export interface ITtscSourceBuildCachePaths {
  /** Selected plugin-cache layout root; an external GOCACHE may lie elsewhere. */
  root: string;

  /** Directory containing content-addressed compiled plugin binaries. */
  pluginRoot: string;

  /** Directory passed to Go as `GOCACHE` for source-plugin builds. */
  goBuildRoot: string;

  /** Selection provenance controlling automatic pruning and explicit clean. */
  goBuildRootSource: "ttsc-cache" | "TTSC_GO_CACHE_DIR" | "GOCACHE";
}
