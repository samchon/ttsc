/**
 * What a failed generation recorded about one input outside the project walk
 * (samchon/ttsc#1398).
 *
 * @evidence contracts/common.md#principled-implementation The state is always present, and the discriminated alternatives forbid a single-path metadata signature on a plugin tree because that signature cannot establish its descendants' state.
 * @evidence contracts/common.md#clear-and-simple-design One small observation carrier distinguishes ordinary exact-path validation from whole-plugin-tree validation without owning either algorithm.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing metadata cannot masquerade as a valid signature, and a tree retains its source/build-environment state instead of an invented unchanged marker.
 * @evidence contracts/common.md#meaningful-documentation Separated property paragraphs explain signature timing, complete state composition and why tree observations carry no single-path signature; no property has acknowledgment tags.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   TtscFailedGenerationInputState only declares a shape; it has no
 *   filesystem, path or process operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscFailedGenerationInputState only declares a shape; it has no
 *   computation at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscFailedGenerationInputState only declares a shape; it has no work to
 *   reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscFailedGenerationInputState only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export type TtscFailedGenerationInputState = {
  /**
   * The input's full state: metadata, content, realpath, and listing; or, for a
   * plugin source directory, the state its sources and build environment hold
   * (`pluginSourceState`).
   */
  state: string;
} & (
  | {
      /**
       * Exact-path metadata observed before its state, retained only when the
       * clock proves separation. A matching separable signature permits reuse.
       */
      signature?: string;

      /** Ordinary exact-path observation rather than a plugin subtree. */
      tree?: never;
    }
  | {
      /** Plugin source/build-environment state requiring whole-tree validation. */
      tree: true;

      /** No one path's metadata can authorize reuse of descendant state. */
      signature?: never;
    }
);
