import fs from "node:fs";
import path from "node:path";

import type { TtscTransformFilesystemOperations } from "../../filesystem/TtscTransformFilesystemOperations";
import type { TtscProjectMutationTracker } from "../TtscProjectMutationTracker";
import { WATCH_BROKER } from "./WATCH_BROKER";
import { WATCH_PROBE_DIRECTORY_PREFIX } from "./WATCH_PROBE_DIRECTORY_PREFIX";
import { WATCH_PROBE_TIMEOUT_MS } from "./WATCH_PROBE_TIMEOUT_MS";
import type { WatchBrokerLocation } from "./WatchBrokerLocation";
import { drainWatchBroker } from "./drainWatchBroker";
import { getWatchBroker } from "./getWatchBroker";
import { probeForLocation } from "./probeForLocation";
import { sweepAbandonedWatchProbes } from "./sweepAbandonedWatchProbes";

/**
 * Register directory watches in the isolated watch process, and resolve once
 * they hear.
 *
 * On Windows, Node's fs-event backend can assert in native code when a watched
 * temporary tree is deleted. Isolation turns that unrecoverable process abort
 * into an ordinary broker exit and a conservative cache miss in the host. On
 * macOS, each watch is its own FSEventStream, started before the child reports
 * ready, and a dropped event reaches the tracker as a gap (samchon/ttsc#1425).
 * A stream that can be probed reports ready only once its opening probe came
 * back through it, so nothing it delivers afterwards predates that moment
 * (samchon/ttsc#1454). A read made after this resolves can therefore never race
 * the watch's start. A child that reports nothing within the probe timeout
 * fails the tracker, as a watch that could not be opened does.
 */
export async function registerBrokeredMutationTracker(
  tracker: TtscProjectMutationTracker,
  locations: readonly WatchBrokerLocation[],
  allEvents: boolean,
  filesystem: TtscTransformFilesystemOperations,
  /**
   * Optional filter for the project-directory tracker, whose events have to be
   * narrowed to program membership exactly as the in-process watcher's are. The
   * name-watching trackers pass none, since they already watch exact names.
   */
  membership?: (location: string, filename: string) => boolean,
  content?: (location: string, filename: string) => boolean,
  changeAddsMembership?: (location: string, filename: string) => boolean,
  /**
   * The exact-input trackers' shared event decision. When present it is the
   * only filter the broker applies, so a brokered tracker records exactly what
   * the in-process listener would for the same event.
   */
  classify?: (
    location: string,
    filename: string | null,
    eventType: string,
  ) => "change" | "mutation" | undefined,
  /**
   * What a gap notice means to this registration; absent, the tracker is marked
   * unverified. See `WatchBroker`.
   */
  gap?: () => void,
  /**
   * The project root, below whose tool cache the broker may write probes that
   * prove a location's stream delivered (samchon/ttsc#1453). A location inside
   * it is proven through a stream opened there; one outside it cannot be, and
   * every drain names it in the tracker's unproven set.
   */
  probeRoot?: string,
  /**
   * Whether the tracker drains, and so takes each drain's verdict on its
   * watches. A watch that only forwards events, such as a Vite serve scope,
   * passes `false` and is never told.
   */
  drains = true,
): Promise<void> {
  const broker = getWatchBroker();
  // The child watches canonical directories, and reports its events under that
  // spelling. Everything else in the adapter speaks the walk's own spelling,
  // which on Windows can be an 8.3 short form of the same directory, so keep
  // the way back: a filter that compared the child's spelling against the
  // configuration's would be comparing two names for one directory that share
  // no common prefix (samchon/ttsc#1307).
  const spellings = new Map<string, string>();
  const normalized = locations.map((location) => {
    let directory: string;
    try {
      directory = filesystem.realpath(location.directory);
    } catch {
      directory = path.resolve(location.directory);
    }
    spellings.set(directory, location.directory);
    const probe = probeForLocation(
      directory,
      probeRoot,
      probeDirectory,
      filesystem,
    );
    return {
      directory,
      ...(location.names === undefined ? {} : { names: location.names }),
      ...(location.recursive === true ? { recursive: true } : {}),
      ...(probe === undefined ? {} : { probe }),
    };
  });
  broker.pendingRegistrations += 1;
  broker.child.ref();
  // Bun's IPC channel omits Node's Control.ref/unref methods. The child itself
  // still owns the outstanding acknowledgement on that runtime.
  broker.child.channel?.ref?.();
  const id = broker.nextId++;
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  broker.trackers.set(id, {
    ...(changeAddsMembership === undefined ? {} : { changeAddsMembership }),
    ...(classify === undefined ? {} : { classify }),
    ...(content === undefined ? {} : { content }),
    ...(gap === undefined ? {} : { gap }),
    ...(membership === undefined ? {} : { membership }),
    drains,
    ready: resolveReady,
    spellings,
    tracker,
  });
  tracker.drain = () => drainWatchBroker(broker);
  tracker.close = () => {
    tracker.failed = true;
    const active = broker.trackers.get(id);
    if (active === undefined) return;
    broker.trackers.delete(id);
    active.ready();
    let failed = false;
    let failure: unknown;
    try {
      broker.child.send?.({ id, op: "remove" });
    } catch (error) {
      failed = true;
      failure = error;
    }
    if (broker.trackers.size === 0) {
      if (WATCH_BROKER.current === broker) {
        WATCH_BROKER.current = undefined;
      }
      try {
        broker.child.disconnect?.();
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
      try {
        broker.child.kill();
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }
    if (failed) throw failure;
  };
  broker.child.send?.({
    allEvents,
    locations: normalized,
    id,
    op: "add",
  });
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      ready,
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          // Nothing heard within the probe timeout: the watch cannot prove it
          // delivers, so it is given up rather than awaited further.
          try {
            if (broker.trackers.get(id) !== undefined) tracker.close();
          } catch {
            // The child is already gone; the tracker is failed either way.
          }
          resolve();
        }, WATCH_PROBE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    broker.pendingRegistrations -= 1;
    // `ref`/`unref` is a flag rather than a counter, so this must not clear a
    // reference an in-flight acknowledgement is holding: a delivery waiting on
    // a reply over an unreferenced channel lets the loop empty and the process
    // exit mid-build.
    if (broker.pendingRegistrations === 0 && broker.pendingDrains === 0) {
      broker.child.unref();
      broker.child.channel?.unref?.();
    }
  }
}

/** Probe directories already prepared by this process, by project root. */
const PROBE_DIRECTORIES = new Map<string, string>();

/**
 * The directory below `probeRoot`'s tool cache where the broker writes its
 * probes, named after this process so a later process can remove it once this
 * one is gone (`WATCH_PROBE_DIRECTORY_PREFIX`). It is removed when this process
 * exits, and a stale one is swept before it is named.
 */
function probeDirectory(probeRoot: string): string {
  const existing = PROBE_DIRECTORIES.get(probeRoot);
  if (existing !== undefined) return existing;
  const parent = path.join(probeRoot, "node_modules", ".cache", "ttsc");
  fs.mkdirSync(parent, { recursive: true });
  sweepAbandonedWatchProbes(parent);
  const directory = path.join(
    parent,
    `${WATCH_PROBE_DIRECTORY_PREFIX}${process.pid}`,
  );
  process.once("exit", () => {
    fs.rmSync(directory, { force: true, recursive: true });
  });
  PROBE_DIRECTORIES.set(probeRoot, directory);
  return directory;
}
