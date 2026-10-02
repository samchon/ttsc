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
 *
 * @evidence contracts/common.md#principled-implementation Each codec replays its recorded meaning: complete predicates, graph hash plus physical target, raw host hash or plugin-tree state; membership and absent state cannot establish one-path agreement.
 * @evidence contracts/common.md#clear-and-simple-design Discriminant branches delegate each observation to the codec owner and expose one conservative boolean comparison.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Exceptions and unsupported membership fail comparison rather than manufacturing a cache match or accepting watcher silence.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain record-only consumers, codec differences and unsupported membership, with separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Supplied filesystem capabilities and actual physical identity comparisons preserve native semantics; plugin-tree environment validation delegates to the native build-state owner.
 * @evidence contracts/performance.md#efficient-algorithms Only the selected codec is replayed. Native path/identity observations, B read bytes, UTF-8 listing encoding/sorting/comparison or selected plugin-tree files/environment determine its work; absent predicates and membership walks are not performed. Temporary storage follows the read buffers, selected entry names/encodings and call-local identity observations, while persistent plugin reuse remains with its owner.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This asks whether current disk observations match a record; observer and plugin-tree owners establish any valid reuse, rather than caching this boolean without change witnesses.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Comparison contexts and observed buffers are call-local; retained tree caches and active watchers have separate owners.
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
