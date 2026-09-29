import type { ITtscCompilerTransformation } from "ttsc";
import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { graphInputObservationFailures } from "./graphInputObservationFailures";

/**
 * Report whether replay found no changed recorded compiler predicates. Unrecorded
 * predicates impose no condition. The failure collector performs the complete
 * observation even though this adapter returns only a boolean.
 *
 * @evidence contracts/common.md#principled-implementation An empty failure list means each explicitly recorded predicate matched its replay; absent predicates do not create extra obligations.
 * @evidence contracts/common.md#clear-and-simple-design The boolean adapter uses the same failure collector as diagnostic callers instead of a competing predicate replay implementation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Acceptance is derived from actual replay failures, not a quiet watcher or a cached boolean independent of current observations.
 * @evidence contracts/common.md#meaningful-documentation Native prose states absent-predicate and complete-replay semantics, using separated tags following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral replay receives the same filesystem operations and identity context as the observation owner; the adapter adds no native spelling assumption.
 */
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
