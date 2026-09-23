import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { TtscSharedCompileClaim } from "./TtscSharedCompileClaim";
import type { TtscSharedCompilePublication } from "./TtscSharedCompilePublication";

/** How often a lock holder proves it is still working. */
const HEARTBEAT_MS = 1_000;

/**
 * How long a lock may go without a heartbeat before a waiter takes it over. A
 * holder whose process died is detected at once through its pid. This bound
 * covers a pid that was reused, and a holder that cannot run at all.
 */
const ABANDONED_MS = 15_000;

/** Longest pause between two looks at the store while another worker holds it. */
const MAX_WAIT_MS = 250;

/** Publications kept per compile identity, most recently used first. */
const KEPT_PUBLICATIONS = 4;

/**
 * Publications kept in the whole store, most recently used first. The store
 * outlives every process (samchon/ttsc#1483), so without a bound it would keep
 * every identity a project ever had, those of an older ttsc among them, which
 * can never be adopted again.
 */
const KEPT_STORE_PUBLICATIONS = 32;

/**
 * Ask the session store for the compile named `identity` and `state`: another
 * worker's publication, or the lock to compile it here (samchon/ttsc#1390).
 *
 * `identity` names what the compile is (project, options, plugins) and `state`
 * the project state it would read. The first worker to need a pair takes its
 * lock by creating a directory, which the filesystem makes atomic. The others
 * wait without blocking the event loop, and adopt the publication the holder
 * leaves behind. When the holder releases the lock without publishing, the next
 * waiter takes the lock instead. A holder whose process has died, or whose
 * heartbeat stopped, loses the lock to the next waiter, so a crash mid-compile
 * never blocks the session.
 *
 * The store outlives the processes that use it (samchon/ttsc#1483), so it
 * bounds itself: an adoption marks its publication used, and each publication
 * keeps the most recently used ones of its identity and of the whole store, and
 * removes locks and partial writes whose writer is gone.
 *
 * Sharing is only an optimization. Any failure to read, lock, or write the
 * store answers `undefined`, and the caller compiles for itself. With `adopt:
 * false` the caller has already found a publication wanting and compiles
 * regardless, but still under the lock, so its compile replaces the publication
 * for the waiters.
 *
 * Its place in the adapter's invalidation model, and the units beside it, are
 * mapped in the maintainer page
 * `website/src/content/docs/development/reference/unplugin-invalidation.mdx`.
 *
 * @param store The session's shared compile store.
 * @param identity Hex digest of what the compile is.
 * @param state Hex digest of the project state it reads.
 * @param options.adopt Whether an existing publication may be adopted.
 */
export async function claimSharedCompile(
  store: string,
  identity: string,
  state: string,
  options: { adopt: boolean },
): Promise<TtscSharedCompileClaim | undefined> {
  const name = `${identity}-${state}`;
  const publication = path.join(store, `${name}.json`);
  const lock = path.join(store, `${name}.lock`);
  let wait = 20;
  try {
    for (;;) {
      if (options.adopt) {
        const published = await readPublication(publication);
        if (published !== undefined) {
          await markUsed(publication);
          return { kind: "adopt", publication: published };
        }
      }
      const token = await acquire(lock);
      if (token !== undefined) {
        const claim = holdLock(store, identity, publication, lock, token);
        if (options.adopt) {
          // A holder may have published and released between the read above
          // and the lock.
          const published = await readPublication(publication);
          if (published !== undefined) {
            claim.release();
            await markUsed(publication);
            return { kind: "adopt", publication: published };
          }
        }
        return claim;
      }
      if (await abandoned(lock)) {
        fs.rmSync(lock, { force: true, recursive: true });
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, wait));
      wait = Math.min(wait * 2, MAX_WAIT_MS);
    }
  } catch {
    return undefined;
  }
}

/**
 * Take the lock and return this claim's owner token, or `undefined` when
 * another worker holds it. The token lets a release tell its own lock from one
 * a waiter took over after this holder's heartbeat went stale.
 */
