import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import type { TtscEnvelopeDerivation } from "../envelope/TtscEnvelopeDerivation";
import { inputMetadataEvidence } from "../inputs/inputMetadataEvidence";
import { inputMetadataSignature } from "../inputs/inputMetadataSignature";
import { MISSING_INPUT_STATE } from "./MISSING_INPUT_STATE";
import { inputSignatureSlot } from "./inputSignatureSlot";
import { matchesRecordedInput } from "./matchesRecordedInput";
import { notifiesAbsence } from "./notifiesAbsence";
import { trackerProvesInputUnchanged } from "./trackerProvesInputUnchanged";

/**
 * Validate one derived input against the generation, skipping the content read
 * while the recorded metadata signature still holds and its freshly minted
 * clock reference remains safe.
 *
 * Sibling deliveries of one generation share most of their derived inputs, and
 * `graph.globals` is shared by every one of them, so re-reading and re-hashing
 * the whole derived set per delivery multiplies one generation's proven bytes
 * by the module count. The derived set is proven the same way the universal
 * descriptor inputs are ({@link matchesUniversalHostInputs}), under the same
 * rules: a currently separable unchanged signature stands in for the content
 * comparison, and any signature or clock-ordering change falls back to the full
 * comparison. A signature is recorded only around a read nothing raced, only
 * for a recorded state that came from reading the input rather than from
 * failing to, and only while the observed filesystem's own clock has provably
 * left the stamp's tick ({@link stampSeparable}), so a same-length rewrite
 * inside that tick cannot hide behind an unchanged signature.
 *
 * The signature carries the physical identity of both the lexical path and its
 * link target ({@link inputMetadataSignature}), so retargeting a symlink or
 * junction moves it and the skipped realpath comparison cannot be evaded.
 */
export function matchesProvenInput(
  cached: TtscCachedProjectTransform,
  state: TtscEnvelopeDerivation,
  input: string,
): boolean {
  if (
    trackerProvesInputUnchanged(cached.projectMutationTracker, input) ||
    trackerProvesInputUnchanged(cached.hostInputMutationTracker, input)
  ) {
    return true;
  }
  const observation = cached.externalInputObservations?.[path.resolve(input)];
  if (observation !== undefined) {
    if (
      observation.fileExists === false &&
      Object.keys(observation).length === 1 &&
      notifiesAbsence(cached, input)
    ) {
      return true;
    }
    const filesystem = resultFilesystem(cached.result);
    const spelling = path.resolve(input);
    const before = inputMetadataEvidence(input, filesystem);
    if (
      before !== undefined &&
      before.separable &&
      cached.externalInputSignatures?.[spelling] === before.signature
    ) {
      return true;
    }
    if (!matchesRecordedInput(cached, input)) return false;
    const after = inputMetadataSignature(input, filesystem);
    const signatures = (cached.externalInputSignatures ??= {});
    if (before?.separable === true && before.signature === after) {
      signatures[spelling] = after;
    } else {
      delete signatures[spelling];
    }
    return true;
  }
  const slot = inputSignatureSlot(cached, state, input);
  if (slot === undefined) {
    return matchesRecordedInput(cached, input);
  }
  if (slot.recorded === MISSING_INPUT_STATE && notifiesAbsence(cached, input)) {
    // The generation's watcher holds this exact name, and the caller already
    // established that neither tracker failed and neither reported a change.
    // The path is therefore still absent, proven by the same channel that
    // proves project membership, and probing it again would only repeat what
    // the notification already answered.
    return true;
  }
  const filesystem = resultFilesystem(cached.result);
  const before = inputMetadataEvidence(input, filesystem);
  if (
    before !== undefined &&
    before.separable &&
    slot.signatures[slot.key] === before.signature
  ) {
    return true;
  }
  if (!matchesRecordedInput(cached, input)) {
    return false;
  }
  // A recorded `missing` state is the one comparison that succeeds without
  // reading anything: an unreadable path still reports `missing`, so its
  // metadata can hold still while the bytes behind it appear. Only content a
  // read produced may be stood for.
  const after =
    slot.recorded === MISSING_INPUT_STATE
      ? undefined
      : inputMetadataSignature(input, filesystem);
  if (after !== undefined && before?.signature === after && before.separable) {
    slot.signatures[slot.key] = after;
  } else {
    delete slot.signatures[slot.key];
  }
  return true;
}
