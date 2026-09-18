import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import { selectDeclaredProjectInputKeys } from "./selectDeclaredProjectInputKeys";

/** {@link selectDeclaredProjectInputKeys} memoized per envelope generation. */
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
