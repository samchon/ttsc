import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ViteModuleNodeLike } from "../vite/ViteModuleNodeLike";
import type { ViteServeWatchOperations } from "../vite/ViteServeWatchOperations";
import { createViteServeInputWatch } from "../vite/createViteServeInputWatch";
import type { HostWatchBridge } from "./HostWatchBridge";
import { WATCH_BRIDGE_DIRECTORY_PREFIX } from "./WATCH_BRIDGE_DIRECTORY_PREFIX";
import { sweepAbandonedWatchBridges } from "./sweepAbandonedWatchBridges";

/**
 * Open the watch bridge for one watching build session (samchon/ttsc#1388).
 *
 * Rolldown's and Farm's `addWatchFile` never report a created path or a
 * directory gaining an entry, so a missing declaration that appears, or a new
 * `@types` package, never rebuilt a watching session. Rollup reports both but
 * opens one chokidar instance per registered path, and recursively for a
 * directory, so its watcher count followed the compiler's input count. The
 * bridge observes every compiler input with the bounded observer that serves
 * the Vite dev server: one project scope plus at most 16 external ones, and a
 * precise predicate re-check per event. It then tells the host by rewriting one
 * sentinel per importer, the only path the host itself watches for it.
 *
 * The observer is reused through its structural server view: each importer is
 * its own module node, and invalidating that node rewrites the importer's
 * sentinel. Sentinels live in an owned directory the host must be able to
 * watch, named after this process so a later bridge can remove it if this
 * process dies without cleaning up.
 *
 * @param root The directory whose pinned scope observes the project.
 * @param operations Native watch seams, replaceable for tests.
 * @param sentinelParent Where the sentinel directory is created. The system
 *   temp directory by default, outside the project and any `node_modules`,
 *   which Farm's watcher requires of an extra watch file. Turbopack instead
 *   rejects a dependency outside its project filesystem root, so its loader
 *   passes a directory inside the project.
 * @param confirm Present when a signal repeats until the importer is
 *   acknowledged. Turbopack takes a dependency's state only when the loader
 *   returns, as its baseline, so a sentinel rewritten before then is part of
 *   that baseline and signals nothing (samchon/ttsc#1423). Repeating with a
 *   growing delay, until the importer is acknowledged, lands a rewrite after
 *   the baseline however late the host takes it. A host that compares
 *   timestamps, as webpack does, or that watches the sentinel from before the
 *   rewrite hears the first one, and a second would only rebuild again. Its
 *   `runs` is a directory every worker of one host shares, where each run of an
 *   importer is recorded, so a run in any of them acknowledges the signal.
 */
