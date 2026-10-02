/**
 * The filesystem and platform primitives {@link retireLockDirectory} uses.
 *
 * The retirement loop renames a held generation, classifies refusals, and on
 * Windows probes whether a newly created sibling can be renamed between the
 * same parents. Injected implementations must describe the same native
 * filesystem and propagate native errors with their `code`; this interface
 * offers no atomic snapshot of those observations.
 *
 * @evidence contracts/common.md#principled-implementation Rename, directory creation, removal, existence and platform are the exact facts the retirement and its Windows probe consult, so a substitute describes the same observations rather than a different protocol.
 * @evidence contracts/common.md#clear-and-simple-design Five primitives form the retirement boundary without embedding retry, polling or classification policy; defaults are the real filesystem and process platform.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit primitive injection is the supported boundary; implementations must report actual native results and error codes instead of replacing foreign globals or fabricating a probe outcome.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the observations consulted, the native-error premise and the absence of an atomic snapshot.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export interface RetireLockDirectoryOperations {
  /**
   * Rename a directory; refusals must surface as errors carrying native codes.
   *
   * @evidence contracts/common.md#principled-implementation The retirement transition and the probe both rename; native refusal codes distinguish a missing source, an occupied destination and a peer-held directory.
   * @evidence contracts/common.md#clear-and-simple-design One primitive serves the retirement and the probe, and classification stays with the loop.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A substitute must throw the real refusal with its code instead of returning success to steer the loop.
   * @evidence contracts/common.md#meaningful-documentation The comment states that refusals are errors with native codes.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources renameSync declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms renameSync declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work renameSync declares a signature only; the implementation owns any shared work.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation renameSync is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
   */
  renameSync(source: string, destination: string): void;

  /**
   * Create one directory without recursion.
   *
   * @evidence contracts/common.md#principled-implementation The probe creates one sibling of the held generation to test whether the parents permit a rename.
   * @evidence contracts/common.md#clear-and-simple-design Single-level creation is all the probe needs; recursive creation is not offered.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A substitute must create a real directory or throw, never pretend a probe exists.
   * @evidence contracts/common.md#meaningful-documentation The comment states the nonrecursive creation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources mkdirSync declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms mkdirSync declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work mkdirSync declares a signature only; the implementation owns any shared work.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation mkdirSync is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
   */
  mkdirSync(location: string): void;

  /**
   * Remove a directory tree; may throw when the platform refuses.
   *
   * @evidence contracts/common.md#principled-implementation Probe cleanup is best effort, so removal may throw without changing the retry decision.
   * @evidence contracts/common.md#clear-and-simple-design One removal primitive covers both probe directories.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A substitute may throw a real refusal; it must not hide the leftover directory.
   * @evidence contracts/common.md#meaningful-documentation The comment states that removal may throw.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources rmSync declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms rmSync declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work rmSync declares a signature only; the implementation owns any shared work.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation rmSync is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
   */
  rmSync(
    location: string,
    options: { force: boolean; recursive: boolean },
  ): void;

  /**
   * Whether a path currently exists.
   *
   * @evidence contracts/common.md#principled-implementation Existence separates an occupied destination from a permission refusal and confirms the source remains before probing.
   * @evidence contracts/common.md#clear-and-simple-design One boolean observation, with no kind or permission detail.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A substitute must report the actual state rather than a fixed answer.
   * @evidence contracts/common.md#meaningful-documentation The comment states the boolean existence meaning.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources existsSync declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms existsSync declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work existsSync declares a signature only; the implementation owns any shared work.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation existsSync is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
   */
  existsSync(location: string): boolean;

  /** The platform value; only `"win32"` enables the peer-contention probe. */
  platform: NodeJS.Platform;
}
