import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * A directory below this user's own root under the system temporary directory,
 * created when absent, spelled in its long form, or `undefined` when the root
 * or any directory below it is not a real directory this user owns and no one
 * else can write to.
 *
 * The adapter keeps there what outlives a process and belongs to no project:
 * the pooled hosts' shared compile store (`openTtscTransformSession`,
 * samchon/ttsc#1483) and the project records of a host whose own tool directory
 * cannot be written (`fallbackToolDirectory`, samchon/ttsc#1480). It also keeps
 * one probe directory per process for the clock references of proofs that hold
 * no generation (`refreshProcessClockReference`), named by the process id so
 * the next session removes one a crashed process left. What the store holds
 * becomes build output, and a record tells a host whether its cache still
 * holds, so only this user may write either: the root is checked where the
 * temporary directory is shared, as `/tmp` is, and so is every directory below
 * it. A platform without user ids checks nothing further, as its temporary
 * directory is the user's own. The long spelling (`fs.realpathSync.native`)
 * keeps a Windows host watching a record from meeting the short name the
 * temporary directory routinely has (`C:\Users\RUNNER~1\...`), on which libuv's
 * backend aborts.
 *
 * @param segments The directories below the root, each created and checked.
 *
 * @evidence contracts/common.md#principled-implementation Internal callers use the shared-store literal or process clock name below the native temporary root; lstat rejects linked entries and POSIX uid/mode checks require user-owned private directories.
 * @evidence contracts/common.md#clear-and-simple-design One provider creates and checks the state root and requested owned directories, leaving store contents, pruning, and probe lifetime to consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native temporary-root discovery and realpath replace guessed user-directory paths; failures decline optional storage rather than fabricating a usable store.
 * @evidence contracts/common.md#meaningful-documentation The prose explains retained output ownership, per-process probes, uid-capable checks, and the long Windows spelling required by native watchers.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral directory selection uses os.tmpdir, native realpath, native joins, and available uid capability; hosts without uid checks rely on their user temporary directory's native access policy.
 * @evidence contracts/performance.md#efficient-algorithms Creation visits only the root and requested segments, with one ownership stat per directory rather than scanning the temporary tree.
 * @evidence contracts/performance.md#reuse-equivalent-work Existing directories are reused by shared compile stores and process probes; consumers independently prove retained content instead of recompiling solely because a process restarted.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This provider leaves no open handles; process probes own exit cleanup, while the persistent store's owner best-effort prunes publication counts, bytes and abandoned-process files.
 */
export function userStateDirectory(...segments: string[]): string | undefined {
  try {
    const user = process.getuid?.();
    let directory = path.join(
      fs.realpathSync.native(os.tmpdir()),
      `ttsc-unplugin-sessions${user === undefined ? "" : `-${user}`}`,
    );
    if (!ownedDirectory(directory, user)) return undefined;
    for (const segment of segments) {
      directory = path.join(directory, segment);
      if (!ownedDirectory(directory, user)) return undefined;
    }
    return directory;
  } catch {
    return undefined;
  }
}

/**
 * Create `directory` when absent, and whether it is a real directory only
 * `user` can write to.
 */
function ownedDirectory(directory: string, user: number | undefined): boolean {
  fs.mkdirSync(directory, { mode: 0o700, recursive: true });
  const stat = fs.lstatSync(directory);
  return (
    stat.isDirectory() &&
    (user === undefined || (stat.uid === user && (stat.mode & 0o077) === 0))
  );
}
