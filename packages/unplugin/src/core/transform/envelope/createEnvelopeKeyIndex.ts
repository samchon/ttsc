import path from "node:path";

import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import { derivationIdentity } from "./derivationIdentity";

/**
 * Build a first-match identity index over one envelope key map (`typescript`,
 * `dependencies`), mirroring the historical per-delivery scan that returned the
 * first entry whose resolved key matched by filesystem identity.
 *
 * @evidence contracts/common.md#principled-implementation Resolving every producer key against the same root and retaining the first value per physical identity preserves first-match lookup when distinct spellings name one file.
 * @evidence contracts/common.md#clear-and-simple-design The generic key/value adapter isolates identity indexing from the output-key and dependency-array consumers that choose when to build it.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts First-match precedence is a supported lookup rule, not a special-case alias mapping; the input record is not rewritten to conceal ambiguous producer spellings.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the supported key maps and duplicate precedence, with a blank line before acknowledgments following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Keys use native project-relative resolution and the supplied physical identity context, preserving filesystem-specific alias and case semantics without string-based OS guesses.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Visits each keyed entry once and tests the index in O(1).
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The index lets callers look entries up by identity without rescanning the
 *   keyed record.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The index is local to the call and handed to the caller.
 */
export function createEnvelopeKeyIndex<T>(
  state: TtscEnvelopeDerivation,
  projectRoot: string,
  keyed: Record<string, T>,
): Map<string, T> {
  const index = new Map<string, T>();
  for (const [candidate, value] of Object.entries(keyed)) {
    const identity = derivationIdentity(
      state,
      path.resolve(projectRoot, candidate),
    );
    if (!index.has(identity)) {
      index.set(identity, value);
    }
  }
  return index;
}
