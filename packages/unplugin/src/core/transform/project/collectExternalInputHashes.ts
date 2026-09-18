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
 * case-only spellings share one snapshot entry, while reads retain the original
 * path supplied by the compiler. The marker is state, not an error — a recorded
 * input disappearing (or reappearing) must change the comparison exactly like a
 * content edit. Exported so `@ttsc/metro` can re-hash its recorded snapshot
 * with identical semantics at cache-key time.
 */
export function collectExternalInputHashes(
  paths: readonly string[],
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
