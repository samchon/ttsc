import path from "node:path";
import { PluginBuildEnvironmentReadings, processPluginBuildEnvironment } from "ttsc/plugin-source";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { selectPluginSourceInputs } from "../envelope/selectPluginSourceInputs";
import { normalizeHostInputName } from "../filesystem/normalizeHostInputName";
import type { TtscGenerationProofFailures } from "../generation/TtscGenerationProofFailures";
import { createGenerationProofFailures } from "../generation/createGenerationProofFailures";
import { recordGenerationProofFailure } from "../generation/recordGenerationProofFailure";
import { selectPersistentHostInputs } from "../generation/selectPersistentHostInputs";
import { hostInputRealpath } from "../inputs/hostInputRealpath";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { inputMetadataEvidence } from "../inputs/inputMetadataEvidence";
import { inputMetadataSignature } from "../inputs/inputMetadataSignature";
import { missingPathProbe } from "../inputs/missingPathProbe";
import { pluginSourceHolds } from "../inputs/pluginSourceHolds";
import { usesPreparedPluginBuildEnvironments } from "../inputs/preparePluginBuildEnvironments";
import { sameHostInputRealpath } from "../inputs/sameHostInputRealpath";
import type { TtscHostInputValidation } from "./TtscHostInputValidation";
import { matchesRecordedInput } from "./matchesRecordedInput";

/**
 * Capture the universal-input manifest while the generation is still fresh.
 *
 * Missing or changed publication proof returns failures without adopting a
 * manifest. Every universal input is examined so an unavailable observation
 * cannot hide another input's actual change. Success attaches entries, absence
 * probes and plugin-tree witnesses to this generation for later reuse decisions.
 * The async generation owner prepares native plugin environments beforehand;
 * an unavailable or stale prepared reading declines admission without a cold
 * native probe on the host's thread.
 * Standalone synchronous callers retain the original native observation API;
 * result identity records async execution ownership even when preparation fails.
 *
 * @evidence contracts/common.md#principled-implementation Evaluation-time content and physical-target witnesses must agree with the generation snapshot before reuse; explicit producer observation unavailability remains distinct from changed, contradictory or unexplained missing proof, and every input is checked before classifying the attempt.
 * @evidence contracts/common.md#clear-and-simple-design One admission operation builds the manifest; per-entry, grouped or exact-native absence and tree validators own its subsequent checks.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing publication witness declines narrow reuse instead of certifying an input from a convenient newer read.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains failed admission and successful generation attachment; inline comments justify readable-state, blocker and tree distinctions.
 * @evidence contracts/portability.md#os-neutral-implementation Injected filesystem operations and measured generation case policy qualify native metadata and missing-name spelling; an unknown directory case policy requires exact native ENOENT or ENOTDIR rather than a listing-only absence proof, while physical targets and aliases remain distinct from content identity.
 */
