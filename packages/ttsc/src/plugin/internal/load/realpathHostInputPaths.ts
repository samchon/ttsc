import path from "node:path";

import { realpathHostInput } from "./realpathHostInput";

/**
 * The physical target of each host input, keyed by its resolved path; `null`
 * where it does not resolve. Recorded beside the content hashes because
 * retargeting a symlinked input changes what it names without changing any
 * bytes a hash has seen yet.
 *
 * @evidence contracts/common.md#principled-implementation Each resolved lexical key retains the current physical target or unresolved null, preserving symlink retargeting as distinct from unchanged content.
 * @evidence contracts/common.md#clear-and-simple-design The collection mapper delegates one-path observation and leaves content hashing and proof acceptance separate.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed canonicalization remains null instead of borrowing a recorded target or assuming the lexical path is physical identity.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains unresolved values and why realpaths accompany hashes, with prose/tag separation following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve and realpath observation support OS-neutral symlink/junction identity without blanket lowercasing or slash-only parsing.
 * @evidence contracts/performance.md#efficient-algorithms Each distinct resolved path receives one delegated realpath query per call (or reuses an observation already recorded in an optional caller-owned phase map). Path/target text and native query work accompany unique input count; duplicate resolved keys skip repeated native queries.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work An optional caller-owned phase map shares physical-target observations across overlapping checks within one synchronous verification phase and is dropped when that phase ends; without a map, each call observes every distinct path anew.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It returns caller-owned observations and retains no cross-call population or resource.
 */
export function realpathHostInputPaths(
  files: readonly string[],
  observed?: Map<string, string | null>,
  observe: (file: string) => string | null = realpathHostInput,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const file of files) {
    const resolved = path.resolve(file);
    if (Object.prototype.hasOwnProperty.call(out, resolved)) continue;
    let target: string | null;
    if (observed !== undefined && observed.has(resolved)) {
      target = observed.get(resolved)!;
    } else {
      target = observe(resolved);
      observed?.set(resolved, target);
    }
    out[resolved] = target;
  }
  return out;
}
