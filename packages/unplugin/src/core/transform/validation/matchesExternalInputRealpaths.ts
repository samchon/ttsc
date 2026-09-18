import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { derivationIdentity } from "../envelope/derivationIdentity";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { hostInputRealpath } from "../inputs/hostInputRealpath";
import { sameHostInputRealpath } from "../inputs/sameHostInputRealpath";

/** Re-check graph-owned physical identities in complete-snapshot fallback. */
export function matchesExternalInputRealpaths(
  cached: TtscCachedProjectTransform,
): boolean {
  const expected = cached.externalInputRealpaths;
  if (expected === undefined || Object.keys(expected).length === 0) return true;
  const state = envelopeDerivation(cached);
  const filesystem = resultFilesystem(cached.result);
  for (const input of cached.externalInputPaths ?? []) {
    if (cached.externalInputObservations?.[path.resolve(input)] !== undefined) {
      continue;
    }
    const identity = derivationIdentity(state, input);
    if (!Object.prototype.hasOwnProperty.call(expected, identity)) continue;
    if (
      !sameHostInputRealpath(
        expected[identity],
        hostInputRealpath(input, filesystem),
        state.identityContext,
      )
    ) {
      return false;
    }
  }
  return true;
}
