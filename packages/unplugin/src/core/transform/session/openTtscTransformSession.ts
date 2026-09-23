import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TTSC_TRANSFORM_SESSION_ENV } from "./TTSC_TRANSFORM_SESSION_ENV";
import { readTtscTransformSession } from "./readTtscTransformSession";

/**
 * Open the shared compile store for the pooled host session this process
 * configures, and return its path (samchon/ttsc#1390).
 *
 * Turbopack and Metro run transforms in a pool of worker processes, and each
 * compiled the whole project before answering its first module. The process
 * that configures the pool calls this before the workers exist, and puts the
 * store's path into {@link TTSC_TRANSFORM_SESSION_ENV}, which the workers
 * inherit. The first worker to need a generation compiles it and publishes it
 * there, and the others prove it and adopt it.
 *
 * The store outlives the process (samchon/ttsc#1483). A dev server started
 * again spawns fresh workers with no generation in memory, and Turbopack runs
 * the loader for every module after a restart, so a store that died with its
 * process left each restart compiling every project once. The store is one
 * directory per user, kept across processes: a fresh worker adopts what the
 * last process compiled after proving it against its own disk, as any adopter
 * does, and a compile is named by what it is down to the compiler versions
 * (`sharedCompileIdentity`), so a publication of another ttsc is never adopted.
 * The store bounds itself (`claimSharedCompile`).
 *
 * What a store holds becomes build output, so only this user may write there:
 * the store lives under a per-user root, outside every project, that must be a
 * real directory this user owns and no one else can write to, which matters
 * where the temporary directory is shared, as `/tmp` is, and the store must be
 * one as well. Earlier versions kept one store per process, removed when it
 * exited; one whose process is gone was left behind by a crash, and is removed
 * here. A process whose environment already names a live store, because a
 * parent or an earlier call opened the session, keeps that store.
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
    if (!ownedDirectory(root, user)) return undefined;
    for (const entry of fs.readdirSync(root)) {
      const owner = Number.parseInt(entry.split("-")[0] ?? "", 10);
      if (Number.isInteger(owner) && owner > 0 && !processAlive(owner)) {
        fs.rmSync(path.join(root, entry), { force: true, recursive: true });
      }
    }
    const store = path.join(root, SHARED_STORE);
    if (!ownedDirectory(store, user)) return undefined;
    process.env[TTSC_TRANSFORM_SESSION_ENV] = store;
    return store;
  } catch {
    return undefined;
  }
}

/** The store's name below the per-user root, which names no process. */
const SHARED_STORE = "shared";

/**
 * Create `directory` when absent, and whether it is a real directory only
 * `user` can write to. A platform without user ids checks nothing further.
 */
function ownedDirectory(directory: string, user: number | undefined): boolean {
  fs.mkdirSync(directory, { mode: 0o700, recursive: true });
  const stat = fs.lstatSync(directory);
  return (
    stat.isDirectory() &&
    (user === undefined || (stat.uid === user && (stat.mode & 0o077) === 0))
  );
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
