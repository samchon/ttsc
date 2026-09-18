import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TTSC_TRANSFORM_SESSION_ENV } from "./TTSC_TRANSFORM_SESSION_ENV";
import { readTtscTransformSession } from "./readTtscTransformSession";

/** Stores this process opened, removed when it exits. */
const OPENED_SESSIONS = new Set<string>();

/**
 * Open the shared compile store for the pooled host session this process
 * configures, and return its path (samchon/ttsc#1390).
 *
 * Turbopack and Metro run transforms in a pool of worker processes, and each
 * compiled the whole project before answering its first module. The process
 * that configures the pool calls this before the workers exist. The store is a
 * fresh directory under the system temporary directory, outside every project,
 * and its path goes into {@link TTSC_TRANSFORM_SESSION_ENV}, which the workers
 * inherit. The first worker to need a generation compiles it and publishes it
 * there, and the others prove it and adopt it.
 *
 * What a store holds becomes build output, so only this user may write there:
 * stores live under a per-user root that must be a real directory this user
 * owns and no one else can write to, which matters where the temporary
 * directory is shared, as `/tmp` is. The store belongs to this process and is
 * removed when it exits. Stores whose owning process died without removing them
 * are removed the next time a session opens. A process whose environment
 * already names a live store, because a parent or an earlier call opened the
 * session, keeps that store.
 *
 * Sharing is an optimization, so any failure leaves the session closed and the
 * workers compiling for themselves, never an error.
 *
 * @returns The store's absolute path, or `undefined` when none could be opened.
 */
export function openTtscTransformSession(): string | undefined {
  const inherited = readTtscTransformSession();
  if (inherited !== undefined) {
    return inherited;
  }
  try {
    const user = process.getuid?.();
    const root = path.join(
      os.tmpdir(),
      `ttsc-unplugin-sessions${user === undefined ? "" : `-${user}`}`,
    );
    fs.mkdirSync(root, { mode: 0o700, recursive: true });
    const stat = fs.lstatSync(root);
    if (
      !stat.isDirectory() ||
      (user !== undefined && (stat.uid !== user || (stat.mode & 0o077) !== 0))
    ) {
      return undefined;
    }
    for (const entry of fs.readdirSync(root)) {
      const owner = Number.parseInt(entry.split("-")[0] ?? "", 10);
      if (Number.isInteger(owner) && owner > 0 && !processAlive(owner)) {
        fs.rmSync(path.join(root, entry), { force: true, recursive: true });
      }
    }
    const directory = fs.mkdtempSync(path.join(root, `${process.pid}-`));
    if (OPENED_SESSIONS.size === 0) {
      process.once("exit", () => {
        for (const opened of OPENED_SESSIONS) {
          try {
            fs.rmSync(opened, { force: true, recursive: true });
          } catch {
            // A store left behind is removed by the next session that opens.
          }
        }
      });
    }
    OPENED_SESSIONS.add(directory);
    process.env[TTSC_TRANSFORM_SESSION_ENV] = directory;
    return directory;
  } catch {
    return undefined;
  }
}

/** Whether a process with this id exists, as far as this process can tell. */
function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: it exists and belongs to another user.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
