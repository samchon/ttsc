import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { graphInputStateHash } from "../inputs/graphInputStateHash";
import { hostInputRealpath } from "../inputs/hostInputRealpath";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { matchesGraphInputObservation } from "../inputs/matchesGraphInputObservation";
import { pluginSourceHolds } from "../inputs/pluginSourceHolds";
import { sameHostInputRealpath } from "../inputs/sameHostInputRealpath";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";
import type { TtscWatchInputEvidence } from "./TtscWatchInputEvidence";

/**
 * Whether one input's disk state is still what its evidence recorded: the proof
 * a delivery makes of a recorded input (`matchesRecordedInput`), made from the
 * evidence alone, for a process that holds the record and no generation.
 *
 * Each codec is proven the way it was recorded: a predicate observation by
 * every predicate it holds, listings included (`matchesGraphInputObservation`);
 * a graph input by its state hash and physical target; a host input by the host
 * bytes' hash. The root-file membership is a walk over many paths and never
 * stands for one, so its evidence matches nothing here; the record holds it
 * apart. Evidence without a state proves nothing and does not match.
 */
export function watchInputEvidenceMatchesDisk(
  file: string,
  evidence: TtscWatchInputEvidence,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): boolean {
  const state = evidence.state;
  if (state === undefined || state.codec === "membership") return false;
  try {
    if (state.codec === "tree") {
      return pluginSourceHolds(file, state.digest, filesystem);
    }
    if (state.codec === "predicates") {
      return matchesGraphInputObservation(
        file,
        state.observation,
        filesystem,
        createHostPathIdentityContext(filesystem),
      );
    }
    if (state.codec === "graph") {
      return (
        sameHostInputRealpath(
          state.realpath,
          hostInputRealpath(file, filesystem),
          createHostPathIdentityContext(filesystem),
        ) &&
        state.hash ===
          (graphInputStateHash(file, filesystem) ?? MISSING_INPUT_STATE)
      );
    }
    return (
      state.hash ===
      (hostInputStateHash(file, filesystem) ?? MISSING_INPUT_STATE)
    );
  } catch {
    return false;
  }
}
