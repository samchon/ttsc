import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { derivationIdentity } from "../envelope/derivationIdentity";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";
import { MISSING_INPUT_STATE } from "./MISSING_INPUT_STATE";
import type { TtscHostInputValidation } from "./TtscHostInputValidation";

/**
 * Keep watcher silence as a content proof only for inputs whose bytes capture
 * actually proved.
 *
 * The observers must open before the post-compile snapshots so they can witness
 * an A-B-A race. Their exact coverage can only be narrowed after those reads.
 * Existing-but-unreadable and absent inputs record the same `missing` state;
 * neither may inherit a content shortcut because its metadata can stay fixed
 * while bytes become readable. Missing resolver candidates inside the project
 * retain their separate component-aware candidate tracker, while every other
 * such input continues through the recorded predicate or directory-list proof.
 */
export function restrictNotificationCoverageToProvenInputs(
  tracker: TtscProjectMutationTracker | undefined,
  cached: TtscCachedProjectTransform,
  hostValidation: TtscHostInputValidation | undefined,
): void {
  if (!(tracker?.covered instanceof Set)) return;
  const covered = tracker.covered as Set<string>;
  const state = envelopeDerivation(cached);
  for (const input of [...covered]) {
    const absolute = path.resolve(input);
    const hostEntry = hostValidation?.entries.get(absolute);
    if (
      (hostValidation?.covered.has(absolute) === true &&
        (hostEntry === undefined ||
          (hostEntry.readable === false && hostEntry.strict !== true))) ||
      cached.externalInputHashes?.[derivationIdentity(state, absolute)] ===
        MISSING_INPUT_STATE ||
      cached.externalInputObservations?.[absolute]?.readFile?.ok === false ||
      cached.externalInputObservations?.[absolute]?.fileExists === false
    ) {
      covered.delete(input);
    }
  }
}
