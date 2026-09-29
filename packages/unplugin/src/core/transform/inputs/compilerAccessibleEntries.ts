import type fs from "node:fs";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * Replay the compiler's accessible child-name observation. Regular files and
 * directories are recorded separately; links are classified by their targets.
 * Failed reads and inaccessible links contribute no entries, as in the
 * compiler filesystem.
 *
 * Names use UTF-8 byte ordering, matching Go's directory enumeration rather
 * than JavaScript's UTF-16 ordering for supplementary Unicode characters.
 * The supplied filesystem selects the path grammar used for linked children.
 *
 * @evidence contracts/common.md#principled-implementation Native entry kinds and followed link targets produce the compiler's separate directory and regular-file lists, with Go-compatible UTF-8 ordering and failed-read semantics.
 * @evidence contracts/common.md#clear-and-simple-design One shared observer serves graph predicate replay and frozen watch baseline capture, so both obtain the same membership representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Inaccessible links and unsupported entry kinds remain omitted according to the compiler operation rather than inferred from names or replaced by fabricated membership.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs specify link following, failure semantics, ordering and supplied path grammar, with prose separated from acknowledgment tags as the documentation guidance requires.
 * @evidence contracts/portability.md#os-neutral-implementation Native kinds come from the supplied readdir and following stat operations; the supplied platform chooses win32 or posix child joining without guessing filesystem case policy from the OS.
 * @evidence contracts/performance.md#efficient-algorithms One O(E) enumeration follows only link entries, and two O(E log E) sorts encode each name once before byte comparison; temporary arrays and bytes grow with the returned names.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This observes current directory membership once; graph and baseline owners establish whether their captured result can be shared across requests.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Entry lists and sort buffers are observation-local and the synchronous operations retain no descriptor, watcher or task.
 */
export function compilerAccessibleEntries(
  directory: string,
  filesystem: TtscTransformFilesystemOperations,
): NonNullable<
  ITtscCompilerTransformation.IInputObservation["accessibleEntries"]
> {
  const directories: string[] = [];
  const files: string[] = [];
  const pathApi =
    (filesystem.platform ?? process.platform) === "win32" ? path.win32 : path.posix;
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
  return {
    directories: sortCompilerNames(directories),
    files: sortCompilerNames(files),
  };
}

/** Encode each name once for the compiler's bytewise lexical ordering. */
function sortCompilerNames(names: string[]): string[] {
  return names
    .map((name) => ({ name, encoded: Buffer.from(name, "utf8") }))
    .sort((left, right) => Buffer.compare(left.encoded, right.encoded))
    .map(({ name }) => name);
}
