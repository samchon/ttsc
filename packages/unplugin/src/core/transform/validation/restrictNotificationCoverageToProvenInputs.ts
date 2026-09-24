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
 *
 * A plugin source directory has no entry, and is kept all the same: capture
 * records it among the manifest's trees only once recomputing its state proved
 * it (samchon/ttsc#1487), and the tracker watches it as a whole subtree, so its
 * silence proves the directory as a readable entry's proves the entry. Dropping
 * it left every delivery unable to take the manifest's notification shortcut,
 * re-reading every universal input and recomputing every plugin source's
 * state.
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
    if (hostValidation?.trees.has(absolute) === true) continue;
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
