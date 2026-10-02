import type fs from "node:fs";
import path from "node:path";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { PERMISSIVE_PROJECT_MEMBERSHIP_POLICY } from "../../tsconfig/PERMISSIVE_PROJECT_MEMBERSHIP_POLICY";
import { matchesProjectRootFile } from "../../tsconfig/matchesProjectRootFile";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { hashText } from "../utils/hashText";
import type { TtscProjectDirectorySnapshot } from "./TtscProjectDirectorySnapshot";
import type { TtscProjectWalkFailure } from "./TtscProjectWalkFailure";
import { isExcludedProjectDirectory } from "./isExcludedProjectDirectory";
import { isIgnoredProjectEntry } from "./isIgnoredProjectEntry";
import { isPossibleProgramEntry } from "./isPossibleProgramEntry";
import { isProjectWalkDirectory } from "./isProjectWalkDirectory";

/**
 * Enumerate every regular file under `root` that the resolved configuration can
 * admit, skipping the directories it excludes
 * ({@link isExcludedProjectDirectory}) and, for a configuration that could not
 * be read, the names no configuration needs ({@link isIgnoredProjectEntry}).
 *
 * Uses an iterative DFS instead of `fs.readdirSync` recursion to avoid
 * unbounded call-stack depth on deep project trees. The result is sorted so
 * that hash comparisons are deterministic across OS-level directory orderings.
 *
 * @evidence contracts/common.md#principled-implementation Iterative lexical descent applies the same configured membership policy as event classification, and metadata bracketing records incomplete or changing directories instead of certifying a torn snapshot.
 * @evidence contracts/common.md#clear-and-simple-design One enumeration pass records child structure, then relevance propagation and digest construction use those records; the second phase is necessary because parent relevance depends on descendants.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Exclusion follows resolved compiler admission rather than compensating name lists, and failed observations remain explicit proof failures instead of disappearing from a successful result.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain iterative descent and deterministic output; inline comments explain two-phase relevance, filtered membership and the metadata helper's narrower race-detection role.
 * @evidence contracts/portability.md#os-neutral-implementation The supplied native readdir and bigint stat view owns entry kinds and timestamps; its platform selects child joining, parent extraction and membership grammar, and final sorting removes OS enumeration-order dependence.
 */
