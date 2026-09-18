import type { ITtscCompilerTransformation } from "ttsc";

/** Whether one predicate set can describe a single stable filesystem state. */
export function graphInputObservationCompatible(
  observation: ITtscCompilerTransformation.IInputObservation,
): boolean {
  const { accessibleEntries, directoryExists, fileExists, readFile, stat } =
    observation;
  const hasAccessibleEntries =
    accessibleEntries !== undefined &&
    (accessibleEntries.directories.length !== 0 ||
      accessibleEntries.files.length !== 0);
  if (
    hasAccessibleEntries &&
    (fileExists === true ||
      directoryExists === false ||
      (stat !== undefined && stat !== "directory") ||
      readFile?.ok === true)
  ) {
    return false;
  }
  if (fileExists === true && directoryExists === true) return false;
  if (
    stat === "directory" &&
    (fileExists === true || directoryExists === false)
  ) {
    return false;
  }
  if (stat === "file" && (fileExists === false || directoryExists === true)) {
    return false;
  }
  if (stat === "missing" && (fileExists === true || directoryExists === true)) {
    return false;
  }
  if (
    readFile?.ok === true &&
    (fileExists === false ||
      directoryExists === true ||
      (stat !== undefined && stat !== "file"))
  ) {
    return false;
  }
  return true;
}
