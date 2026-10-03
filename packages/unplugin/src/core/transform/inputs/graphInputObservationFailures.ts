import type { ITtscCompilerTransformation } from "ttsc";
import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { compilerInputRealpathObservation } from "./compilerInputRealpathObservation";
import { compilerAccessibleEntries } from "./compilerAccessibleEntries";
import { compilerStatKind } from "./compilerStatKind";
import { graphInputReadHash } from "./graphInputReadHash";
import { sameHostInputRealpath } from "./sameHostInputRealpath";

/**
 * Replay the predicates recorded for one compiler-input spelling and collect
 * every mismatch. Only recorded predicates are observed; one following stat is
 * shared by kind, existence and read checks. Directory listings preserve sorted
 * compiler entry names, while realpaths compare through filesystem identity.
 *
 * @evidence contracts/common.md#principled-implementation Each present predicate compares its recorded result with compiler-compatible replay, preserving read failure, native kind, listing order and realpath identity as separate observations.
 * @evidence contracts/common.md#clear-and-simple-design The collector owns mismatch names and delegates stat, text normalization and physical equivalence to their single-purpose observers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unrecorded predicates are not invented, and read or resolution failure is compared against recorded failure instead of replaced by a convenient cache match.
 * @evidence contracts/common.md#meaningful-documentation Native prose states full collection, absent-predicate behavior and shared observations, with separated acknowledgment tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral replay uses the supplied filesystem and identity context; accessible-entry joining selects that view's path dialect and realpath equality follows actual case capabilities.
 * @evidence contracts/performance.md#efficient-algorithms One kind stat serves existence, kind and read checks; native listing/link/identity operations retain their path costs. Selected listings encode name bytes, sort E names by compared UTF-8 prefixes and serialize current/recorded names for equality; text decoding/hashing scans B read bytes. Temporary storage follows listing names/encodings/serialized text, read buffers and supplied identity observations; the returned failure list has at most six fixed predicate names. Absent listing/read predicates perform neither operation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This collects one current replay; the generation owner decides whether an earlier replay remains valid across requests.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Entry arrays and failure names are observation-local, with no persistent cache, descriptor or running task owned by the collector.
 */
export function graphInputObservationFailures(
  file: string,
  observation: ITtscCompilerTransformation.IInputObservation,
  filesystem: TtscTransformFilesystemOperations,
  identities: FilesystemPathIdentityContext,
): string[] {
  const failures: string[] = [];
  if (observation.accessibleEntries !== undefined) {
    const current = compilerAccessibleEntries(file, filesystem);
    if (
      JSON.stringify(current) !== JSON.stringify(observation.accessibleEntries)
    ) {
      failures.push("accessible-entries-changed");
    }
  }
  const kind =
    observation.fileExists !== undefined ||
    observation.directoryExists !== undefined ||
    observation.stat !== undefined ||
    observation.readFile !== undefined
      ? compilerStatKind(file, filesystem)
      : undefined;
  if (
    observation.fileExists !== undefined &&
    (kind === "file") !== observation.fileExists
  ) {
    failures.push("file-exists-changed");
  }
  if (
    observation.directoryExists !== undefined &&
    (kind === "directory") !== observation.directoryExists
  ) {
    failures.push("directory-exists-changed");
  }
  if (observation.stat !== undefined && kind !== observation.stat) {
    failures.push("stat-changed");
  }
  if (observation.readFile !== undefined) {
    const currentHash = graphInputReadHash(file, filesystem, kind);
    if (
      (observation.readFile.ok && currentHash !== observation.readFile.hash) ||
      (!observation.readFile.ok && currentHash !== null)
    ) {
      failures.push("read-file-changed");
    }
  }
  if (observation.realpath !== undefined) {
    const currentRealpath = compilerInputRealpathObservation(file, filesystem);
    if (
      observation.realpath.ok !== currentRealpath.ok ||
      (observation.realpath.ok &&
        currentRealpath.ok &&
        !sameHostInputRealpath(
          observation.realpath.path,
          currentRealpath.path,
          identities,
        ))
    ) {
      failures.push("realpath-changed");
    }
  }
  return failures;
}
