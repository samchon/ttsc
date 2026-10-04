/**
 * Select a project's owned output, falling back to a build of the requested
 * source when the project emitted nothing or did not compile that source.
 * Native build and output-read operations remain with the runtime owner.
 *
 * @evidence contracts/common.md#principled-implementation The coordinator distinguishes no owner, empty project, missing source ownership and successful serving without discarding other failures.
 * @evidence contracts/common.md#clear-and-simple-design One internal concern groups its actual runtime dependencies and ordered selection operation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The runtime supplies its real build and serving operations; no compiler output, fixture or alternate execution is substituted.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes output selection from the delegated native operations.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The namespace itself groups the selection contract; its operation explains native delegation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms This container performs no computation; serving describes its fixed dispatch and delegated costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The container coordinates no reusable build; runtime dependencies own their cache validity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The container retains no project generations, handles or tasks.
 */
export namespace OwnedProjectSource {
  /**
   * Actual runtime operations used in order by source ownership selection.
   * `serve` returns null only when the build does not own the requested source;
   * unreadable owned output and native build failures propagate as exceptions.
   *
   * @evidence contracts/common.md#principled-implementation Generic build and served values preserve owner identity without imposing synthetic compiler result shapes.
   * @evidence contracts/common.md#clear-and-simple-design Named dependencies expose config lookup, project/root builds, serving and the one recoverable error classification.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts These are ordinary runtime dependencies used by production, not a test-only constructor or foreign-method replacement.
   * @evidence contracts/common.md#meaningful-documentation Native prose specifies null ownership and exception responsibilities.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declares operation signatures and performs no native access.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The type performs no computation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The type retains no cached or in-flight result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The type owns no runtime resources.
   */
  export interface Dependencies<Build, Served> {
    /** Find the config that owns the requested physical source, or no owner. */
    owningTsconfig(real: string): string | null;

    /** Build the owning project through its existing policy. */
    ensureProjectBuilt(tsconfig: string): Build;

    /** Recognize only the runtime's empty-project emit error. */
    isEmptyProjectEmitError(error: unknown): boolean;

    /** Serve the exact requested source from this build's ownership index. */
    serve(built: Build, real: string): Served | null;

    /** Build this exact source through the owning project's root policy. */
    ensureRootBuilt(tsconfig: string, real: string): Build;
  }

  /**
   * Serve owned project output before requesting a source-specific root build.
   * Only an empty-project emit error is recoverable. Both project and root
   * serving receive the original source; missing root output is an error.
   *
   * @evidence contracts/common.md#principled-implementation No config returns null without building; project success short-circuits, while empty project or unowned requested output falls back to the same config and source. Other exceptions propagate unchanged.
   * @evidence contracts/common.md#clear-and-simple-design The ordered project attempt, source ownership check and root attempt retain the runtime's original branches in one operation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Selection uses actual supplied operations and exact source values without inferring output from basenames or replacing compiler results.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies the recoverable error, exact source forwarding and missing-root failure.
   * @evidence contracts/portability.md#os-neutral-implementation Paths pass unchanged to the owning runtime's config, native build and output-read operations; this coordinator performs no platform-specific parsing or fabricated filesystem observation.
   * @evidence contracts/performance.md#efficient-algorithms Dispatch has a fixed number of calls, at most one project and one root build plus two serving attempts; delegated lookup, compiler and output-read costs remain part of the operation and are not claimed constant.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation adds no memoization or in-flight coordination; the supplied runtime build owners maintain their existing validity and reuse policies.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Local build references and the returned served value transfer through synchronous calls; no history, handle or task is retained here, and build/read cleanup belongs to the supplied owners.
   */
  export function serve<Build, Served>(
    real: string,
    dependencies: Dependencies<Build, Served>,
  ): Served | null {
    const tsconfig = dependencies.owningTsconfig(real);
    if (tsconfig === null) return null;
    let built: Build | null;
    try {
      built = dependencies.ensureProjectBuilt(tsconfig);
    } catch (error) {
      if (!dependencies.isEmptyProjectEmitError(error)) throw error;
      built = null;
    }
    const served = built === null ? null : dependencies.serve(built, real);
    if (served !== null) return served;
    const root = dependencies.ensureRootBuilt(tsconfig, real);
    const emitted = dependencies.serve(root, real);
    if (emitted === null) {
      throw new Error(
        `ttsx: the build of ${real} through ${tsconfig} emitted no JavaScript for it`,
      );
    }
    return emitted;
  }
}
