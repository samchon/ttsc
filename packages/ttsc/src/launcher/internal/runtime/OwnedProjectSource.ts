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
    /**
     * Find the config that owns the requested physical source, or no owner.
     *
     * @evidence contracts/common.md#principled-implementation The nullable config result distinguishes an owning project from absence for the exact supplied physical source.
     * @evidence contracts/common.md#clear-and-simple-design One source argument and one nullable config result describe the runtime lookup boundary.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The signature requires the actual lookup result rather than inventing ownership from a basename.
     * @evidence contracts/common.md#meaningful-documentation Native prose identifies the physical source and no-owner result.
     * @evidence contracts/portability.md#os-neutral-implementation The source and config strings carry native path values from the runtime owner without URL conversion or lexical case assumptions.
     * @evidenceExclude contracts/performance.md#efficient-algorithms This method signature has no implementation; the runtime lookup owns its search cost.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The signature defines no lookup cache or validity policy.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no resource and establishes no retained lookup lifetime.
     */
    owningTsconfig(real: string): string | null;

    /**
     * Build the owning project through its existing policy.
     *
     * @evidence contracts/common.md#principled-implementation The selected config determines the generic build returned by the runtime owner; exceptions remain available to the coordinator.
     * @evidence contracts/common.md#clear-and-simple-design One config selects one build operation without another compiler result representation.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The returned build is supplied by the actual runtime dependency rather than synthesized here.
     * @evidence contracts/common.md#meaningful-documentation Native prose identifies the owning project build policy.
     * @evidence contracts/portability.md#os-neutral-implementation The config remains a native runtime path; executable selection and filesystem differences belong to the supplied build owner.
     * @evidenceExclude contracts/performance.md#efficient-algorithms The signature performs no compilation or source traversal.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work Runtime build caching and input validity are not defined by this signature.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Build resources and their transfer or release remain with the runtime implementation.
     */
    ensureProjectBuilt(tsconfig: string): Build;

    /**
     * Recognize only the runtime's empty-project emit error.
     *
     * @evidence contracts/common.md#principled-implementation A boolean classification of the actual thrown value identifies the one recoverable project-build error.
     * @evidence contracts/common.md#clear-and-simple-design A separate predicate keeps error classification with the runtime owner.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The unknown value is passed intact; the coordinator does not guess recovery from unrelated error text.
     * @evidence contracts/common.md#meaningful-documentation Native prose limits recognition to the empty-project emit error.
     * @evidenceExclude contracts/portability.md#os-neutral-implementation This signature describes error classification without a native path or process representation.
     * @evidenceExclude contracts/performance.md#efficient-algorithms No classifier implementation or scanning algorithm is declared here.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The signature coordinates no reusable classification work.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature retains no error history or resource.
     */
    isEmptyProjectEmitError(error: unknown): boolean;

    /**
     * Serve the exact requested source from this build's ownership index.
     *
     * @evidence contracts/common.md#principled-implementation Build identity and the requested physical source determine a served value or null ownership, while read failures can still throw.
     * @evidence contracts/common.md#clear-and-simple-design The build/source pair and nullable value distinguish ownership from output-read failure.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The signature does not infer emitted output from a sibling filename or fabricate compiler output.
     * @evidence contracts/common.md#meaningful-documentation Native prose identifies exact-source serving; the enclosing contract distinguishes null from unreadable owned output.
     * @evidence contracts/portability.md#os-neutral-implementation The physical source passes unchanged to the runtime ownership index and output reader, which own native identity differences.
     * @evidenceExclude contracts/performance.md#efficient-algorithms This signature performs no index lookup or output read.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work It defines no served-output cache or reuse validity policy.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature does not acquire or retain build generations or output handles.
     */
    serve(built: Build, real: string): Served | null;

    /**
     * Build this exact source through the owning project's root policy.
     *
     * @evidence contracts/common.md#principled-implementation The owning config and exact source select the runtime's source-specific root build without changing their identities.
     * @evidence contracts/common.md#clear-and-simple-design Two explicit path inputs expose the root-build responsibility separately from whole-project building.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The runtime dependency supplies the actual build; this signature introduces no alternate compiler or test-only result.
     * @evidence contracts/common.md#meaningful-documentation Native prose identifies the exact source and owning project's root policy.
     * @evidence contracts/portability.md#os-neutral-implementation Both inputs retain native path spelling; platform-specific compilation and output placement remain with the runtime owner.
     * @evidenceExclude contracts/performance.md#efficient-algorithms The signature implements no source selection or compilation algorithm.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work It introduces no root-build cache or cross-request validity decision.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The runtime build implementation owns acquisition, transfer and release; no lifetime is implemented here.
     */
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
