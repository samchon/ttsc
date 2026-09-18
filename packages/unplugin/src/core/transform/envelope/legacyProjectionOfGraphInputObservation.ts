import type { ITtscCompilerTransformation } from "ttsc";

import { hashText } from "../utils/hashText";

/**
 * Reconstruct a legacy hash/realpath pair only when the rich predicates prove
 * that projection without collapsing an unreadable file or failed file probe
 * into generic absence.
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
