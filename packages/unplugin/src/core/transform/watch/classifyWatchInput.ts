import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import type { TtscWatchInput } from "./TtscWatchInput";
import type { TtscWatchInputKind } from "./TtscWatchInputKind";

/**
 * Classify one watch input by the predicate the compiler observed on it, so
 * each adapter can hand it to the host channel that observes that predicate
 * (samchon/ttsc#1388).
 *
 * Hosts differ in what their file-dependency channel sees. For example,
 * Rolldown's and Farm's `addWatchFile` never report a created path, webpack's
 * `addDependency` never reports a directory gaining an entry, and Rollup's
 * `addWatchFile` watches a directory recursively. Deciding the kind once here
 * keeps every adapter's mapping a table instead of a second derivation.
 *
 * The project's root-file membership carries its own codec, which names its
 * kind outright (samchon/ttsc#1419).
 *
 * A recovery registration after a failed compile carries no evidence, since the
 * failed generation observed nothing reusable. It is classified from the
 * current filesystem, and an existing directory counts as a listing, since
 * nothing says which of its predicates the compiler needed.
 */
export function classifyWatchInput(
  input: TtscWatchInput,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): TtscWatchInputKind {
  const evidence = input.evidence;
  if (evidence?.state?.codec === "membership") return "membership";
  if (evidence === undefined) {
    try {
      return filesystem.stat(input.file).isDirectory() ? "listing" : "file";
    } catch {
      return "missing";
    }
  }
  const observation =
    evidence.state?.codec === "predicates"
      ? evidence.state.observation
      : undefined;
  if (observation !== undefined) {
    const directory =
      observation.directoryExists === true || observation.stat === "directory";
    const file =
      observation.fileExists === true ||
      observation.stat === "file" ||
      observation.readFile?.ok === true;
    if (observation.accessibleEntries !== undefined) {
      // An absent directory lists as empty; its creation is the change.
      return directory ? "listing" : "missing";
    }
    if (file) return "file";
    if (directory) return "presence";
    if (
      observation.directoryExists === false ||
      observation.fileExists === false ||
      observation.stat === "missing" ||
      observation.readFile?.ok === false ||
      observation.realpath?.ok === false
    ) {
      return "missing";
    }
  }
  return evidence.missing ? "missing" : "file";
}