export function captureUniversalHostInputValidation(
  cached: TtscCachedProjectTransform,
  currentFile: string,
): {
  /** Classified reasons why universal input authority could not be admitted. */
  failures: TtscGenerationProofFailures;

  /** Present only after this complete manifest passed admission. */
  validation?: TtscHostInputValidation;
} {
  const filesystem = resultFilesystem(cached.result);
  const state = envelopeDerivation(cached);
  const failures = createGenerationProofFailures();
  const validation: TtscHostInputValidation = {
    entries: new Map(),
    covered: new Set(),
    missing: new Map(),
    directMissing: new Set(),
    trees: new Map(),
  };
  const result = cached.result;
  const generationHashes =
    result.type === "exception" ? undefined : result.hostInputHashes;
  const generationRealpaths =
    result.type === "exception" ? undefined : result.hostInputRealpaths;
  const proofFailures =
    result.type === "exception" ? undefined : result.hostInputProofFailures;
  if (result.type !== "exception" && result.observationsComplete === false) {
    recordGenerationProofFailure(failures, {
      domain: "host",
      kind: "observation-unavailable",
      detail: "observer-incomplete",
    });
  }
  for (const [input, reason] of Object.entries(proofFailures ?? {})) {
    recordGenerationProofFailure(failures, {
      domain: "host",
      kind:
        reason === "observation-unavailable"
          ? "observation-unavailable"
          : "producer-proof-failed",
      detail: reason,
      path: input,
    });
  }
  for (const input of selectPersistentHostInputs({
    filesystem,
    projectRoot: cached.projectRoot,
    result:
      result.type === "exception"
        ? result
        : {
            ...result,
            hostInputs: [
              ...new Set([
                ...(result.hostInputs ?? []),
                ...Object.keys(generationHashes ?? {}),
                ...Object.keys(generationRealpaths ?? {}),
                ...Object.keys(proofFailures ?? {}),
              ]),
            ],
          },
    scratchDirectory: cached.scratchDirectory,
    temporaryTsconfig: cached.temporaryTsconfig,
  })) {
    const absoluteInput = path.resolve(input);
    const unavailable =
      proofFailures?.[absoluteInput] === "observation-unavailable";
    const expected = generationHashes?.[absoluteInput];
    // Every persistent universal input needs evaluation-time authority. Only
    // explicit producer observation unavailability can permit a local fresh
    // delivery without it; unexplained missing proof still rejects admission.
    let readable = false;
    if (expected === undefined) {
      if (!unavailable) {
        const current = path.resolve(currentFile);
        if (path.resolve(input) !== current) {
          recordGenerationProofFailure(failures, {
            domain: "host",
            kind: "content-proof-missing",
            path: input,
          });
          continue;
        }
        // The current module is the one this compile was started for, and its
        // host carries no hash for it. Its recorded state is the walk's read of
        // the disk, which `matchesRecordedInput` below compares; no signature
        // is adopted for it, so every delivery re-reads it.
      }
    } else {
      const current = hostInputStateHash(input, filesystem);
      if (expected !== current) {
        recordGenerationProofFailure(failures, {
          domain: "host",
          kind: "content-changed",
          path: input,
        });
        continue;
      }
      // A path both sides agree they could not read carries no bytes for a
      // signature to stand for. It still belongs in the manifest, so the
      // content comparison keeps running for it on every delivery.
      readable = current !== null;
    }
    if (generationRealpaths !== undefined) {
      if (
        !Object.prototype.hasOwnProperty.call(
          generationRealpaths,
          absoluteInput,
        ) ||
        !sameHostInputRealpath(
          generationRealpaths[absoluteInput],
          hostInputRealpath(input, filesystem),
          state.identityContext,
        )
      ) {
        recordGenerationProofFailure(failures, {
          domain: "host",
          kind: Object.prototype.hasOwnProperty.call(
            generationRealpaths,
            absoluteInput,
          )
            ? "realpath-changed"
            : unavailable
              ? "observation-unavailable"
              : "realpath-proof-missing",
          path: input,
        });
        continue;
      }
    }
    // Known observations still undergo content and physical-target comparison
    // above. Their unavailable closure can never become a reusable manifest.
    if (unavailable) continue;
    validation.covered.add(path.resolve(input));
    const before = inputMetadataEvidence(input, filesystem);
    if (!matchesRecordedInput(cached, input)) {
      recordGenerationProofFailure(failures, {
        domain: "host",
        kind: "snapshot-mismatch",
        path: input,
      });
      continue;
    }
    const after = inputMetadataSignature(input, filesystem);
    if (before?.signature !== after) {
      recordGenerationProofFailure(failures, {
        domain: "host",
        kind: "changed-during-validation",
        path: input,
      });
      continue;
    }
    if (before !== undefined) {
      // Do not key this manifest by physical identity. A symlink/junction
      // spelling and its selected target deliberately share that identity,
      // but both lexical paths must survive so retargeting the alias is visible.
      validation.entries.set(path.resolve(input), {
        path: input,
        readable,
        realpath: hostInputRealpath(input, filesystem),
        // The signature stands in for content only when the read produced the
        // recorded bytes and the filesystem's clock has provably left the
        // stamp's tick; otherwise the content comparison keeps running until
        // the re-earn path can prove both.
        signature: readable && before.separable ? before.signature : undefined,
      });
      continue;
    }
    const probe = missingPathProbe(input, filesystem);
    if (probe.blocker !== undefined) {
      const signature = inputMetadataSignature(probe.blocker, filesystem);
      if (signature === undefined) {
        recordGenerationProofFailure(failures, {
          domain: "host",
          kind: "blocker-metadata-unavailable",
          path: probe.blocker,
        });
        continue;
      }
      // A blocker proves a kind and an identity, not content: it is the
      // non-directory ancestor that makes everything below it unreachable, and
      // it cannot stop being that without its metadata moving. So it keeps a
      // usable signature whether or not anything read it, and exempt from the
      // clock-separability rule content signatures need — a same-tick rewrite
      // of its bytes leaves it exactly as blocking as before.
      validation.covered.add(path.resolve(probe.blocker));
      validation.entries.set(path.resolve(probe.blocker), {
        path: probe.blocker,
        readable: true,
        realpath: hostInputRealpath(probe.blocker, filesystem),
        signature,
        strict: true,
      });
      continue;
    }
    const caseSensitive = state.identityContext.caseSensitive(probe.directory);
    if (caseSensitive === undefined) {
      // Unknown case policy withdraws the listing shortcut, not the native
      // filesystem's ability to answer whether this exact path exists.
      let absent = false;
      try {
        filesystem.stat(input);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        absent = code === "ENOENT" || code === "ENOTDIR";
      }
      if (absent) validation.directMissing!.add(absoluteInput);
      else {
        recordGenerationProofFailure(failures, {
          domain: "host",
          kind: "case-policy-unavailable",
          path: probe.directory,
        });
      }
      continue;
    }
    // The probe below proves this exact spelling absent, so the per-module loop
    // need not re-derive it either.
    let names = validation.missing.get(probe.directory);
    if (names === undefined) {
      names = new Set<string>();
      validation.missing.set(probe.directory, names);
    }
    names.add(
      normalizeHostInputName(probe.name, caseSensitive),
    );
  }
  // A plugin binary keyed on a source other than the disk's now, whether it
  // was built here or adopted from another worker, is output for a state
  // already gone (samchon/ttsc#1487).
  for (const [directory, digest] of selectPluginSourceInputs(cached.result)) {
    // The environment is recorded as read before the proof, so it is never a
    // reading the proof did not see; one that moved meanwhile only makes the
    // next delivery prove the tree again.
    const prepared = usesPreparedPluginBuildEnvironments(cached.result);
    const environment = prepared
      ? PluginBuildEnvironmentReadings.cached(directory)
      : processPluginBuildEnvironment(directory);
    if (environment === undefined || !pluginSourceHolds(directory, digest, filesystem, prepared ? { environment } : undefined)) {
      recordGenerationProofFailure(failures, {
        domain: "host",
        kind: "content-changed",
        path: directory,
      });
      continue;
    }
    validation.covered.add(directory);
    validation.trees.set(directory, digest);
    (validation.treeEnvironments ??= new Map()).set(directory, environment);
  }
  if (failures.entries.length !== 0 || failures.omitted !== 0) {
    return { failures };
  }
  cached.hostInputValidation = validation;
  return { failures, validation };
}
