import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Select an existing system temporary directory outside the current project. An
 * ambient TEMP can be a missing or redirected project path. Resolve both sides
 * before allocation and fall back to an existing platform temp directory. A Git
 * worktree or workspace declaration expands a nested project's boundary. The
 * temp path's ancestry also exposes projects outside the invocation directory.
 *
 * @evidence contracts/common.md#principled-implementation Both sides are physically resolved. Explicit project/worktree boundaries and project markers along the temp ancestry block placement, even for callers that run from another project.
 * @evidence contracts/common.md#clear-and-simple-design Directory selection is read-only. Each caller owns any required mkdir, payload and cleanup below the returned physical path.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The function never creates a missing TEMP or selects a project directory as a fallback.
 * @evidence contracts/common.md#meaningful-documentation The prose states why ambient TEMP is insufficient and what expands the project boundary.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath resolves links and junctions; native relative paths distinguish descendants from separate volumes and sibling names.
 * @evidence contracts/performance.md#efficient-algorithms Bounded candidate and project ancestry walks use file-existence queries only, without enumerating directories or reading manifests.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A changed mount or TEMP setting requires a fresh observation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No filesystem state is created and no resource is retained.
 */
export function systemTempOutsideProject(projectRoot: string): string {
  const roots = new Set<string>();
  for (const input of [projectRoot, process.cwd()]) {
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
  const fallback =
    process.platform === "win32"
      ? path.join(os.homedir(), "AppData", "Local", "Temp")
      : "/tmp";
  for (const candidate of new Set([os.tmpdir(), fallback])) {
    if (!path.isAbsolute(candidate)) continue;
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
      if (parent === directory) return physical;
      directory = parent;
    }
  }
  throw new Error(
    `ttsc: no existing system temporary directory outside ${projectRoot}`,
  );
}

const PROJECT_MARKERS = [
  ".git",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "package.json",
  "go.mod",
];
