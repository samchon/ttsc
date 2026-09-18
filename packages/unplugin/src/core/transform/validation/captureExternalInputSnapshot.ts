import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { derivationIdentity } from "../envelope/derivationIdentity";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { envelopeGraphIndexes } from "../envelope/envelopeGraphIndexes";
import type { TtscGenerationProofFailures } from "../generation/TtscGenerationProofFailures";
import { createGenerationProofFailures } from "../generation/createGenerationProofFailures";
import { recordGenerationProofFailure } from "../generation/recordGenerationProofFailure";
import type { TtscInputMetadataEvidence } from "../inputs/TtscInputMetadataEvidence";
import { graphInputObservationFailures } from "../inputs/graphInputObservationFailures";
import { graphInputStateHash } from "../inputs/graphInputStateHash";
import { hostInputRealpath } from "../inputs/hostInputRealpath";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { inputMetadataEvidence } from "../inputs/inputMetadataEvidence";
import { inputMetadataSignature } from "../inputs/inputMetadataSignature";
import { sameHostInputRealpath } from "../inputs/sameHostInputRealpath";
import { isDeclarationFile } from "../utils/isDeclarationFile";
import { MISSING_INPUT_STATE } from "./MISSING_INPUT_STATE";

/**
 * Capture external-input hashes without attaching post-compile state to an
 * earlier graph. Graph members and out-of-walk transformed sources must carry
 * compiler-time proof and still match it now; plugin-declared dependency-only
 * paths retain the historical post-compile snapshot because their own protocol
 * does not claim generation fingerprints.
 */
export function captureExternalInputSnapshot(
  cached: TtscCachedProjectTransform,
  paths: readonly string[],
): {
  complete: boolean;
  failures: TtscGenerationProofFailures;
  hashes: Record<string, string>;
  observations: Record<string, ITtscCompilerTransformation.IInputObservation>;
  realpaths: Record<string, string | null>;
  signatures: Record<string, string>;
} {
  const state = envelopeDerivation(cached);
  const filesystem = resultFilesystem(cached.result);
  const graph = envelopeGraphIndexes(state, cached);
  // A non-declaration transform output is a compiler-realized source even when
  // a malformed or legacy graph omitted its node. Its output was computed from
  // compiler-time bytes, so a post-compile host read cannot prove coherence.
  const transformSourceSpellings = new Set<string>();
  if (cached.result.type === "success") {
    for (const output of Object.keys(cached.result.typescript)) {
      if (!isDeclarationFile(output)) {
        transformSourceSpellings.add(path.resolve(cached.projectRoot, output));
      }
    }
  }
  const hashes: Record<string, string> = {};
  const observations: Record<
    string,
    ITtscCompilerTransformation.IInputObservation
  > = {};
  const realpaths: Record<string, string | null> = {};
  const signatures: Record<string, string> = {};
  const failures = createGenerationProofFailures();
  let complete = true;
  // Sandwich every read between two metadata signatures. Only a signature that
  // survived its own read, and whose stamp's tick the filesystem's clock has
  // provably left (`stampSeparable`), may stand in for the content
  // comparison; a write racing the capture, or a stamp a same-tick rewrite
  // could still reproduce, leaves the input without one, so revalidation keeps
  // re-reading it.
  const record = (
    input: string,
    before: TtscInputMetadataEvidence | undefined,
    after: string | undefined,
  ): void => {
    if (after !== undefined && before?.signature === after && before.separable)
      signatures[path.resolve(input)] = after;
  };
  for (const input of paths) {
    const identity = derivationIdentity(state, input);
    const spelling = path.resolve(input);
    const predicateObservation = graph.inputObservations.get(spelling);
    const predicateConflict = graph.inputObservationConflicts.has(spelling);
    if (
      graph.speculative.has(spelling) &&
      (predicateObservation !== undefined || predicateConflict)
    ) {
      if (predicateConflict || predicateObservation === undefined) {
        complete = false;
        recordGenerationProofFailure(failures, {
          domain: "external",
          kind: "graph-proof-conflict",
          detail: graph.inputProofFailures.get(spelling),
          path: input,
        });
        continue;
      }
      const before = inputMetadataEvidence(input, filesystem);
      const mismatches = graphInputObservationFailures(
        input,
        predicateObservation,
        filesystem,
        state.identityContext,
      );
      const after = inputMetadataSignature(input, filesystem);
      if (mismatches.length !== 0) complete = false;
      for (const kind of mismatches) {
        recordGenerationProofFailure(failures, {
          domain: "external",
          kind: `graph-${kind}`,
          path: input,
        });
      }
      if (mismatches.length === 0) record(input, before, after);
      observations[spelling] = predicateObservation;
      continue;
    }
    // A member the envelope reported only as a resolver input falls
    // through to the recorded-state branch below, the same evidence a
    // plugin-declared dependency path carries. Its absence still invalidates
    // the generation when it appears, because `missing` is recorded state.
    const realizedTransformSource = transformSourceSpellings.has(spelling);
    const speculativeOnly =
      !realizedTransformSource &&
      graph.speculative.has(spelling) &&
      !graph.inputProofs.has(spelling) &&
      !graph.inputProofConflicts.has(spelling) &&
      !graph.inputProofFailures.has(spelling);
    if (
      (realizedTransformSource || graph.memberSpellings.has(spelling)) &&
      !speculativeOnly
    ) {
      const proof = graph.inputProofs.get(spelling);
      if (proof === undefined || graph.inputProofConflicts.has(spelling)) {
        complete = false;
        recordGenerationProofFailure(failures, {
          domain: "external",
          kind: graph.inputProofConflicts.has(spelling)
            ? "graph-proof-conflict"
            : "graph-proof-missing",
          detail: graph.inputProofFailures.get(spelling),
          path: input,
        });
        continue;
      }
      const before = inputMetadataEvidence(input, filesystem);
      const currentHash = graphInputStateHash(input, filesystem);
      const currentRealpath = hostInputRealpath(input, filesystem);
      const after = inputMetadataSignature(input, filesystem);
      const realpathMatches = sameHostInputRealpath(
        proof.realpath,
        currentRealpath,
        state.identityContext,
      );
      if (currentHash !== proof.hash || !realpathMatches) {
        complete = false;
        if (currentHash !== proof.hash) {
          recordGenerationProofFailure(failures, {
            domain: "external",
            kind: "graph-content-changed",
            path: input,
          });
        }
        if (!realpathMatches) {
          recordGenerationProofFailure(failures, {
            domain: "external",
            kind: "graph-realpath-changed",
            path: input,
          });
        }
      } else if (currentHash !== null) {
        // The recorded hash is the compiler's own proof, so a signature may
        // only stand for it once the current bytes were shown to match it.
        // A path with no readable content has no bytes to stand for: it can
        // hold stable metadata while becoming readable, so it keeps the read.
        record(input, before, after);
      }
      hashes[identity] = proof.hash ?? MISSING_INPUT_STATE;
      realpaths[identity] = proof.realpath;
      continue;
    }
    const before = inputMetadataEvidence(input, filesystem);
    const hash = hostInputStateHash(input, filesystem);
    const after = inputMetadataSignature(input, filesystem);
    hashes[identity] = hash ?? MISSING_INPUT_STATE;
    if (hash !== null) record(input, before, after);
  }
  return {
    complete,
    failures,
    hashes,
    observations,
    realpaths,
    signatures,
  };
}
