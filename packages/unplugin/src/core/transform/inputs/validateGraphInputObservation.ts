import type { ITtscCompilerTransformation } from "ttsc";

import { normalizeGraphInputObservation } from "../envelope/normalizeGraphInputObservation";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { graphInputObservationFailures } from "./graphInputObservationFailures";

/**
 * Normalize and replay one compiler graph observation against a filesystem view.
 * Invalid or contradictory proof shape returns proof-conflict; otherwise the
 * returned strings identify recorded predicates that no longer hold.
 *
 * @evidence contracts/common.md#principled-implementation Normalization rejects unsupported proof combinations before replay, and a filesystem-derived identity context supplies target equivalence for valid observations.
 * @evidence contracts/common.md#clear-and-simple-design Proof-shape validation, context creation and predicate replay each retain a single owner rather than duplicating their rules here.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Malformed observations cannot bypass normalization or acquire fabricated successful predicates to match a cache entry.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains conflict versus changed-predicate results, followed by a blank acknowledgment separator under documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral normalization uses the supplied path dialect and constructs identity policy from that same filesystem's capabilities; recorded protocol paths are not blindly compared as native strings.
 */
export function validateGraphInputObservation(
  file: string,
  observation: ITtscCompilerTransformation.IInputObservation,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string[] {
  const normalized = normalizeGraphInputObservation(
    observation,
    filesystem.platform,
  );
  if (normalized === undefined) return ["proof-conflict"];
  return graphInputObservationFailures(
    file,
    normalized,
    filesystem,
    createHostPathIdentityContext(filesystem),
  );
}
