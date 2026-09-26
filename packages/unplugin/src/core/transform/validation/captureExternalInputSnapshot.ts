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
import type { TtscExternalDependencyWitness } from "./TtscExternalDependencyWitness";

/**
 * Capture external-input hashes without attaching post-compile state to an
 * earlier graph. Graph members and out-of-walk transformed sources must carry
 * compiler-time proof and still match it now.
 *
 * A path a plugin reports in the envelope's `dependencies`, and no graph
 * proves, carries no such proof, so a reading taken here certifies nothing by
 * itself: a plugin that read one state of the path while it changed before the
 * compile returned would publish its output beside the newer state
 * (samchon/ttsc#1541). Such a path is certified only when the witness read
 * before the compile still holds, its bytes, physical target, and metadata. A
 * path with no witness, first reported by this compile, and one whose witness
 * moved both leave the dependencies unproven, and the attempt is compiled
 * again. The other paths without a graph proof keep the reading taken here:
 * host inputs are proven by their own evaluation-time fingerprints
 * (`captureUniversalHostInputValidation`), and a resolver input or config is an
 * observation of the compiler, not a plugin's read.
 *
 * @param cached The generation whose envelope names the inputs.
 * @param paths The generation's out-of-walk input paths.
 * @param witness The dependency states read before the compile, or `undefined`
 *   for an adopted compile, whose publisher already proved the state it
 *   published and whose adopter matches it against that publication.
 */
export function captureExternalInputSnapshot(
  cached: TtscCachedProjectTransform,
  paths: readonly string[],
  witness: ReadonlyMap<string, TtscExternalDependencyWitness> | undefined,
): {
  complete: boolean;
  /**
   * The plugin-reported paths no graph proves, which the next compile's witness
   * reads.
   */
  dependencies: string[];
  /**
   * Whether every one of {@link dependencies} had a witness that held across the
   * compile; always true for an adopted compile.
   */
  dependenciesProven: boolean;
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
  const dependencies: string[] = [];
  const reported = new Set<string>();
  if (cached.result.type !== "exception") {
    for (const entries of Object.values(cached.result.dependencies ?? {})) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (typeof entry === "string" && entry.length !== 0)
          reported.add(path.resolve(cached.projectRoot, entry));
      }
    }
  }
  let complete = true;
  let dependenciesProven = true;
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
    const realpath = hostInputRealpath(input, filesystem);
    const after = inputMetadataSignature(input, filesystem);
    hashes[identity] = hash ?? MISSING_INPUT_STATE;
    const pluginDependency = reported.has(spelling);
    if (pluginDependency) dependencies.push(input);
    if (pluginDependency && witness !== undefined) {
      const witnessed = witness.get(spelling);
      if (witnessed === undefined) {
        complete = false;
        dependenciesProven = false;
        recordGenerationProofFailure(failures, {
          domain: "external",
          kind: "dependency-unwitnessed",
          path: input,
        });
        continue;
      }
      if (
        !witnessed.stable ||
        before?.signature !== after ||
        witnessed.signature !== after ||
        witnessed.hash !== hash ||
        !sameHostInputRealpath(
          witnessed.realpath,
          realpath,
          state.identityContext,
        )
      ) {
        complete = false;
        dependenciesProven = false;
        recordGenerationProofFailure(failures, {
          domain: "external",
          kind: "dependency-changed",
          path: input,
        });
        continue;
      }
    }
    if (hash !== null) record(input, before, after);
  }
  return {
    complete,
    dependencies,
    dependenciesProven,
    failures,
    hashes,
    observations,
    realpaths,
    signatures,
  };
}
