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
 * @evidence contracts/performance.md#efficient-algorithms Each input is natively normalized for its lexical key and receives one delegated current realpath query. Path/target text and native query work accompany input count; mapped pairs and the result coexist transiently, and duplicate resolved keys overwrite earlier observations rather than avoiding their queries.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current physical targets must be observed anew to detect retargeting; this mapper owns no canonicalization cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It returns caller-owned observations and retains no cross-call population or resource.
 */
export function realpathHostInputPaths(
  files: readonly string[],
): Record<string, string | null> {
  return Object.fromEntries(
    files.map((file) => [path.resolve(file), realpathHostInput(file)]),
  );
}
