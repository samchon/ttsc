/**
 * Find the entry stored for a client root, or undefined when none exists.
 *
 * The stored root spelling is matched first. An entry's key is observed from
 * the filesystem when the entry is created and can differ when it is computed
 * again later, for example after the directory behind a link is removed, so the
 * recomputed key is only the fallback for a root the entries do not store
 * verbatim. The operation reads its inputs and changes nothing.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Exact string equality with the stored root needs no filesystem observation
 *   and cannot drift. The keyed lookup is the fallback for an alias spelling
 *   whose identity key equals a stored entry's key.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One function owns the two-step lookup order. Key computation is injected,
 *   so this module has no editor or filesystem dependency, and the caller keeps
 *   ownership of the entry map.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No path is special-cased and nothing is patched. The stored-root step
 *   removes a dependence on a recomputed key that the filesystem can change.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states the lookup order, why the stored spelling comes first and that
 *   the operation is read-only, in separate paragraphs.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   It compares stored root strings and calls the injected key function; it
 *   performs no filesystem access itself.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   One linear scan over n entries by string equality plus at most one Map
 *   lookup, O(n), excluding the identity observations the injected key
 *   function costs.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Stored-root matching reads current entries on each call; the injected key
 *   function owns any observation sharing.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   It retains nothing; the caller owns the entries and the map.
 */
export function findClientEntryByRoot<E extends { id: string; root: string }>(
  entries: Iterable<E>,
  byKey: ReadonlyMap<string, E>,
  root: string,
  rootKey: (root: string) => string,
): E | undefined {
  for (const entry of entries) {
    if (entry.root === root) {
      return entry;
    }
  }
  return byKey.get(rootKey(root));
}
