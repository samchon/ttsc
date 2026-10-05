import type { NativeBuildContext, UnpluginBuildContext } from "unplugin";

/**
 * Select the build host's module-level file registration channel. Farm
 * associates the input with the delivered module. Webpack and Rspack use their
 * available loader context; without one, registration uses the generic context.
 * The selected loader is also returned for the caller's cacheability decision,
 * so its native property is read only once. The returned callback preserves
 * each method's receiver and errors. Selecting a channel does not certify host
 * receipt or watch coverage.
 *
 * @evidence contracts/common.md#principled-implementation Farm receives the delivered module and input; a present webpack/Rspack loader receives only the input through addDependency; other contexts use addWatchFile. No compilation-level, missing-file or directory channel substitutes for module registration.
 * @evidence contracts/common.md#clear-and-simple-design One production-used factory owns channel selection, while registerProjectRecord owns record handoff and the host owns invalidation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported context methods are called with their original receivers; no foreign method replacement or private host mutation fabricates registration.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains module association, optional loader fallback, receiver/error preservation and the limit of channel selection.
 * @evidence contracts/portability.md#os-neutral-implementation Delivered module and native input spellings cross the host registration boundary unchanged; the host controls filesystem interpretation and this operation asserts no native watch coverage.
 * @evidenceExclude contracts/performance.md#efficient-algorithms This fixed channel selection chooses no population-processing algorithm. Each invocation delegates one host registration effect whose cost belongs to that host.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Registration is a per-delivery effect and is not skipped or memoized on matching file strings.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The callback borrows context and module references for its caller-owned lifetime and acquires no watcher, handle or retained generation.
 */
export function createBuildWatchFile(
  context: Pick<UnpluginBuildContext, "addWatchFile">,
  native: NativeBuildContext | undefined,
  file: string,
): {
  /** The selected module-level registration channel. */
  addWatchFile: (input: string) => void;

  /** The same optional loader used for the caller's cacheability capability. */
  loaderContext: Extract<
    NativeBuildContext,
    { framework: "webpack" | "rspack" }
  >["loaderContext"];
} {
  const loaderContext =
    native?.framework === "webpack" || native?.framework === "rspack"
      ? native.loaderContext
      : undefined;
  return {
    addWatchFile:
      native?.framework === "farm"
        ? (input) => native.context.addWatchFile(file, input)
        : loaderContext !== undefined
          ? (input) => loaderContext.addDependency(input)
          : (input) => context.addWatchFile(input),
    loaderContext,
  };
}
