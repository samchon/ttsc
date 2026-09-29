import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import { isLinkedTransform } from "./isLinkedTransform";

/**
 * Picks the native binary that must own the compiler pass. Linked transform
 * sources ride inside a host that uses driver.LoadProgram, so an executable
 * transform wins when one is present.
 *
 * The caller supplies a nonempty ordered plugin population for this pass. An
 * empty population is a setup error, not an implicit host identity.
 *
 * @evidence contracts/common.md#principled-implementation The first executable owner takes the pass; when every transform is linked, the first descriptor supplies the aggregate host. Empty input cannot represent a host and is rejected explicitly.
 * @evidence contracts/common.md#clear-and-simple-design One selection rule serves build, transform and argument capability decisions instead of each consumer choosing a different owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Descriptor ownership and order govern selection, without a plugin-name priority or a guessed default executable.
 * @evidence contracts/common.md#meaningful-documentation Separate paragraphs state executable preference and the nonempty input requirement following the documentation skill.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The result is an existing descriptor; this selector neither resolves its binary path nor starts a native process.
 *
 * @evidence contracts/performance.md#efficient-algorithms find stops at the first executable owner, requiring at most O(P) predicate checks and constant auxiliary state.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current pass ordering determines the owner; no cross-request host selection or invalidation coordinator belongs to this accessor.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned descriptor remains caller-owned and no process or retained plugin population is acquired.
 */
export function selectSharedHostPlugin(
  plugins: readonly ITtscLoadedNativePlugin[],
): ITtscLoadedNativePlugin {
  const selected =
    plugins.find((plugin) => !isLinkedTransform(plugin)) ?? plugins[0];
  if (selected === undefined) {
    throw new Error(
      "ttsc: a shared compiler pass requires at least one plugin",
    );
  }
  return selected;
}
