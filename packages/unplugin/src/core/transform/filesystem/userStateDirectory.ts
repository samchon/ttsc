import fs from "node:fs";
import path from "node:path";
import { systemTempOutsideProject } from "ttsc/internal/system-temp";

/**
 * A directory below this user's own root under the system temporary directory,
 * created when absent, spelled in its long form, or `undefined` when the root
 * or any requested directory is not a real directory. On uid-capable hosts,
 * each must also belong to this user with no group or other permission bits;
 * other hosts rely on the native access policy of their temporary directory.
 *
 * The adapter keeps there what outlives a process and belongs to no project:
 * the pooled hosts' shared compile store (`openTtscTransformSession`) and the
 * project records of a host whose own tool directory cannot be written
 * (`fallbackToolDirectory`). It also keeps one probe directory per process for
 * the clock references of proofs that hold no generation
 * (`refreshProcessClockReference`), named by the process id so the next session
 * removes one a crashed process left. What the store holds becomes build
 * output, and a record tells a host whether its cache still holds, so only this
 * user may write either: the root is checked where the temporary directory is
 * shared, as `/tmp` is, and so is every directory below it. A platform without
 * user ids checks directory kind but leaves access control to its native
 * temporary-directory policy. The long spelling (`fs.realpathSync.native`)
 * keeps a Windows host watching a record from meeting the short name the
 * temporary directory routinely has (`C:\Users\RUNNER~1\...`), on which libuv's
 * backend aborts.
 *
 * @param segment A trusted child name below the root, created and checked.
 * @param projectRoot The host project that must remain outside temporary state.
 * @param create Whether the caller needs to acquire the path now.
 * @evidence contracts/common.md#principled-implementation Internal callers use the shared-store literal or process clock name below the native temporary root; lstat rejects linked entries and POSIX uid/mode checks require user-owned private directories.
 * @evidence contracts/common.md#clear-and-simple-design One provider creates and checks the state root and requested owned directories, leaving store contents, pruning, and probe lifetime to consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native temporary-root discovery and realpath replace guessed user-directory paths; failures decline optional storage rather than fabricating a usable store.
 * @evidence contracts/common.md#meaningful-documentation The prose explains retained output ownership, per-process probes, uid-capable checks, and the long Windows spelling required by native watchers.
 * @evidence contracts/portability.md#os-neutral-implementation Shared system-temp selection validates native paths and may select the platform fallback. The store uses native joins and available uid capability; other hosts rely on the temporary directory's native access policy.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This provider leaves no open handles; process probes own exit cleanup, while the persistent store's owner best-effort prunes publication counts, bytes and abandoned-process files.
 * @evidence contracts/performance.md#efficient-algorithms Creation visits only the root and requested segments, with one ownership stat per directory rather than scanning the temporary tree.
 * @evidence contracts/performance.md#reuse-equivalent-work Existing directories are reused by shared compile stores and process probes; consumers independently prove retained content instead of recompiling solely because a process restarted.
 */
export function userStateDirectory(
  segment?: string,
  projectRoot: string = process.cwd(),
  create: boolean = true,
): string | undefined {
  try {
    const user = process.getuid?.();
    let directory = userStateDirectory.location(projectRoot);
    if (!ownedDirectory(directory, user, create)) return undefined;
    if (segment !== undefined) {
      directory = path.join(directory, segment);
      if (!ownedDirectory(directory, user, create)) return undefined;
    }
    return directory;
  } catch {
    return undefined;
  }
}

/**
 * Name the user's state directory so a cache owner can inventory records even
 * when the directory has lost its storage qualification.
 *
 * @evidence contracts/common.md#principled-implementation The shared native temporary selector and current uid determine the same name used for storage acquisition.
 * @evidence contracts/common.md#clear-and-simple-design Naming and directory qualification are separate operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Returning the name neither creates the directory nor certifies its suitability.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why opaque caches require the name independently of access.
 * @evidence contracts/portability.md#os-neutral-implementation The native temporary selector supplies long physical spelling outside the project.
 * @evidence contracts/performance.md#efficient-algorithms The delegated temporary selector performs bounded candidate and ancestor metadata checks followed by a path join.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The caller owns any naming memo.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No handle or state is retained.
 */
export namespace userStateDirectory {
  /** Return the native spelling before checking the directory itself. */
  export function location(projectRoot: string): string {
    const user = process.getuid?.();
    return path.join(
      systemTempOutsideProject(projectRoot),
      `ttsc-unplugin-sessions${user === undefined ? "" : `-${user}`}`,
    );
  }
}

/**
 * Create `directory` when absent and check its nonlinked directory kind. When a
 * uid is available, also require that owner and private mode bits; otherwise
 * access control remains with the native temporary-directory policy.
 */
function ownedDirectory(
  directory: string,
  user: number | undefined,
  create: boolean,
): boolean {
  if (create) fs.mkdirSync(directory, { mode: 0o700, recursive: true });
  const stat = fs.lstatSync(directory, { throwIfNoEntry: false });
  if (stat === undefined) return !create;
  return (
    stat.isDirectory() &&
    (user === undefined || (stat.uid === user && (stat.mode & 0o077) === 0))
  );
}
