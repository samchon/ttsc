/**
 * Build and runtime metadata returned synchronously by the wasm.
 *
 * @evidence contracts/common.md#principled-implementation
 *   String fields match jsVersion's linker metadata and runtime queries; the
 *   API can report an unversioned development binary without guessing a release.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Link-time release metadata and runtime target/toolchain identity remain
 *   explicit fields, without a version-parsing or environment-inference layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Target and toolchain identity come from the binary rather than the browser's
 *   platform or a consumer-specific version constant.
 * @evidence contracts/common.md#meaningful-documentation
 *   Members distinguish release metadata from Go runtime/target identity,
 *   following the documentation skill's concrete context guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscVersion is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscVersion is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscVersion is a data interface and coordinates no shared or repeated computation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscVersion is a data interface and performs no native filesystem, path or process operation.
 */
export interface ITtscVersion {
  /** Linker-supplied release version, or the development placeholder. */
  version: string;

  /** Linker-supplied source revision, or the development placeholder. */
  commit: string;

  /**
   * Linker-supplied date, or unknown for an unannotated build. The base binary
   * stamps the date of its source commit rather than the time it was built.
   */
  date: string;

  /** Go runtime's toolchain version. */
  go: string;

  /** Binary target OS, js for the browser build. */
  goos: string;

  /** Binary target architecture, wasm for the browser build. */
  goarch: string;
}
