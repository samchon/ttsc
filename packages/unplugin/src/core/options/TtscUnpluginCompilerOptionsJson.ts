/**
 * Raw compiler-options overlay supplied by the caller as a plain JSON value.
 *
 * @evidence contracts/common.md#principled-implementation
 *   String-keyed unknown values preserve compiler-specific option names and
 *   leave validation to the selected compiler rather than narrowing its API.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One record expresses the overlay without duplicating compiler option types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The open representation does not encode particular plugin or fixture keys.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc identifies this as the caller's raw JSON overlay, distinguishing
 *   it from resolved options, with prose separated from checklist tags.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   TtscUnpluginCompilerOptionsJson only declares a shape; it has no
 *   filesystem, path or process operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscUnpluginCompilerOptionsJson only declares a shape; it has no
 *   computation at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscUnpluginCompilerOptionsJson only declares a shape; it has no work to
 *   reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscUnpluginCompilerOptionsJson only declares a shape; it has no handle
 *   or retained state at runtime.
 */
export type TtscUnpluginCompilerOptionsJson = Record<string, unknown>;
