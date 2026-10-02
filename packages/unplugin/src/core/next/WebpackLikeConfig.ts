/**
 * Minimal structural type for a webpack configuration object as seen by the
 * Next.js `webpack` hook callback.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The open record retains caller webpack configuration and an optional plugin
 *   array models the extension list the Next wrapper augments.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Only plugin-list ownership is typed because other settings pass through unchanged.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   This is the public configuration hook's value, not webpack runtime internals.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose identifies the callback boundary and the member comment explains
 *   initialization, with prose/tag separation per documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   The consumed member is an opaque plugin list in a public configuration
 *   callback, not a native path/capability representation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   The Next wrapper owns array initialization/prepending and the host owns
 *   plugin execution; this list boundary selects no processing algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   A configuration plugin list coordinates no completed or in-flight result
 *   sharing; installed plugins own their own validity mechanisms.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The host owns its plugin array and instantiated plugins. This configuration
 *   shape acquires no native resource or historical cache itself.
 */
export type WebpackLikeConfig = Record<string, unknown> & {
  /** The webpack plugin array; initialised to `[]` by this adapter if absent. */
  plugins?: unknown[];
};
