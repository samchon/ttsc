import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import { selectDeclaredProjectInputKeys } from "./selectDeclaredProjectInputKeys";

/**
 * Memoize the declared project-walk keys for one envelope generation.
 *
 * A completed undefined result requests comparison of the whole project walk;
 * the separate built flag prevents treating that result as an unbuilt cache.
 * The cached project hashes, root and scratch policy must remain stable for the
 * lifetime of this generation state.
 *
 * @evidence contracts/common.md#principled-implementation The built flag distinguishes a legitimate undefined whole-walk policy from an uncomputed selection, preserving conservative comparison for graph-free results.
 * @evidence contracts/common.md#clear-and-simple-design Selection stays in selectDeclaredProjectInputKeys while this wrapper owns exactly its generation memo and completed-state marker.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Undefined remains the supported conservative policy instead of being replaced by an empty set that would silently authorize narrowing.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain completed undefined, the built flag and stable-generation premises; descriptive prose and tags are separated under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Selection receives the envelope's identity context and native project root, sharing filesystem-aware key matching rather than introducing its own separator or case policy.
 */
export function declaredProjectInputKeys(
  state: TtscEnvelopeDerivation,
  cached: TtscCachedProjectTransform,
): Set<string> | undefined {
  if (state.declaredInputKeysBuilt !== true) {
    state.declaredInputKeys = selectDeclaredProjectInputKeys({
      identities: state.identityContext,
      projectInputHashes: cached.inputHashes,
      projectRoot: cached.projectRoot,
      result: cached.result,
      scratchDirectory: cached.scratchDirectory,
    });
    state.declaredInputKeysBuilt = true;
  }
  return state.declaredInputKeys;
}
