import type { ITtscCompilerTransformation } from "ttsc";

import { hashText } from "../utils/hashText";

/**
 * Reproduce the compiler producer's legacy hash/realpath projection.
 *
 * Successful reads supply content identity and known directories supply the
 * directory sentinel, both requiring a successful realpath. A known file
 * without successful content cannot supply a complete legacy proof. Otherwise
 * a negative predicate projects to null as the producer does; that lossy value
 * does not establish generic path absence. Rich predicates must still be replayed.
 *
 * @evidence contracts/common.md#principled-implementation Branch order matches inputObservationFS.proof in the Go producer so paired rich/legacy records can be checked for producer consistency; null projection is lossy and cannot replace exact predicate replay.
 * @evidence contracts/common.md#clear-and-simple-design This pure adapter owns only producer encoding; normalization, cross-predicate compatibility and live filesystem comparison remain separate operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The directory marker is the supported legacy encoding and missing content/realpath stays an explicit failure; the adapter does not invent a content digest from a positive file predicate.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain successful projections, incomplete file proof and the negative-predicate null limitation, with separate acknowledgment tags following the documentation skill.
 */
export function legacyProjectionOfGraphInputObservation(
  observation: ITtscCompilerTransformation.IInputObservation,
):
  | { failure?: undefined; hash: string | null; realpath: string | null }
  | { failure: string } {
  if (observation.readFile?.ok === true) {
    return observation.realpath?.ok === true
      ? {
          hash: observation.readFile.hash,
          realpath: observation.realpath.path,
        }
      : { failure: "realpath-unavailable" };
  }
  const directory =
    observation.stat === "directory" || observation.directoryExists === true;
  if (directory) {
    return observation.realpath?.ok === true
      ? {
          hash: hashText("ttsc:host-input:directory\0"),
          realpath: observation.realpath.path,
        }
      : { failure: "realpath-unavailable" };
  }
  const file = observation.stat === "file" || observation.fileExists === true;
  if (file) {
    return { failure: "content-unavailable" };
  }
  const missing =
    observation.stat === "missing" ||
    observation.fileExists === false ||
    observation.directoryExists === false ||
    observation.readFile?.ok === false;
  return missing
    ? { hash: null, realpath: null }
    : { failure: "unsupported-input-kind" };
}
