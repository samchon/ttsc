/**
 * Select the first observed owning config in declaration-order depth-first
 * traversal, retaining discovery when no positive membership was observed.
 *
 * The caller supplies current direct references, observed identity keys and
 * membership observations. Native reference resolution, compiler expansion
 * and retry policy remain with those owners. A fresh visited set belongs to
 * each lookup; matching keys terminate cycles without a cross-request cache.
 *
 * @evidence contracts/common.md#principled-implementation Discovery membership takes precedence; each unseen reference is checked before its children, so declaration-order DFS preserves the first observed owner and discovered fallback.
 * @evidence contracts/common.md#clear-and-simple-design One traversal owns ordering and lookup-local visited keys; supplied operations retain native reference and membership responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Selection consumes actual observations rather than guessed include patterns, fixture layouts or persistent pathname-only answers.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish positive membership, fallback, cycles and delegated native observations.
 * @evidence contracts/portability.md#os-neutral-implementation Config spellings pass unchanged through actual reference and identity owners; observed keys, rather than platform-name case assumptions, decide repeated states.
 * @evidence contracts/performance.md#efficient-algorithms Each unseen observed identity receives at most one membership request and reference visit; edge iteration, string-key set work and delegated identity, config and compiler costs remain part of the lookup. Recursive stack depth follows the explored chain and is not bounded here.
 * @evidence contracts/performance.md#reuse-equivalent-work Initial references are reused only for discovery, and the fresh visited set avoids repeated observed identities within this lookup. No state or failed observation is reused across calls; key quality remains the identity owner's premise.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The visited keys and recursion frames live only for this synchronous lookup. Returned spelling transfers to the caller; native handles, subprocess capture and their lifetime remain delegated, with no deadline introduced here.
 */
export function selectReferencedProject(
  discovered: string,
  discoveredReferences: readonly string[],
  observations: {
    /** Current best-effort native identity key for a config spelling. */
    identity(config: string): string;

    /** Positive observation that expanded roots contain this lookup's target. */
    contains(config: string): boolean;

    /** Current direct reference configs in declaration order. */
    readReferences(config: string): readonly string[];
  },
): string {
  if (discoveredReferences.length === 0) return discovered;
  if (observations.contains(discovered)) return discovered;
  const seen = new Set<string>([observations.identity(discovered)]);

  /** DFS checks each unseen reference before descending into its children. */
  function search(config: string): string | null {
    const references =
      config === discovered
        ? discoveredReferences
        : observations.readReferences(config);
    for (const reference of references) {
      const key = observations.identity(reference);
      if (seen.has(key)) continue;
      seen.add(key);
      if (observations.contains(reference)) return reference;
      const nested = search(reference);
      if (nested !== null) return nested;
    }
    return null;
  }
  return search(discovered) ?? discovered;
}
