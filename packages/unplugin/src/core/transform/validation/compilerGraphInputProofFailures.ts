import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { envelopeGraphIndexes } from "../envelope/envelopeGraphIndexes";
import { legacyProjectionOfGraphInputObservation } from "../envelope/legacyProjectionOfGraphInputObservation";
import type { TtscGenerationProofFailures } from "../generation/TtscGenerationProofFailures";
import { createGenerationProofFailures } from "../generation/createGenerationProofFailures";
import { recordGenerationProofFailure } from "../generation/recordGenerationProofFailure";
import { graphInputObservationFailures } from "../inputs/graphInputObservationFailures";
import { graphInputStateHash } from "../inputs/graphInputStateHash";
import { hostInputRealpath } from "../inputs/hostInputRealpath";
import { sameHostInputRealpath } from "../inputs/sameHostInputRealpath";
import { isTransformScratchInput } from "../tsconfig/isTransformScratchInput";

/** Explain every graph member that no longer matches the compiler's state. */
export function compilerGraphInputProofFailures(
  cached: TtscCachedProjectTransform,
): TtscGenerationProofFailures {
  const failures = createGenerationProofFailures();
  if (
    cached.result.type === "exception" ||
    cached.result.graph === undefined ||
    (cached.result.graph.inputHashes === undefined &&
      cached.result.graph.inputObservations === undefined &&
      cached.result.graph.inputRealpaths === undefined &&
      cached.result.graph.inputProofFailures === undefined)
  ) {
    // Legacy sidecars remain compatible for ordinary in-project graphs. Their
    // out-of-walk members are still rejected by captureExternalInputSnapshot,
    // where a post-compile snapshot cannot prove the compiler's generation.
    return failures;
  }
  const state = envelopeDerivation(cached);
  const filesystem = resultFilesystem(cached.result);
  const graph = envelopeGraphIndexes(state, cached);
  const predicateSpellings = new Set<string>();
  const predicateConflictSpellings = new Set<string>();
  for (const [spelling, observation] of graph.inputObservations) {
    predicateSpellings.add(spelling);
    for (const kind of graphInputObservationFailures(
      spelling,
      observation,
      filesystem,
      state.identityContext,
    )) {
      recordGenerationProofFailure(failures, {
        domain: "graph",
        kind,
        path: spelling,
      });
    }
  }
  for (const spelling of graph.inputObservationConflicts) {
    predicateSpellings.add(spelling);
    predicateConflictSpellings.add(spelling);
    recordGenerationProofFailure(failures, {
      domain: "graph",
      kind: "proof-conflict",
      detail: graph.inputProofFailures.get(spelling),
      path: spelling,
    });
  }
  for (const spelling of graph.memberSpellings) {
    const proof = graph.inputProofs.get(spelling);
    if (isTransformScratchInput(spelling, cached.scratchDirectory)) {
      continue;
    }
    if (predicateConflictSpellings.has(spelling)) {
      continue;
    }
    if (graph.inputProofConflicts.has(spelling)) {
      recordGenerationProofFailure(failures, {
        domain: "graph",
        kind: "proof-conflict",
        detail: graph.inputProofFailures.get(spelling),
        path: spelling,
      });
      continue;
    }
    if (graph.inputProofFailures.has(spelling)) {
      recordGenerationProofFailure(failures, {
        domain: "graph",
        kind: "proof-missing",
        detail: graph.inputProofFailures.get(spelling),
        path: spelling,
      });
      continue;
    }
    const observation = graph.inputObservations.get(spelling);
    if (observation !== undefined && proof !== undefined) {
      const projection = legacyProjectionOfGraphInputObservation(observation);
      if (
        projection.failure !== undefined ||
        projection.hash !== proof.hash ||
        !sameHostInputRealpath(
          projection.realpath,
          proof.realpath,
          state.identityContext,
        )
      ) {
        recordGenerationProofFailure(failures, {
          domain: "graph",
          kind: "proof-conflict",
          detail: projection.failure,
          path: spelling,
        });
      }
      // The rich predicates were already replayed above. Their legacy
      // projection is an internal producer-consistency check, never a reason
      // to read the same filesystem input again. A projection that cannot
      // represent the observation is itself inconsistent with a supplied
      // legacy proof, rather than permission to trust either representation.
      continue;
    }
    if (
      graph.speculative.has(spelling) &&
      predicateSpellings.has(spelling) &&
      !graph.inputProofFailures.has(spelling)
    ) {
      continue;
    }
    // A legacy sidecar can report a resolver candidate without a compiler
    // predicate. Validate it against the generation snapshot instead.
    if (proof === undefined && graph.speculative.has(spelling)) {
      continue;
    }
    if (proof === undefined) {
      recordGenerationProofFailure(failures, {
        domain: "graph",
        kind: "proof-missing",
        detail: graph.inputProofFailures.get(spelling),
        path: spelling,
      });
      continue;
    }
    const currentHash = graphInputStateHash(proof.path, filesystem);
    if (currentHash !== proof.hash) {
      recordGenerationProofFailure(failures, {
        domain: "graph",
        kind: "content-changed",
        path: proof.path,
      });
    }
    if (
      !sameHostInputRealpath(
        proof.realpath,
        hostInputRealpath(proof.path, filesystem),
        state.identityContext,
      )
    ) {
      recordGenerationProofFailure(failures, {
        domain: "graph",
        kind: "realpath-changed",
        path: proof.path,
      });
    }
  }
  return failures;
}
