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

/**
 * Explain every graph member that no longer matches the compiler's state.
 *
 * Rich predicates are replayed once. Their legacy projection, when also
 * supplied, checks producer consistency; scratch inputs do not become live
 * project obligations. Legacy envelopes retain the separate snapshot policy.
 *
 * @evidence contracts/common.md#principled-implementation Predicate replay and legacy projection consistency distinguish a changed environment from conflicting or missing producer authority.
 * @evidence contracts/common.md#clear-and-simple-design One validator accumulates classified failures while envelope indexing and native codecs own normalization and observation semantics.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Conflicting representations are rejected rather than choosing whichever proof happens to pass; legacy absence is handled only by the established snapshot boundary.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains predicate replay, projection consistency, scratch exclusion and the limited legacy boundary before tags.
 * @evidence contracts/performance.md#efficient-algorithms Sets avoid duplicate predicate replay across representation branches; dominant work is graph input count plus bytes and directory entries each selected predicate observes.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Generation admission coordinates reuse of this validation; this operation computes one requested coherence verdict.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The classified failure DTO transfers to its caller; all temporary sets are local and no handle or historical population is retained.
 * @evidence contracts/portability.md#os-neutral-implementation Recorded lexical spellings are replayed through the owning filesystem and identity context rather than OS-name-derived case assumptions.
 */
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
