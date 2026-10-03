import { GoSourceInputs } from "./GoSourceInputs";

/**
 * Whether a directory below a plugin source directory, named `name`, never
 * contributes plugin source: `node_modules`, `.git`, and ttsc's own `.ttsc`.
 *
 * Nothing below such a directory can change the source's state
 * (`pluginSourceState`), so a consumer observing a plugin source directory as a
 * subtree passes over it rather than watching a nested package tree or a
 * repository's object store.
 *
 * @param name The directory's own name, not its path.
 *
 * @evidence contracts/common.md#principled-implementation Delegating to GoSourceInputs makes observers exclude exactly the directory names excluded by source copying and cache keying.
 * @evidence contracts/common.md#clear-and-simple-design The public predicate exposes shared source membership without exporting its Set representation to consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Pruned names are the declared source contract, not directories chosen after observing a particular consumer's build output.
 * @evidence contracts/common.md#meaningful-documentation The prose identifies the owning source state and explains why subtree observers omit nested package and repository trees.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The accessor delegates a fixed-name membership query; the owning namespace selects its Set.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work There is no computed result shared across requests beyond the immutable policy definition.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The accessor owns no retained state or handle.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation prunesPluginSourceDirectory computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
 */
export function prunesPluginSourceDirectory(name: string): boolean {
  return GoSourceInputs.shouldPruneDirectory(name);
}
