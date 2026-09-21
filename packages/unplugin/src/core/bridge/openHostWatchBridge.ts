import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { ViteModuleNodeLike } from "../vite/ViteModuleNodeLike";
import type { ViteServeWatchOperations } from "../vite/ViteServeWatchOperations";
import { createViteServeInputWatch } from "../vite/createViteServeInputWatch";
import type { HostWatchBridge } from "./HostWatchBridge";
import { WATCH_BRIDGE_SENTINEL_DIRECTORY } from "./WATCH_BRIDGE_SENTINEL_DIRECTORY";
import { hostToolDirectory } from "./hostToolDirectory";
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
 * sentinel. Sentinels live in one directory below the host's tool directory,
 * shared by every process and every session on the project, and they stay: a
 * host with a persistent cache records each module's sentinel as a dependency,
 * and a sentinel that survived the session lets the host restore the module
 * from its cache on the next start instead of running it again
 * (samchon/ttsc#1468). A session that dies leaves nothing to remove. Two live
 * processes on one project share the files, and a rewrite by either signals
 * both, which is at most one rebuild the other did not need.
 *
 * @param root The directory whose pinned scope observes the project.
 * @param operations Native watch seams, replaceable for tests.
 * @param sentinelParent Where the sentinel directory is created: the project's
 *   own tool directory below `root` by default (`hostToolDirectory`), the one
 *   place every host can watch a sentinel in.
 * @param confirmDelivery Whether a signal repeats until the importer is
 *   registered again. Turbopack takes a dependency's state only when the loader
 *   returns, as its baseline, so a sentinel rewritten before then is part of
 *   that baseline and signals nothing (samchon/ttsc#1423). Repeating with a
 *   growing delay lands a rewrite after the baseline however late the host
 *   takes it. Only a registration ends the repetition: it proves what the
 *   importer's new delivery read against the changes since, and a delivery that
 *   read the old state is signalled again at once. A run that merely started
 *   proves nothing, since it may still serve the state the signal was about. A
 *   host that compares timestamps, as webpack does, or that watches the
 *   sentinel from before the rewrite hears the first one, and a second would
 *   only rebuild again.
 *
 *   Its place in the adapter's invalidation model, and the units beside it, are
 *   mapped in the maintainer page
 *   `website/src/content/docs/development/reference/unplugin-invalidation.mdx`.
 */
export function openHostWatchBridge(
  root: string,
  operations: Partial<ViteServeWatchOperations> = {},
  sentinelParent: string = hostToolDirectory(root),
  confirmDelivery = false,
): HostWatchBridge {
  const watch = createViteServeInputWatch(operations);
  const nodes = new Map<string, ViteModuleNodeLike & { file: string }>();
  const directory = path.join(sentinelParent, WATCH_BRIDGE_SENTINEL_DIRECTORY);
  let prepared = false;
  let generation = 0;
  const sentinelOf = (importer: string): string => {
    if (!prepared) {
      fs.mkdirSync(directory, { recursive: true });
      sweepAbandonedWatchBridges(sentinelParent);
      prepared = true;
    }
    return path.join(directory, `${nameOf(importer)}.signal`);
  };
  // Every rewrite lands bytes no earlier write of any process left, so a host
  // comparing content hears it as a host comparing timestamps does.
  const writeSentinel = (importer: string): void => {
    generation += 1;
    try {
      fs.writeFileSync(sentinelOf(importer), `${process.pid}:${generation}`);
    } catch {
      // A sentinel that cannot be written signals nothing. The host's next
      // pass still re-proves the generation against the filesystem.
    }
  };
  // The importers signalled since they last registered, by resolved path.
  const owed = new Set<string>();
  // The next rewrite owed to each importer, until it is registered again.
  const pending = new Map<string, NodeJS.Timeout>();
  const settle = (importer: string): void => {
    owed.delete(path.resolve(importer));
    clearTimeout(pending.get(importer));
    pending.delete(importer);
  };
  const signal = (importer: string): void => {
    owed.add(path.resolve(importer));
    if (!confirmDelivery) {
      writeSentinel(importer);
      return;
    }
    // A signal already owed keeps its schedule, which still lands a rewrite
    // after whatever baseline the host takes next.
    if (pending.has(importer)) return;
    // Each rewrite waits four times as long as the one before, without end:
    // however late the host takes its baseline, a later rewrite lands after
    // it, and an importer the host never registers again costs a number of
    // rewrites that grows only with the logarithm of the time it stays stale.
    // A pool worker that never sees the registration keeps rewriting after
    // another worker delivered; the host then runs the importer once more,
    // from its cache, and that run's registration is what ends it there.
    const rewriteAfter = (delay: number): void => {
      const timer = setTimeout(() => {
        if (pending.get(importer) !== timer) return;
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
    begin: () => watch.begin(),
    close: async () => {
      for (const importer of [...pending.keys()]) settle(importer);
      owed.clear();
      await watch.dispose();
      nodes.clear();
    },
    owes: (importer) => owed.has(path.resolve(importer)),
    register(importer, inputs, failed, startedAt) {
      nodes.set(importer.replace(/\\/g, "/"), { file: importer });
      // The delivery being registered answers every signal owed so far. If it
      // read a state a change since `startedAt` has left, the replacement
      // finds that at once and signals again.
      settle(importer);
      watch.replace(importer, inputs, failed, startedAt);
      // A failed delivery keeps the importer's earlier inputs observed.
      if (inputs.length === 0 && failed !== true) return undefined;
      // A sentinel an earlier session left is left as it is: a host restoring
      // the importer from its persistent cache then finds the dependency it
      // recorded unchanged, and only a signal ever rewrites it.
      const sentinel = sentinelOf(importer);
      if (!fs.existsSync(sentinel))
        fs.writeFileSync(sentinel, `${process.pid}:0`);
      return sentinel;
    },
  };
}

/** The file name of one importer's sentinel. */
function nameOf(importer: string): string {
  return crypto
    .createHash("sha256")
    .update(importer)
    .digest("hex")
    .slice(0, 32);
}

/**
 * How long a confirmed signal waits before its first rewrite, in milliseconds:
 * long enough for a host whose own watcher heard the same change to run and
 * register the importer again, which answers the signal before any rewrite.
 */
const FIRST_SIGNAL_DELAY_MS = 50;

/** The longest delay a Node timer takes as given, in milliseconds. */
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;
