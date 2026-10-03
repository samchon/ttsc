import path from "node:path";
import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { ResolutionCandidate } from "./ResolutionCandidate";

/**
 * Retain the deepest physical project candidates in their original priority.
 *
 * The caller supplies one filesystem observation context for the plan. A
 * selected descendant suppresses its ancestor even when an alias has a
 * shorter lexical spelling than the ancestor. Inputs are not mutated.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Depth ordering selects physical descendants before ancestors. Containment
 *   rejects a candidate when a selected descendant already owns its files;
 *   consuming each survivor once while filtering the original sequence
 *   preserves resolution priority, including repeated references to the same
 *   candidate object.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Ordering and containment selection form one pure planning operation.
 *   Filesystem observation and client lifecycle remain with the caller.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Candidate decisions use supplied paths and filesystem identities, never
 *   lexical alias length or consumer-specific exceptions.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains priority, physical alias ordering, caller-owned observations
 *   and input immutability in separate paragraphs under the documentation skill.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The supplied identity context resolves native aliases and case behavior.
 *   pathDepth uses the supplied platform's path API on resolved physical paths;
 *   no OS-wide case folding or URL spelling substitutes for native identity.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   n candidates require O(n log n) sorting and at most O(n squared) containment
 *   checks for disjoint roots, with O(n) temporary storage. Physical depth is
 *   computed once per candidate, and one final set filter restores input order
 *   without repeated linear index searches. Workspace-root sets use a local
 *   scan rather than a persistent tree whose maintenance has no other consumer.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Sorting and containment share the caller's memoized identity observations
 *   for this plan. The result itself is not cached across filesystem changes.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   This synchronous computation retains no state or handle after return.
 *   The caller owns the supplied identity context and returned candidate array.
 */
export function filterCandidatesByPhysicalRoots(
  candidates: readonly ResolutionCandidate[],
  identities: FilesystemPathIdentityContext,
  platform: NodeJS.Platform,
): ResolutionCandidate[] {
  const sorted = candidates
    .map((candidate) => ({
      candidate,
      depth: pathDepth(identities.resolve(candidate.cwd).path, platform),
    }))
    .sort((left, right) => right.depth - left.depth);
  const selected: ResolutionCandidate[] = [];
  for (const { candidate } of sorted) {
    if (
      selected.some((entry) => identities.isWithin(candidate.cwd, entry.cwd))
    ) {
      continue;
    }
    selected.push(candidate);
  }
  const survivors = new Set(selected);
  return candidates.filter((candidate) => survivors.delete(candidate));
}

/**
 * Plan unique nonoverlapping physical roots, retaining the first alias spelling.
 *
 * A supplied preferred root takes precedence over depth when it is one of the
 * roots; a preferred root absent from the list is not added. Otherwise
 * descendants win; physical-key ordering breaks ties. The caller owns the
 * observation context and performs startup or teardown after receiving the
 * plan.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Identity keys collapse equivalent roots. Selecting the preferred root
 *   first implements explicit priority; subsequent bidirectional containment
 *   checks remove every ancestor or descendant conflict.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Deduplication, ordering and conflict selection are explicit phases in one
 *   planner. Private helpers only measure physical depth and compose containment.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Priority comes from the supplied preferred root, not a filename exception.
 *   Physical depth replaces the invalid assumption that alias length measures
 *   the directory's place in the filesystem hierarchy.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain alias spelling, preferred-root precedence,
 *   deterministic tie breaking and the caller's lifecycle responsibility under
 *   the documentation skill.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The identity context owns actual case and physical alias semantics. Depth
 *   uses native path separators for resolved physical paths, preserving Windows
 *   volume roots and POSIX roots without global case assumptions.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   n roots use O(n) map storage, O(n log n) sorting and O(n squared) worst-case
 *   conflict checks. Each root's depth and key are computed once before sorting.
 *   Local pairwise selection serves workspace-root populations without retaining
 *   a separate tree index; a large root-set workload would need reassessment.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Deduplication, depth ordering and overlap checks share the supplied identity
 *   context, so equivalent path observations are not repeatedly resolved within
 *   one plan. A fresh caller context observes later filesystem changes.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Maps and arrays are temporary to this synchronous plan; no task or handle
 *   is acquired. The caller owns the returned roots and observation context.
 */
export function planRootsByPhysicalIdentity(
  roots: readonly string[],
  preferredRoot: string | undefined,
  identities: FilesystemPathIdentityContext,
  platform: NodeJS.Platform,
): string[] {
  const unique = new Map<string, string>();
  for (const root of roots) {
    const key = identities.resolve(root).key;
    if (!unique.has(key)) unique.set(key, root);
  }
  const preferredKey = preferredRoot
    ? identities.resolve(preferredRoot).key
    : undefined;
  const ordered: string[] = [];
  if (preferredKey && unique.has(preferredKey)) {
    ordered.push(unique.get(preferredKey)!);
    unique.delete(preferredKey);
  }
  const byDepth = [...unique.entries()]
    .map(([key, root]) => ({
      depth: pathDepth(identities.resolve(root).path, platform),
      key,
      root,
    }))
    .sort(
      (left, right) =>
        right.depth - left.depth || left.key.localeCompare(right.key),
    );
  for (const { root } of byDepth) {
    ordered.push(root);
  }
  const selected: string[] = [];
  for (const root of ordered) {
    if (
      selected.some(
        (entry) =>
          identities.isWithin(entry, root) || identities.isWithin(root, entry),
      )
    ) {
      continue;
    }
    selected.push(root);
  }
  return selected;
}

function pathDepth(value: string, platform: NodeJS.Platform): number {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  return pathApi.resolve(value).split(pathApi.sep).filter(Boolean).length;
}
