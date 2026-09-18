import type { ITtscCompilerTransformation } from "ttsc";
import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { graphInputObservationFailures } from "./graphInputObservationFailures";

/** Whether every compiler-time predicate still returns its recorded value. */
export function matchesGraphInputObservation(
  file: string,
  observation: ITtscCompilerTransformation.IInputObservation,
  filesystem: TtscTransformFilesystemOperations,
  identities: FilesystemPathIdentityContext,
): boolean {
  return (
    graphInputObservationFailures(file, observation, filesystem, identities)
      .length === 0
  );
}
