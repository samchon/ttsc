import path from "node:path";

import type { ITsconfigSourceSnapshotEntry } from "./ITsconfigSourceSnapshotEntry";
import { collectTsconfigSourceSnapshot } from "./collectTsconfigSourceSnapshot";

/**
 * Capture the leaf config and its complete `extends` graph in one deterministic
 * list.
 *
 * Transform wrappers derive configuration before the compiler reads it again.
 * Comparing this snapshot across the compile prevents a wrapper derived from
 * one config state from being paired with membership and output from another.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The collector retains source text and unavailable candidates under their
 *   lexical anchors; sorting by source yields deterministic graph observations.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This entry point owns the snapshot container and ordering, while a single
 *   collector owns graph traversal and relative extends behavior.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Absolute native spellings remain lexical graph keys so linked configs keep
 *   relative anchors; physical realpath is a distinct cycle observation.
 *   Sorted output orders strings without asserting a filesystem case rule.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Exact source observations replace timestamp guesses; snapshot equality is
 *   evidence for the generation owner, not a substitute for compiler errors.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Prose explains why wrapper derivation and compiler reads need matching
 *   snapshots, with purpose and consequence in separate paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The snapshot transfers to its caller and local graph state ends on return;
 *   this reader retains no historical sources or native handle.
 * @evidence contracts/performance.md#efficient-algorithms
 *   A lexical-source map avoids rereading an already observed graph node while
 *   branch physical ancestry cuts cycles. Work follows source bytes and distinct
 *   lexical graph edges and copied ancestor depths. Deterministic output sorts
 *   s source keys with O(s log s) string comparisons whose cost follows key
 *   lengths, then creates one output entry per source.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Each call must observe current contents and extends resolution. Reusing
 *   a snapshot across calls requires a validity proof owned by its consumer.
 */
export function readTsconfigSourceSnapshot(
  tsconfig: string,
): ITsconfigSourceSnapshotEntry[] {
  const output = new Map<string, string | null>();
  collectTsconfigSourceSnapshot(path.resolve(tsconfig), new Set(), output);
  return [...output.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([source, contents]) => ({ contents, path: source }));
}
