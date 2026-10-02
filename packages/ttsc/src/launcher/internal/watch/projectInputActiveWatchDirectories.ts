import path from "node:path";

import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";

/**
 * Removes recursive roots already covered by an ancestor without rewriting the
 * declaration-specific roots retained by WatchTopology.
 * Coverage here means identity-key ancestry used for root selection, not proof
 * that a native watcher has been installed or delivers replacement events.
 * All spellings and an explicitly supplied identity context must use the host's
 * path grammar because ancestor walking uses native path.dirname.
 *
 * @evidence contracts/common.md#principled-implementation A physical root is redundant exactly when another selected root is its ancestor; returned spellings remain the caller's declarations.
 * @evidence contracts/common.md#clear-and-simple-design One identity-keyed map separates deduplication and ancestor coverage from spelling preservation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Root pruning uses actual resolved identity rather than textual prefixes or guessed casing.
 * @evidence contracts/common.md#meaningful-documentation Native prose and the identity-versus-spelling comment explain why selection does not rename declarations, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The transaction resolver supplies physical identity and case capability; native dirname walks the correct volume ancestry.
 * @evidence contracts/performance.md#efficient-algorithms N input spellings require identity resolution before R distinct keys are retained. Each retained key walks native dirname ancestors and queries map membership rather than all root pairs; work includes key lengths and delegated ancestor/entry/case observations, not just R times depth. Temporary map/array and spelling storage grows with input/unique-key populations, without descendant enumeration or a quota here.
 * @evidence contracts/performance.md#reuse-equivalent-work One supplied transaction shares per-key native observations during input deduplication; ancestor comparisons then use already-resolved keys. Default calls create a fresh context. Reuse expires only when the caller releases the context, not automatically at reconciliation end, and is not an atomic filesystem snapshot.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The selection owns no resident cache or native handle; returned roots transfer to the caller.
 */
export function projectInputActiveWatchDirectories(
  directories: Iterable<string>,
  identities = createProjectInputPathIdentityContext(),
): string[] {
  const unique = new Map<string, string>();
  for (const directory of directories) {
    // Coverage is decided on physical identity so two spellings of one
    // directory cannot both survive, but the surviving entry keeps the
    // caller's spelling: this function selects roots, it does not rename them.
    const identity = identities.resolve(directory);
    if (!unique.has(identity.key)) unique.set(identity.key, directory);
  }
  return [...unique]
    .filter(([key]) => {
      let ancestor = path.dirname(key);
      while (ancestor !== key) {
        if (unique.has(ancestor)) return false;
        const parent = path.dirname(ancestor);
        if (parent === ancestor) break;
        ancestor = parent;
      }
      return true;
    })
    .map(([, directory]) => directory);
}
