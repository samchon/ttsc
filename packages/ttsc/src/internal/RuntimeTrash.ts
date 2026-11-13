import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Retire a directory of the ttsx runtime at the cost of one rename, and delete
 * retired directories while a later launcher waits for its program.
 *
 * A run that compiled leaves thousands of emitted files, and removing them
 * before the launcher exited held the user's terminal for nine to twenty-six
 * seconds after the program's last line (samchon/ttsc#1859). The directory is
 * instead renamed into the `.trash` of its own parent, the run index or the
 * runtime build store, so the rename never leaves its volume and never copies.
 * The files are deleted by a launcher whose own program is running, a time it
 * otherwise spends waiting, and the deletion stops when that program ends, so
 * it never delays an exit either.
 *
 * @evidence contracts/common.md#principled-implementation A same-directory rename is an atomic metadata change on every supported filesystem, so a retired tree leaves the run index at once; deletion is ordinary unlinking of a tree no run owns any more.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns the trash location, retirement and draining; callers keep their ownership decisions and call retire where they used to remove.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A rename that fails returns false, and the caller keeps its previous removal; nothing is left unowned and undeletable.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the measured cost this replaces, where the trash lives, who deletes it and when deletion stops.
 * @evidence contracts/portability.md#os-neutral-implementation Node rename, readdir, unlink and rmdir carry native semantics; links inside a retired tree are unlinked as links, never followed.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups operations; each states its own cost.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Retirement and deletion are effects, not reusable results.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace retains nothing; each operation states its lifetime.
 */
export namespace RuntimeTrash {
  /**
   * Name of the trash directory inside a run index. Run directories are named
   * by run keys, which never start with a dot, and the trash holds no owner
   * record, so run sweeping never selects it.
   */
  export const DIRNAME = ".trash";

  /**
   * Move `directory` into the trash of `parent`.
   *
   * @param directory A run directory, or a tree below it, that no process owns
   *   any more.
   * @param parent The physical directory holding `directory`, the run index or
   *   the runtime build store.
   * @returns Whether the directory was moved; false leaves it in place.
   * @evidence contracts/common.md#principled-implementation The trash is a child of the same parent, so the rename stays on one volume and in one directory tree.
   * @evidence contracts/common.md#clear-and-simple-design One rename and a unique name; the caller decides what may be retired.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A refused rename, such as a file a lingering process holds open on Windows, is reported to the caller instead of being retried or forced.
   * @evidence contracts/common.md#meaningful-documentation Parameters state the ownership premise and the result's meaning.
   * @evidence contracts/portability.md#os-neutral-implementation Native mkdir and rename; the unique name uses only portable characters.
   * @evidence contracts/performance.md#efficient-algorithms One directory creation and one rename, independent of the tree's size.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Retirement is an effect.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The retired tree stays in the trash until a drain or `ttsc clean` deletes it; nothing is retained in memory.
   */
  export function retire(directory: string, parent: string): boolean {
    try {
      const trash = path.join(parent, DIRNAME);
      fs.mkdirSync(trash, { recursive: true });
      fs.renameSync(
        directory,
        path.join(
          trash,
          `${Date.now()}-${process.pid}-${crypto.randomBytes(4).toString("hex")}`,
        ),
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete the trash of `parent` asynchronously until the returned function is
   * called.
   *
   * Files are unlinked a few at a time and directories removed once empty.
   * Stopping lets the operations already started finish, a handful of single
   * file removals, and starts no more, so the caller's process can end at once;
   * what is left is deleted by a later drain. Errors leave their entry for a
   * later drain.
   *
   * @param parent The directory whose trash is deleted.
   * @returns A function that stops the deletion.
   * @evidence contracts/common.md#principled-implementation Only the trash is visited, and every entry there was retired by its owner, so no live run's file is deleted.
   * @evidence contracts/common.md#clear-and-simple-design A depth-first walk with a small concurrency limit and one stop flag.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed removal is skipped, not retried in a loop, and recursive removal is not handed to one native call that could not be stopped.
   * @evidence contracts/common.md#meaningful-documentation The prose states the batching, what stopping does and how failures are left.
   * @evidence contracts/portability.md#os-neutral-implementation Directory entry kinds from the native listing do not follow links, so a link is unlinked and its target never visited.
   * @evidence contracts/performance.md#efficient-algorithms One listing per directory and one unlink per file, eight at a time on the thread pool, without a stat call or reading any content.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Deletion is an effect.
   * @evidence contracts/performance.md#bound-retention-and-release-resources At most eight removals are in flight; a directory's names are held while it is walked; stopping releases the walk after those removals settle.
   */
  export function drain(parent: string): () => void {
    let stopped = false;
    // Files of one directory are unlinked eight at a time; subdirectories are
    // walked one after another, so no more than eight removals are in flight.
    const removeDirectory = async (directory: string): Promise<void> => {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(directory, { withFileTypes: true });
      } catch {
        return;
      }
      const files = entries.filter((entry) => !entry.isDirectory());
      for (let index = 0; index < files.length && !stopped; index += 8)
        await Promise.all(
          files
            .slice(index, index + 8)
            .map((entry) =>
              fs.promises
                .unlink(path.join(directory, entry.name))
                .catch(() => undefined),
            ),
        );
      for (const entry of entries) {
        if (stopped) return;
        if (entry.isDirectory())
          await removeDirectory(path.join(directory, entry.name));
      }
      if (!stopped) await fs.promises.rmdir(directory).catch(() => undefined);
    };
    void removeDirectory(path.join(parent, DIRNAME)).catch(() => undefined);
    return () => {
      stopped = true;
    };
  }
}
