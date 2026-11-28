import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { OwnedSynchronousProcess } from "./OwnedSynchronousProcess";

/**
 * Select an existing system temporary directory outside the current project. An
 * ambient TEMP can be a missing or redirected project path. Resolve both sides
 * before allocation and fall back to an existing platform temp directory. On
 * Windows the account profile still supplies a candidate when USERPROFILE was
 * redirected. A Git worktree or workspace declaration expands a nested
 * project's boundary. The temp path's ancestry also exposes projects outside
 * the invocation directory. An operation that reads several projects can supply
 * their roots together.
 *
 * @evidence contracts/common.md#principled-implementation Both sides are physically resolved. Explicit project/worktree boundaries and project markers along the temp ancestry block placement for every candidate, including the Windows account temp supplied independently of USERPROFILE.
 * @evidence contracts/common.md#clear-and-simple-design Directory selection is read-only. Each caller owns any required mkdir, payload and cleanup below the returned physical path.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The function never creates a missing TEMP or selects a project directory as a fallback.
 * @evidence contracts/common.md#meaningful-documentation The prose states why ambient TEMP is insufficient and what expands the project boundary.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath resolves links and junctions; native relative paths distinguish descendants from separate volumes and sibling names.
 * @evidence contracts/performance.md#efficient-algorithms Bounded candidate and project ancestry walks use filesystem lookups without enumerating directories or reading manifests. Windows account lookup runs only after the ambient candidates are refused.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A changed mount or TEMP setting requires a fresh observation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No filesystem state is created and no resource is retained.
 */
export function systemTempOutsideProject(
  projectRoot: string,
  additionalProjectRoots: readonly string[] = [],
): string {
  for (const candidate of systemTempOutsideProject.candidates(projectRoot, [
    ...additionalProjectRoots,
    process.cwd(),
  ]))
    return candidate.directory;
  throw new Error(
    `ttsc: no existing system temporary directory outside ${projectRoot}`,
  );
}

/**
 * Find verified system temp parents in preference order. Each caller owns
 * allocation and can advance past a parent that refuses its write. The current
 * synchronous task's project roots join those passed by the caller.
 *
 * @evidence contracts/common.md#principled-implementation Each candidate is an existing native directory outside the given project boundaries and any project found in the candidate's ancestry.
 * @evidence contracts/common.md#clear-and-simple-design Both first-choice selection and callers that retry allocation share the same read-only policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Rejected or missing parents are skipped without creating them or assuming their aliases are safe.
 * @evidence contracts/common.md#meaningful-documentation The comment states the preference order and who owns allocation.
 * @evidence contracts/portability.md#os-neutral-implementation Native platform candidates, realpath, and path-relative checks establish the physical parent. The requested spelling is available for lexical boundaries.
 * @evidence contracts/performance.md#efficient-algorithms A bounded candidate list and ancestor walks use metadata lookups. Later candidates are observed only on demand.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each iteration qualifies the current layout independently.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Traversal-local path sets are released when iteration ends. No handles or directories are acquired.
 */
export namespace systemTempOutsideProject {
  /** Yield each verified parent and the spelling supplied by its source. */
  export function* candidates(
    projectRoot: string,
    additionalProjectRoots: readonly string[] = [],
  ): Generator<{ spelling: string; directory: string }> {
    const roots = new Set<string>();
    for (const input of new Set([
      projectRoot,
      ...additionalProjectRoots,
      ...OwnedSynchronousProcess.additionalProjectRoots(),
    ])) {
      let directory = fs.realpathSync.native(input);
      if (path.dirname(directory) !== directory) roots.add(directory);
      for (;;) {
        if (
          fs.existsSync(path.join(directory, ".git")) ||
          fs.existsSync(path.join(directory, "pnpm-workspace.yaml"))
        )
          roots.add(directory);
        const parent = path.dirname(directory);
        if (parent === directory) break;
        directory = parent;
      }
    }
    const seen = new Set<string>();
    for (const candidate of temporaryCandidates()) {
      if (!path.isAbsolute(candidate) || seen.has(candidate)) continue;
      seen.add(candidate);
      let physical: string;
      try {
        physical = fs.realpathSync.native(candidate);
        if (!fs.lstatSync(physical).isDirectory()) continue;
      } catch {
        continue;
      }
      const inside = [...roots].some((root) => {
        const relative = path.relative(root, physical);
        return (
          relative === "" ||
          (!path.isAbsolute(relative) &&
            relative !== ".." &&
            !relative.startsWith(`..${path.sep}`))
        );
      });
      if (inside) continue;
      let directory = physical;
      for (;;) {
        if (
          PROJECT_MARKERS.some((marker) =>
            fs.existsSync(path.join(directory, marker)),
          )
        )
          break;
        const parent = path.dirname(directory);
        if (parent === directory) {
          yield { spelling: candidate, directory: physical };
          break;
        }
        directory = parent;
      }
    }
  }
}

function* temporaryCandidates(): Generator<string> {
  yield os.tmpdir();
  if (process.platform !== "win32") {
    yield "/tmp";
    return;
  }
  yield path.join(os.homedir(), "AppData", "Local", "Temp");
  try {
    yield path.join(os.userInfo().homedir, "AppData", "Local", "Temp");
  } catch {
    // Windows may have no accessible account profile for this process.
  }
}

const PROJECT_MARKERS = [
  ".git",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "package.json",
  "go.mod",
];
