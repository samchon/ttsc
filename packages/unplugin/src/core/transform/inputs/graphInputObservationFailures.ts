import type fs from "node:fs";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";
import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { compilerInputRealpathObservation } from "./compilerInputRealpathObservation";
import { compilerStatKind } from "./compilerStatKind";
import { graphInputReadHash } from "./graphInputReadHash";
import { sameHostInputRealpath } from "./sameHostInputRealpath";

/** Return the exact recorded predicates that no longer hold for one spelling. */
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

/** Replay TypeScript-Go's accessible-entry classification and sorted order. */
function compilerAccessibleEntries(
  directory: string,
  filesystem: TtscTransformFilesystemOperations,
): NonNullable<
  ITtscCompilerTransformation.IInputObservation["accessibleEntries"]
> {
  const directories: string[] = [];
  const files: string[] = [];
  const pathApi = filesystem.platform === "win32" ? path.win32 : path.posix;
  let entries: fs.Dirent[];
  try {
    entries = filesystem.readdir(directory);
  } catch {
    return { directories, files };
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      directories.push(entry.name);
      continue;
    }
    if (entry.isFile()) {
      files.push(entry.name);
      continue;
    }
    if (!entry.isSymbolicLink()) continue;
    try {
      const target = filesystem.stat(pathApi.join(directory, entry.name));
      if (target.isDirectory()) directories.push(entry.name);
      else if (target.isFile()) files.push(entry.name);
    } catch {
      // TypeScript-Go omits inaccessible and broken linked entries.
    }
  }
  directories.sort();
  files.sort();
  return { directories, files };
}
