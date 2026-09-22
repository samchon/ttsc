import path from "node:path";

import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";
import type { ViteModuleNodeLike } from "../vite/ViteModuleNodeLike";
import type { ViteServeWatchOperations } from "../vite/ViteServeWatchOperations";
import { createViteServeInputWatch } from "../vite/createViteServeInputWatch";
import type { HostWatchBridge } from "./HostWatchBridge";
import { signalProjectRecordFile } from "./signalProjectRecordFile";

/**
 * Open the watch bridge for one watching build session: the adapter's own
 * observer of every input of every generation, which tells the host of a change
 * by moving the project's record (samchon/ttsc#1388).
 *
 * A host's own watcher observes the compiler's inputs imprecisely, or not at
 * all, and each host differently: one never reports a created path or a
 * directory gaining an entry, one opens a watcher per registered path, one
 * loses a change that lands while it builds or before it records its baseline,
 * one fails a module on a dependency outside its root or reads a directory as a
 * file. The host is therefore handed no input at all, only the project's record
 * (`projectRecordFile`), and the bridge observes the inputs with the bounded
 * observer that serves the Vite dev server: one project scope plus at most 16
 * external ones, and a precise predicate re-check per event. The observer is
 * reused through its structural server view: each record is its own module
 * node, and invalidating that node moves the record
 * (`signalProjectRecordFile`).
 *
 * A signal moves the record at once and is owed until a registration whose
 * delivery read the post-signal state answers it (principle C). A host takes a
 * file's state as its baseline at a moment of its own choosing, which may lie
 * after the move: Turbopack when it processes the loader's result
 * (samchon/ttsc#1423), Rspack when its watcher records the file's time after a
 * build, Rolldown after the build a change landed in. So the record is moved
 * again, with a delay that grows fourfold each time without end, until a
 * registration answers: however late the host takes its baseline, a later move
 * lands after it, and a record the host never registers again costs a number of
 * moves that grows only with the logarithm of the time it stays stale. A host
 * that heard the first move runs the project's modules before the second is
 * due, and their registrations end it; a pool worker that never sees the
 * registration keeps moving the record after another worker delivered, and the
 * host then runs the modules once more, from its cache, which registers and
 * ends it there.
 *
 * The record stays when the bridge closes: a host with a persistent cache
 * recorded it as a dependency of every module, and a build start proves it
 * against the disk (`refreshProjectRecordFiles`).
 *
 * @param root The directory whose pinned scope observes the project.
 * @param operations Native watch seams, replaceable for tests.
 */
export function openHostWatchBridge(
  root: string,
  operations: Partial<ViteServeWatchOperations> = {},
): HostWatchBridge {
  const watch = createViteServeInputWatch(operations);
  const nodes = new Map<string, ViteModuleNodeLike & { file: string }>();
  // What each record was last registered with.
  const registered = new Map<
    string,
    { inputs: readonly TtscWatchInput[]; startedAt: number | undefined }
  >();
  // The records signalled since they last registered, by resolved path.
  const owed = new Set<string>();
  // The pass a signal was last answered in, and the current pass: a host that
  // asks per module whether its cache may serve it, Rollup, is answered for
  // the whole pass the signal was answered in, since the first delivery of a
  // pass answers for the project while the modules after it in the same pass
  // would still be served from the cache the signal was about.
  let pass = 0;
  let lastBegin: number | undefined;
  let answeredIn: number | undefined;
  // The next move owed to each record, until it is registered again.
  const pending = new Map<string, NodeJS.Timeout>();
  const settle = (record: string): void => {
    owed.delete(path.resolve(record));
    clearTimeout(pending.get(record));
    pending.delete(record);
  };
  const signal = (record: string): void => {
    owed.add(path.resolve(record));
    // A signal already owed keeps its schedule, which still lands a move
    // after whatever baseline the host takes next.
    if (pending.has(record)) return;
    signalProjectRecordFile(record);
    const moveAfter = (delay: number): void => {
      const timer = setTimeout(() => {
        if (pending.get(record) !== timer) return;
        signalProjectRecordFile(record);
        moveAfter(Math.min(delay * 4, MAX_TIMER_DELAY_MS));
      }, delay).unref();
      pending.set(record, timer);
    };
    moveAfter(FIRST_SIGNAL_DELAY_MS);
  };
  watch.attach({
    config: { root },
    moduleGraph: {
      getModulesByFile: (file) => {
        const node = nodes.get(file);
        return node === undefined ? undefined : new Set([node]);
      },
      invalidateModule: (node) => {
        const record = (node as { file?: string }).file;
        if (record !== undefined) signal(record);
      },
    },
  });
  return {
    begin: () => {
      pass += 1;
      lastBegin = watch.begin();
      return lastBegin;
    },
    close: async () => {
      for (const record of [...pending.keys()]) settle(record);
      owed.clear();
      registered.clear();
      await watch.dispose();
      nodes.clear();
    },
    owes: (record) =>
      answeredIn === pass ||
      (record === undefined ? owed.size !== 0 : owed.has(path.resolve(record))),
    register(record, inputs, failed, startedAt) {
      // Every module of a generation registers the same inputs, the same
      // array, against the same pass, and the first registration established
      // the observation: the observer is live from then on and reports every
      // later change itself, so the rest register nothing again and settle
      // nothing either, since a delivery of the same generation carries the
      // state the first did.
      const last = registered.get(record);
      if (
        last !== undefined &&
        last.inputs === inputs &&
        last.startedAt === startedAt &&
        failed !== true
      ) {
        return;
      }
      registered.set(record, { inputs, startedAt });
      if (
        owed.has(path.resolve(record)) &&
        startedAt !== undefined &&
        startedAt === lastBegin
      ) {
        answeredIn = pass;
      }
      nodes.set(record.replace(/\\/g, "/"), { file: record });
      // The delivery being registered answers every signal owed so far. If it
      // read a state a change since `startedAt` has left, the replacement
      // finds that at once and signals again.
      settle(record);
      watch.replace(record, inputs, failed, startedAt);
    },
  };
}

/**
 * How long a signal waits before its second move, in milliseconds: long enough
 * for a host that heard the first to run and register the project's modules
 * again, which answers the signal before any further move.
 */
const FIRST_SIGNAL_DELAY_MS = 50;

/** The longest delay a Node timer takes as given, in milliseconds. */
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;
