import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { derivationIdentity } from "../envelope/derivationIdentity";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { hostInputRealpath } from "../inputs/hostInputRealpath";
import { sameHostInputRealpath } from "../inputs/sameHostInputRealpath";

/**
 * Re-check graph-owned physical identities in complete-snapshot fallback.
 *
 * Predicate-bearing spellings are already replayed by their owning validator;
 * this pass handles only the legacy graph realpath witnesses.
 *
 * @evidence contracts/common.md#principled-implementation Each recorded legacy physical target must still match under the generation's identity context; predicate observations retain their independent native semantics.
 * @evidence contracts/common.md#clear-and-simple-design This pass owns only the physical half of legacy external snapshot fallback rather than duplicating predicate replay.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Byte equality cannot excuse a changed physical target, and aliases are not skipped merely because another spelling shares an identity.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the fallback's legacy scope and why predicate-bearing inputs are excluded.
 * @evidence contracts/performance.md#efficient-algorithms One scan of external spellings performs realpath only for entries with a legacy witness; no source content or directory tree is reread here.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Complete snapshot admission owns shared proof and adoption; this pass contributes one physical-target verdict.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The pass borrows generation records and retains no map, handle or historical result.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath is compared through actual filesystem identity policy rather than lowercasing paths or inferring case sensitivity from Windows.
 */
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
