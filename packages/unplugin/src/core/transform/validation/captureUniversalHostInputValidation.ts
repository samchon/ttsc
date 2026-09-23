import path from "node:path";

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
import { pluginSourceState } from "../inputs/pluginSourceState";
import { sameHostInputRealpath } from "../inputs/sameHostInputRealpath";
import type { TtscHostInputValidation } from "./TtscHostInputValidation";
import { matchesRecordedInput } from "./matchesRecordedInput";

/** Capture the universal-input manifest while the generation is still fresh. */
export function captureUniversalHostInputValidation(
  cached: TtscCachedProjectTransform,
  currentFile: string,
): {
  failures: TtscGenerationProofFailures;
  validation?: TtscHostInputValidation;
} {
  const filesystem = resultFilesystem(cached.result);
  const state = envelopeDerivation(cached);
  const failures = createGenerationProofFailures();
  const validation: TtscHostInputValidation = {
    entries: new Map(),
    covered: new Set(),
    missing: new Map(),
    trees: new Map(),
  };
  for (const input of selectPersistentHostInputs({
    filesystem,
    projectRoot: cached.projectRoot,
    result: cached.result,
    scratchDirectory: cached.scratchDirectory,
    temporaryTsconfig: cached.temporaryTsconfig,
  })) {
    const generationHashes =
      cached.result.type === "exception"
        ? undefined
        : cached.result.hostInputHashes;
    const generationRealpaths =
      cached.result.type === "exception"
        ? undefined
        : cached.result.hostInputRealpaths;
    const expected = generationHashes?.[path.resolve(input)];
    // Every persistent universal input must carry an evaluation-time
    // fingerprint. If a plugin/native host cannot provide one, keep the fresh
    // result but decline narrow long-lived reuse.
    let readable = false;
    if (expected === undefined) {
      const current = path.resolve(currentFile);
      if (path.resolve(input) !== current) {
        recordGenerationProofFailure(failures, {
          domain: "host",
          kind: "content-proof-missing",
          path: input,
        });
        return { failures };
      }
      // The current module is the one this compile was started for, and its
      // host carries no hash for it. Its recorded state is the walk's read of
      // the disk, which `matchesRecordedInput` below compares; no signature
      // is adopted for it, so every delivery re-reads it.
    } else {
      const current = hostInputStateHash(input, filesystem);
      if (expected !== current) {
        recordGenerationProofFailure(failures, {
          domain: "host",
          kind: "content-changed",
          path: input,
        });
        return { failures };
      }
      // A path both sides agree they could not read carries no bytes for a
      // signature to stand for. It still belongs in the manifest, so the
      // content comparison keeps running for it on every delivery.
      readable = current !== null;
    }
    const absoluteInput = path.resolve(input);
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
            : "realpath-proof-missing",
          path: input,
        });
        return { failures };
      }
    }
    validation.covered.add(path.resolve(input));
    const before = inputMetadataEvidence(input, filesystem);
    if (!matchesRecordedInput(cached, input)) {
      recordGenerationProofFailure(failures, {
        domain: "host",
        kind: "snapshot-mismatch",
        path: input,
      });
      return { failures };
    }
    const after = inputMetadataSignature(input, filesystem);
    if (before?.signature !== after) {
      recordGenerationProofFailure(failures, {
        domain: "host",
        kind: "changed-during-validation",
        path: input,
      });
      return { failures };
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
        return { failures };
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
    // The probe below proves this exact spelling absent, so the per-module loop
    // need not re-derive it either.
    let names = validation.missing.get(probe.directory);
    if (names === undefined) {
      names = new Set<string>();
      validation.missing.set(probe.directory, names);
    }
    names.add(
      normalizeHostInputName(
        probe.name,
        state.identityContext.caseSensitive(probe.directory),
      ),
    );
  }
  // A plugin binary keyed on a source other than the disk's now, whether it
  // was built here or adopted from another worker, is output for a state
  // already gone (samchon/ttsc#1487).
  for (const [directory, digest] of selectPluginSourceInputs(cached.result)) {
    if (pluginSourceState(directory) !== digest) {
      recordGenerationProofFailure(failures, {
        domain: "host",
        kind: "content-changed",
        path: directory,
      });
      return { failures };
    }
    validation.covered.add(directory);
    validation.trees.set(directory, digest);
  }
  cached.hostInputValidation = validation;
  return { failures, validation };
}