export function walkProjectInputs(
  root: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  policy: ITtscProjectMembershipPolicy = PERMISSIVE_PROJECT_MEMBERSHIP_POLICY,
): {
  complete: boolean;
  directories: TtscProjectDirectorySnapshot[];
  failures: TtscProjectWalkFailure[];
  files: string[];
} {
  const platform = filesystem.platform ?? process.platform;
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  let complete = true;
  const failures: TtscProjectWalkFailure[] = [];
  const files: string[] = [];
  // Collected in one pass, then digested in a second. A directory's digest has
  // to know whether each child directory can hold program inputs, and the walk
  // learns that only after descending, so the two cannot be one pass.
  const visited: {
    childDirectories: Set<string>;
    entries: { name: string; kind: string; possible: boolean }[];
    ownInput: boolean;
    path: string;
    stable: string | undefined;
  }[] = [];
  const stack = [root];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    const before = projectDirectorySignature(current, filesystem);
    if (before === undefined) {
      complete = false;
      failures.push({
        kind: "directory-metadata-unavailable",
        path: current,
      });
      continue;
    }
    let entries: fs.Dirent[];
    try {
      entries = filesystem.readdir(current);
    } catch {
      complete = false;
      failures.push({ kind: "directory-read-failed", path: current });
      continue;
    }
    const after = projectDirectorySignature(current, filesystem);
    if (after === undefined || before !== after) {
      complete = false;
      failures.push({
        kind:
          after === undefined
            ? "directory-metadata-unavailable"
            : "directory-changed-during-walk",
        path: current,
      });
    }
    const visit = {
      childDirectories: new Set<string>(),
      entries: [] as { name: string; kind: string; possible: boolean }[],
      ownInput: false,
      path: current,
      // If membership moved during enumeration, force the next delivery to
      // replace this generation instead of blessing a torn directory/file
      // snapshot as stable.
      stable:
        after !== undefined && before === after
          ? undefined
          : `unstable:${before}:${after ?? "missing"}`,
    };
    for (const entry of entries) {
      const file = pathApi.join(current, entry.name);
      if (
        entry.isDirectory()
          ? !isProjectWalkDirectory(file, policy, platform)
          : isIgnoredProjectEntry(entry.name, policy) ||
            !matchesProjectRootFile(file, policy, false, platform)
      ) {
        continue;
      }
      const possible = isPossibleProgramEntry(entry, policy);
      visit.entries.push({
        kind: [
          entry.isDirectory(),
          entry.isFile(),
          entry.isSymbolicLink(),
        ].join(":"),
        name: entry.name,
        possible,
      });
      if (entry.isDirectory()) {
        visit.childDirectories.add(file);
        stack.push(file);
      } else if (entry.isFile() && possible) {
        // Only a file that could enter the program is hashed. A file that
        // could not is either irrelevant to every generation, or it is one the
        // compiler actually read, in which case the graph reports it and
        // `isProjectWalkPath` now agrees it is out of the walk, so it is
        // recorded and proven by the out-of-walk snapshot instead. Hashing an
        // emitted tree here bought nothing and cost a read per file, including
        // in `@ttsc/metro`, whose fingerprint re-keys every transformed file
        // (samchon/ttsc#1307).
        files.push(file);
        visit.ownInput = true;
      }
    }
    visited.push(visit);
  }

  // A directory matters to program membership only if its subtree can hold a
  // program input. Propagate that up from the directories that hold one, so a
  // bundler creating `out/` and filling it with JavaScript a project admitting
  // none can never compile is not a membership change at any level: not in the
  // directory itself, and not in the parent that now lists it
  // (samchon/ttsc#1307).
  const byPath = new Map(visited.map((visit) => [visit.path, visit]));
  const relevant = new Set<string>();
  for (const visit of visited) {
    if (!visit.ownInput) {
      continue;
    }
    let current: string | undefined = visit.path;
    while (current !== undefined && !relevant.has(current)) {
      relevant.add(current);
      const parent = pathApi.dirname(current);
      current = parent === current || !byPath.has(parent) ? undefined : parent;
    }
  }

  const directories: TtscProjectDirectorySnapshot[] = visited.map((visit) => {
    const membership = visit.entries
      .filter(
        (entry) =>
          entry.possible &&
          (!visit.childDirectories.has(
            pathApi.join(visit.path, entry.name),
          ) ||
            relevant.has(pathApi.join(visit.path, entry.name))),
      )
      .map((entry) => `${entry.name}:${entry.kind}`);
    return {
      path: visit.path,
      relevant: relevant.has(visit.path),
      signature:
        visit.stable ??
        hashText(membership.sort().join(String.fromCharCode(0))),
    };
  });
  directories.sort((left, right) => left.path.localeCompare(right.path));
  files.sort();
  return { complete, directories, failures, files };
}

/**
 * Return a directory's metadata stamp, used to detect that its membership moved
 * _while_ the walk was enumerating it.
 *
 * This is the right instrument for that job and the wrong one for comparing two
 * generations: it moves for ignored entries too. {@link walkProjectInputs}
 * records the filtered membership digest for the comparison instead.
 */
function projectDirectorySignature(
  directory: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | undefined {
  try {
    const stats = filesystem.statBigInt(directory);
    if (!stats.isDirectory()) {
      return undefined;
    }
    return [
      stats.dev,
      stats.ino,
      stats.mode,
      stats.size,
      stats.mtimeNs,
      stats.ctimeNs,
    ].join(":");
  } catch {
    return undefined;
  }
}
