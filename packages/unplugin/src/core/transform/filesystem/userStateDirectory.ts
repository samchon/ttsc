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
 * cannot be written (`fallbackToolDirectory`, samchon/ttsc#1480). What the
 * store holds becomes build output, and a record tells a host whether its cache
 * still holds, so only this user may write either: the root is checked where
 * the temporary directory is shared, as `/tmp` is, and so is every directory
 * below it. A platform without user ids checks nothing further, as its
 * temporary directory is the user's own. The long spelling
 * (`fs.realpathSync.native`) keeps a Windows host watching a record from
 * meeting the short name the temporary directory routinely has
 * (`C:\Users\RUNNER~1\...`), on which libuv's backend aborts.
 *
 * @param segments The directories below the root, each created and checked.
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