async function acquire(lock: string): Promise<string | undefined> {
  try {
    await fs.promises.mkdir(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return undefined;
    throw error;
  }
  const token = `${process.pid}:${crypto.randomUUID()}`;
  try {
    await fs.promises.writeFile(path.join(lock, "owner"), token);
  } catch (error) {
    fs.rmSync(lock, { force: true, recursive: true });
    throw error;
  }
  return token;
}

/** Whether the holder of `lock` is gone or has stopped working. */
async function abandoned(lock: string): Promise<boolean> {
  let modified: number;
  try {
    modified = (await fs.promises.stat(lock)).mtimeMs;
  } catch {
    // Released meanwhile: not abandoned, and the next loop takes it.
    return false;
  }
  if (Date.now() - modified > ABANDONED_MS) return true;
  let owner: number;
  try {
    owner = Number.parseInt(
      await fs.promises.readFile(path.join(lock, "owner"), "utf8"),
      10,
    );
  } catch {
    // The holder is between creating the lock and naming itself.
    return false;
  }
  if (!Number.isInteger(owner) || owner <= 0) return false;
  try {
    process.kill(owner, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH";
  }
}

/** The claim of a worker that holds the lock. */
function holdLock(
  store: string,
  identity: string,
  publication: string,
  lock: string,
  token: string,
): Extract<TtscSharedCompileClaim, { kind: "compile" }> {
  const heartbeat = setInterval(() => {
    const now = new Date();
    fs.promises.utimes(lock, now, now).catch(() => undefined);
  }, HEARTBEAT_MS);
  heartbeat.unref();
  let released = false;
  return {
    kind: "compile",
    publish: async (value) => {
      const temporary = `${publication}.${process.pid}.${crypto.randomUUID()}.tmp`;
      try {
        await fs.promises.writeFile(temporary, JSON.stringify(value), "utf8");
        try {
          await fs.promises.rename(temporary, publication);
        } catch {
          // Windows refuses to replace a file another worker has open.
          await fs.promises.rm(publication, { force: true });
          await fs.promises.rename(temporary, publication);
        }
        await prunePublications(store, identity);
      } catch {
        await fs.promises.rm(temporary, { force: true }).catch(() => undefined);
      }
    },
    release: () => {
      if (released) return;
      released = true;
      clearInterval(heartbeat);
      try {
        if (fs.readFileSync(path.join(lock, "owner"), "utf8") === token) {
          fs.rmSync(lock, { force: true, recursive: true });
        }
      } catch {
        // Gone already, or taken over by a waiter that owns it now.
      }
    },
  };
}

/**
 * Keep the most recently used publications of `identity` and of the whole
 * store, removing the rest, and remove the locks and partial writes of workers
 * that are gone.
 */
async function prunePublications(
  store: string,
  identity: string,
): Promise<void> {
  const entries = await fs.promises.readdir(store);
  const dated = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".json"))
      .map(async (entry) => {
        const file = path.join(store, entry);
        try {
          return { entry, file, used: (await fs.promises.stat(file)).mtimeMs };
        } catch {
          return { entry, file, used: -1 };
        }
      }),
  );
  dated.sort((left, right) => right.used - left.used);
  const own = dated.filter(({ entry }) => entry.startsWith(`${identity}-`));
  const removed = new Set([
    ...own.slice(KEPT_PUBLICATIONS).map(({ file }) => file),
    ...dated.slice(KEPT_STORE_PUBLICATIONS).map(({ file }) => file),
  ]);
  for (const file of removed) {
    await fs.promises.rm(file, { force: true }).catch(() => undefined);
  }
  for (const entry of entries) {
    const file = path.join(store, entry);
    if (entry.endsWith(".lock") && (await abandoned(file))) {
      await fs.promises
        .rm(file, { force: true, recursive: true })
        .catch(() => undefined);
    } else if (entry.endsWith(".tmp")) {
      // A partial write outlives only a writer that died before renaming it.
      try {
        const written = (await fs.promises.stat(file)).mtimeMs;
        if (Date.now() - written > ABANDONED_MS) {
          await fs.promises.rm(file, { force: true });
        }
      } catch {
        // Renamed or removed meanwhile.
      }
    }
  }
}

/**
 * Mark a publication used, so the store keeps the ones its processes still
 * adopt. Best effort: an unmarked publication is only pruned sooner.
 */
async function markUsed(file: string): Promise<void> {
  const now = new Date();
  await fs.promises.utimes(file, now, now).catch(() => undefined);
}

/** Read a publication, or `undefined` when it is absent or unusable. */
async function readPublication(
  file: string,
): Promise<TtscSharedCompilePublication | undefined> {
  let text: string;
  try {
    text = await fs.promises.readFile(file, "utf8");
  } catch {
    return undefined;
  }
  try {
    const value = JSON.parse(text) as Partial<TtscSharedCompilePublication>;
    const type = (value.result as { type?: unknown } | undefined)?.type;
    // A compile that ended in diagnostics is published like one that
    // succeeded (samchon/ttsc#1458); an exception never is.
    if (
      (type !== "success" && type !== "failure") ||
      typeof value.externalInputHashes !== "object" ||
      value.externalInputHashes === null ||
      typeof value.externalInputRealpaths !== "object" ||
      value.externalInputRealpaths === null ||
      typeof value.scratchDirectory !== "string" ||
      (value.temporaryTsconfig !== undefined &&
        typeof value.temporaryTsconfig !== "string")
    ) {
      return undefined;
    }
    return value as TtscSharedCompilePublication;
  } catch {
    return undefined;
  }
}
