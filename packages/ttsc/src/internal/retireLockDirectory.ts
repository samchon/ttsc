import crypto from "node:crypto";
import fs from "node:fs";

/**
 * Free a held lock generation by renaming its directory onto its tombstone, the
 * one operation both build-lock protocols retire a generation with.
 *
 * Windows refuses to rename a directory while any file below it is open, and
 * reports the refusal as `EPERM` or `EACCES` (or `EBUSY`). Every waiter of a
 * lock reads the holder's record inside the held generation, so a release that
 * overlaps one of those reads is refused for as long as the read lasts
 * (samchon/ttsc#1510). That refusal is transient; a lasting one, which the
 * filesystem's permissions would cause, is not. The two are told apart by
 * evidence rather than a time window: an empty directory, which no peer can
 * hold open, is renamed between the same two parents. When that probe renames,
 * the parents permit the retire and a peer's open file is what refused it, so
 * the retire waits one `yieldToPeers` and tries again. When the probe is
 * refused too, the refusal is the filesystem's and is thrown.
 *
 * @param source The held generation's directory.
 * @param destination Its tombstone, which a successor's retire can never reuse.
 * @param yieldToPeers Waits once, by the protocol's own polling interval.
 * @returns `true` when the generation was retired; `false` when `source` is
 *   gone or `destination` is occupied, meaning another retire already made
 *   progress.
 * @throws When the rename fails for any other reason.
 */
export function retireLockDirectory(
  source: string,
  destination: string,
  yieldToPeers: () => void,
): boolean {
  for (;;) {
    try {
      fs.renameSync(source, destination);
      return true;
    } catch (error) {
      if (isMissingPath(error) || isOccupied(error, destination)) return false;
      if (!isHeldByPeer(error, source, destination)) throw error;
    }
    yieldToPeers();
  }
}

function isMissingPath(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/**
 * Whether a failed rename means the destination already exists. Windows reports
 * an occupied directory destination as `EACCES` or `EPERM`, so those count only
 * when the destination is actually present.
 */
function isOccupied(error: unknown, destination: string): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EEXIST" || code === "ENOTEMPTY") return true;
  return (code === "EACCES" || code === "EPERM") && fs.existsSync(destination);
}

/**
 * Whether a refused rename was refused by a peer's open file below `source`
 * rather than by the filesystem's permissions.
 */
function isHeldByPeer(
  error: unknown,
  source: string,
  destination: string,
): boolean {
  if (process.platform !== "win32") return false;
  const code = (error as NodeJS.ErrnoException).code;
  if (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") return false;
  if (!fs.existsSync(source)) return false;
  const nonce = crypto.randomBytes(8).toString("hex");
  const probe = `${source}.probe-${nonce}`;
  const moved = `${destination}.probe-${nonce}`;
  try {
    fs.mkdirSync(probe);
  } catch {
    return false;
  }
  try {
    fs.renameSync(probe, moved);
  } catch {
    fs.rmSync(probe, { force: true, recursive: true });
    return false;
  }
  fs.rmSync(moved, { force: true, recursive: true });
  return true;
}
