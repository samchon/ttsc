import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeFilesystem } from "../launcher/internal/runtime/RuntimeFilesystem";
import { isPathWithin } from "../plugin/internal/source/isPathWithin";
import { OwnedSynchronousProcess } from "./OwnedSynchronousProcess";

/**
 * Select an existing system temporary directory outside the current project. An
 * ambient TEMP can be a missing or redirected project path. Resolve both sides
 * before allocation and fall back to an existing platform temp directory. On
 * Windows the account profile still supplies a candidate when USERPROFILE was
 * redirected. A Git worktree or workspace declaration expands a nested
 * project's boundary. The temp path's ancestry also exposes projects outside
 * the invocation directory. An operation that reads several projects can supply
 * their roots together. A temp candidate needs a lossless string spelling.
 *
 * @evidence contracts/common.md#principled-implementation Both sides are physically resolved. Explicit project/worktree boundaries and project markers along the temp ancestry block placement for every candidate, including the Windows account temp supplied independently of USERPROFILE.
 * @evidence contracts/common.md#clear-and-simple-design Directory selection is read-only. Each caller owns any required mkdir, payload and cleanup below the returned physical path.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The function never creates a missing TEMP or selects a project directory as a fallback.
 * @evidence contracts/common.md#meaningful-documentation The prose states why ambient TEMP is insufficient and what expands the project boundary.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath expands links and junctions. Candidate paths must round-trip through strings, and a raw POSIX project root can still contribute ancestors representable by a string.
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
 * @evidence contracts/common.md#principled-implementation Each temp candidate lies outside selected and marked project ancestry. A deterministic writable child additionally excludes a selected project anywhere below that tree.
 * @evidence contracts/common.md#clear-and-simple-design Candidate and deterministic-child checks share one marker walk. Callers own native alias validation and allocation of child paths.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing and excluded candidates are skipped without writing, and a qualified parent cannot stand in for child qualification.
 * @evidence contracts/common.md#meaningful-documentation The comments describe preference order, child ownership, and the shared scope boundary.
 * @evidence contracts/portability.md#os-neutral-implementation Lossless native realpath and path-relative checks establish physical parent identity. Child checks use raw POSIX bytes when a selected project lacks a native string spelling.
 * @evidence contracts/performance.md#efficient-algorithms Bounded candidate lists and ancestor walks use metadata, without enumeration. Later candidates are observed only on demand. A child check walks its ancestors and reobserves nominated roots.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each iteration qualifies the current layout independently.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Traversal-local path sets are released when iteration ends. No handles or directories are acquired.
 */
export namespace systemTempOutsideProject {
  /** Recognize a marker in a native directory listing. */
  export function isProjectMarker(name: string): boolean {
    return PROJECT_MARKERS.includes(
      process.platform === "win32" ? name.toLowerCase() : name,
    );
  }

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
      const physical = RuntimeFilesystem.realpathWitness(input);
      const raw = RuntimeFilesystem.rawRealpath(physical);
      let directory = raw === undefined ? physical : stringAncestor(raw);
      if (raw === undefined && path.dirname(directory) !== directory)
        roots.add(directory);
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
        physical = RuntimeFilesystem.realpathWitness(candidate);
        if (physical.includes("\0") || !fs.lstatSync(physical).isDirectory())
          continue;
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
      if (!hasProjectAncestor(physical))
        yield { spelling: candidate, directory: physical };
    }
  }

  /**
   * Qualify a deterministic writable tree below a selected temp parent. A
   * project may begin inside that parent, so the parent alone is insufficient.
   * The caller checks that the child's existing components do not follow
   * links.
   */
  export function allowsChild(
    directory: string,
    projectRoots: readonly string[],
  ): boolean {
    if (hasProjectAncestor(directory)) return false;
    for (const root of new Set([
      ...projectRoots,
      ...OwnedSynchronousProcess.additionalProjectRoots(),
    ])) {
      const project = RuntimeFilesystem.realpathWitness(root);
      const bytes = RuntimeFilesystem.rawRealpath(project);
      if (bytes !== undefined) {
        const prefix = Buffer.from(directory + path.sep);
        if (bytes.subarray(0, prefix.length).equals(prefix)) return false;
      } else if (
        path.dirname(project) !== project &&
        (isPathWithin(directory, project) || isPathWithin(project, directory))
      ) {
        return false;
      }
    }
    return true;
  }
}

/** Find a project marker from the prospective directory to the volume root. */
function hasProjectAncestor(start: string): boolean {
  for (let directory = start; ; directory = path.dirname(directory)) {
    if (
      PROJECT_MARKERS.some((marker) =>
        fs.existsSync(path.join(directory, marker)),
      )
    )
      return true;
    if (path.dirname(directory) === directory) return false;
  }
}

/** Find the first POSIX ancestor a string-addressable candidate could share. */
function stringAncestor(raw: Buffer): string {
  // A representable path cannot descend through a raw component. A higher
  // workspace marker can still place it inside the same checkout.
  let bytes = raw;
  for (;;) {
    bytes = bytes.subarray(0, Math.max(1, bytes.lastIndexOf(0x2f)));
    const spelling = bytes.toString();
    if (Buffer.from(spelling).equals(bytes)) return spelling;
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
  "jsconfig.json",
  "package.json",
  "go.mod",
  "go.work",
];
