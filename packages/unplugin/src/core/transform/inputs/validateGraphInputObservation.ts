import type { ITtscCompilerTransformation } from "ttsc";

import { normalizeGraphInputObservation } from "../envelope/normalizeGraphInputObservation";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { graphInputObservationFailures } from "./graphInputObservationFailures";

/** Validate one predicate-preserving graph proof against a filesystem view. */
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
