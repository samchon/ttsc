import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";

/**
 * Hash a list of absolute out-of-walk input paths: content SHA-256 for a
 * readable file, a stable directory-kind digest for a directory candidate, and
 * a stable `missing` marker otherwise. Keys use filesystem identity so
 * equivalent spellings share one entry under the observed case/link policy,
 * while the first observation retains the original
 * path supplied by the compiler. The marker is state, not an error — a recorded
 * input disappearing (or reappearing) must change the comparison exactly like a
 * content edit. Unavailable content does not prove physical absence. The public
 * core export supplies a physical-state dictionary; it does not preserve
 * independent lexical predicates for every alias.
 *
 * @evidence contracts/common.md#principled-implementation One native identity context deduplicates addresses for this physical-state dictionary; the first spelling's read determines its value under a stable coherent view. Raw file bytes, observed directory kind and unavailable content remain distinct states, not per-alias predicate proofs.
 * @evidence contracts/common.md#clear-and-simple-design A single loop delegates state hashing and identity rules to their existing owners, returning only the external snapshot dictionary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing observations contribute an explicit state marker instead of disappearing into a partial snapshot that falsely matches an earlier generation.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain actual equivalence, first read spelling, unavailable-content state transitions and the public physical-dictionary boundary without inventing a current consumer.
 * @evidence contracts/portability.md#os-neutral-implementation One context derived from the supplied native view applies actual directory case and link rules; case-sensitive spelling differences remain distinct and original addresses reach reads instead of globally lowercasing Windows paths.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function transfers a snapshot dictionary to its caller and owns no persistent state, native handle or running task.
 * @evidence contracts/performance.md#efficient-algorithms One pass over all supplied paths resolves native identities before deduplication. Path/component/uncached ancestor and case observations, total unique readable bytes and failed-read kind probes drive work; result keys grow with unique identities while the call-local context also retains queried aliases and ancestors.
 * @evidence contracts/performance.md#reuse-equivalent-work Equivalent native spellings share the same observation within this call; the context shares identity lookups, while fresh calls reobserve input state rather than persisting unvalidated content hashes.
 */
export function collectExternalInputHashes(
  /** Native spellings whose first observation per physical identity is retained. */
  paths: readonly string[],
  /** Stable coherent native identity, read and kind view for this call. */
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): Record<string, string> {
  const hashes: Record<string, string> = {};
  const identities = createHostPathIdentityContext(filesystem);
  for (const file of paths) {
    const identity = pathIdentityKey(file, identities);
    if (identity in hashes) {
      continue;
    }
    hashes[identity] =
      hostInputStateHash(file, filesystem) ?? MISSING_INPUT_STATE;
  }
  return hashes;
}