export function openHostWatchBridge(
  root: string,
  operations: Partial<ViteServeWatchOperations> = {},
  sentinelParent: string = os.tmpdir(),
  confirm?: { runs?: string },
): HostWatchBridge {
  const watch = createViteServeInputWatch(operations);
  const nodes = new Map<string, ViteModuleNodeLike & { file: string }>();
  let directory: string | undefined;
  let generation = 0;
  // Farm's dev server exposes no teardown hook, so the sentinel directory is
  // also removed when the process exits.
  const removeDirectory = (): void => {
    if (directory === undefined) return;
    fs.rmSync(directory, { force: true, recursive: true });
    directory = undefined;
  };
  const sentinelOf = (importer: string): string => {
    if (directory === undefined) {
      fs.mkdirSync(sentinelParent, { recursive: true });
      sweepAbandonedWatchBridges(sentinelParent);
      directory = fs.mkdtempSync(
        path.join(
          sentinelParent,
          `${WATCH_BRIDGE_DIRECTORY_PREFIX}${process.pid}-`,
        ),
      );
      process.once("exit", removeDirectory);
    }
    return path.join(directory, `${nameOf(importer)}.signal`);
  };
  const writeSentinel = (importer: string): void => {
    generation += 1;
    try {
      fs.writeFileSync(sentinelOf(importer), String(generation));
    } catch {
      // A sentinel that cannot be written signals nothing. The host's next
      // pass still re-proves the generation against the filesystem.
    }
  };
  // The next rewrite owed to each importer, until it is acknowledged.
  const pending = new Map<string, NodeJS.Timeout>();
  const settle = (importer: string): void => {
    clearTimeout(pending.get(importer));
    pending.delete(importer);
  };
  // Each importer's latest run. A host pool may run the importer again in a
  // worker other than the one owing the rewrites, and a rewrite landing while
  // that run is under way could make the host run it once more, so a host
  // whose workers share a directory records each run there, where every one
  // of them reads it. Only the rewrites' efficiency depends on it: a record
  // that cannot be read or written leaves every rewrite in place, and without
  // a shared directory each worker answers only its own signals.
  const localRuns = new Map<string, string>();
  const runOf = (importer: string): string | undefined =>
    confirm?.runs === undefined
      ? undefined
      : path.join(confirm.runs, `${nameOf(importer)}.run`);
  const readRun = (importer: string): string | undefined => {
    const file = runOf(importer);
    if (file === undefined) return localRuns.get(importer);
    try {
      return fs.readFileSync(file, "utf8");
    } catch {
      return undefined;
    }
  };
  const acknowledge = (importer: string): void => {
    settle(importer);
    if (confirm === undefined) return;
    const run = crypto.randomUUID();
    localRuns.set(importer, run);
    const file = runOf(importer);
    if (file === undefined) return;
    try {
      fs.writeFileSync(file, run);
    } catch {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, run);
      } catch {
        // Every rewrite still owed elsewhere stays in place.
      }
    }
  };
  const signal = (importer: string): void => {
    if (confirm === undefined) {
      writeSentinel(importer);
      return;
    }
    // A signal already owed keeps its schedule, which still lands a rewrite
    // after whatever baseline the host takes next.
    if (pending.has(importer)) return;
    // A run that starts after this read reads the change being signalled.
    const run = readRun(importer);
    // Each rewrite waits four times as long as the one before, without end:
    // however late the host takes its baseline, a later rewrite lands after
    // it, and an importer the host never runs again costs a number of rewrites
    // that grows only with the logarithm of the time it stays stale.
    const rewriteAfter = (delay: number): void => {
      const timer = setTimeout(() => {
        if (pending.get(importer) !== timer) return;
        if (readRun(importer) !== run) {
          settle(importer);
          return;
        }
        writeSentinel(importer);
        rewriteAfter(Math.min(delay * 4, MAX_TIMER_DELAY_MS));
      }, delay).unref();
      pending.set(importer, timer);
    };
    rewriteAfter(FIRST_SIGNAL_DELAY_MS);
  };
  watch.attach({
    config: { root },
    moduleGraph: {
      getModulesByFile: (file) => {
        const node = nodes.get(file);
        return node === undefined ? undefined : new Set([node]);
      },
      invalidateModule: (node) => {
        const importer = (node as { file?: string }).file;
        if (importer !== undefined) signal(importer);
      },
    },
  });
  return {
    acknowledge,
    begin: () => watch.begin(),
    close: async () => {
      for (const importer of [...pending.keys()]) settle(importer);
      await watch.dispose();
      nodes.clear();
      process.off("exit", removeDirectory);
      removeDirectory();
    },
    register(importer, inputs, failed, startedAt) {
      nodes.set(importer.replace(/\\/g, "/"), { file: importer });
      watch.replace(importer, inputs, failed, startedAt);
      // A failed delivery keeps the importer's earlier inputs observed.
      if (inputs.length === 0 && failed !== true) return undefined;
      const sentinel = sentinelOf(importer);
      if (!fs.existsSync(sentinel)) fs.writeFileSync(sentinel, "0");
      return sentinel;
    },
  };
}

/** The file name one importer's sentinel and run record share. */
function nameOf(importer: string): string {
  return crypto
    .createHash("sha256")
    .update(importer)
    .digest("hex")
    .slice(0, 32);
}

/**
 * How long a confirmed signal waits before its first rewrite, in milliseconds:
 * long enough for a host whose own watcher heard the same change to start the
 * importer again, which acknowledges it before any rewrite.
 */
const FIRST_SIGNAL_DELAY_MS = 50;

/** The longest delay a Node timer takes as given, in milliseconds. */
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;
