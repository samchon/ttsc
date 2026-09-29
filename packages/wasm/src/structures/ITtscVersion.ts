/**
 * Build and runtime metadata returned synchronously by the wasm.
 *
 * @evidence contracts/common.md#principled-implementation
 *   String fields match jsVersion's linker metadata and runtime queries; the
 *   API can report an unversioned development binary without guessing a release.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Target and toolchain identity come from the binary rather than the browser's
 *   platform or a consumer-specific version constant.
 * @evidence contracts/common.md#meaningful-documentation
 *   Members distinguish release metadata from Go runtime/target identity,
 *   following the documentation skill's concrete context guidance.
 */
export interface ITtscVersion {
  /** Linker-supplied release version, or the development placeholder. */
  version: string;

  /** Linker-supplied source revision, or the development placeholder. */
  commit: string;

  /** Linker-supplied build date, or unknown for an unannotated build. */
  date: string;

  /** Go runtime's toolchain version. */
  go: string;

  /** Binary target OS, js for the browser build. */
  goos: string;

  /** Binary target architecture, wasm for the browser build. */
  goarch: string;
}
