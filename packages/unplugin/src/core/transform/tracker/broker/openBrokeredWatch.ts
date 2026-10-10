import fs from "node:fs";
import path from "node:path";

import type { TtscTransformFilesystemOperations } from "../../filesystem/TtscTransformFilesystemOperations";
import { WATCH_BROKER } from "./WATCH_BROKER";
import { WATCH_PROBE_DIRECTORY_PREFIX } from "./WATCH_PROBE_DIRECTORY_PREFIX";
import { WATCH_PROBE_TIMEOUT_MS } from "./WATCH_PROBE_TIMEOUT_MS";
import type { WatchBrokerLocation } from "./WatchBrokerLocation";
import type { WatchBrokerSink } from "./WatchBrokerSink";
import { WatchBrokerTransport } from "./WatchBrokerTransport";
import { drainWatchBroker } from "./drainWatchBroker";
import { getWatchBroker } from "./getWatchBroker";
import { probeForLocation } from "./probeForLocation";
import { sweepAbandonedWatchProbes } from "./sweepAbandonedWatchProbes";

/**
 * Open directory watches in the isolated watch process for one sink, and report
 * when they hear.
 *
 * On Windows, ttsc's native helper owns completion-port directory subscriptions
 * and omits access-only notifications (#1719). Native loss and failure withdraw
 * coverage; actual change events remain authoritative even after A-B-A writes.
 * On macOS, each registration's watches are streams of their own, started
 * before the child reports ready, and a dropped event reaches the sink as a gap
 * (samchon/ttsc#1425). A stream that can be probed reports ready only once its
 * opening probe came back through it; the child suppresses ordinary callbacks
 * received before that probe. This is its backend protocol, not a guarantee
 * that every native mutation has a distinct or timely event.
 *
 * The one registration path of the broker. A generation's tracker registers
 * through it with a sink that records witnesses (`brokeredTrackerSink`), and an
 * input observer's scope with a sink that forwards events
 * (`openIsolatedRecursiveWatch`); the child and the routing of its messages
 * (`routeWatchBrokerMessage`) are the same for both.
 *
 * @param locations The directories to watch, as the caller spells them.
 * @param options.allEvents Whether `change` events are wanted, or renames
 *   alone.
 * @param options.drains Whether the registration takes part in drains, and so
 *   hears each drain's verdict on its watches.
 * @param options.filesystem The filesystem the canonical directories are read
 *   through.
 * @param options.probeRoot The project root, below whose tool cache the broker
 *   may write probes that prove a location's stream delivered
 *   (samchon/ttsc#1453). A location outside it cannot be proven that way.
 * @param options.sink Where the registration's messages go.
 * @returns `ready`, which ends the opening wait on acknowledgment, failed
 *   timeout or explicit closure without itself certifying success; `close`,
 *   which removes the registration and retires the broker after its last one,
 *   and throws the first cleanup failure; and `drain`, the broker's barrier.
 * @evidence contracts/common.md#principled-implementation
 *   Opening paths map back to caller spellings, using native realpath or lexical
 *   fallback; duplicate resolved directories keep the last caller spelling.
 *   Readiness completes a wait, while native probe/failure authority stays with
 *   the child and sink rather than being certified by Promise resolution.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This single registration path serves trackers and forwarding observers;
 *   child routing and owner event interpretation remain separate.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Failed probe preparation withdraws only probe proof, not invented watch
 *   success; native failures stay isolated rather than patching fs.watch.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs, parameters and return comments explain isolation, probe
 *   eligibility, deadlines and cleanup failures under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Supplied realpath or native absolute fallback represents directories to the
 *   child; callers must describe the same native view that child watches.
 *   Fallback spelling is not physical proof. Optional IPC ref methods support
 *   compatible runtimes without mutating their channel API.
 * @evidence contracts/performance.md#efficient-algorithms
 *   N locations are mapped with native realpath/fallback, spelling text and
 *   optional root/probe eligibility work; repeated probe roots still resolve
 *   before namespace memo lookup. Cold namespaces create cache parents and
 *   sweep their entries/subtrees. Normalized locations/spelling maps and IPC
 *   encoding grow with locations/names/text, while child startup and actual
 *   backend watcher/probe work remain delegated costs.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   This loaded adapter's broker serves independent sinks. Exact lexical probe
 *   roots share prepared namespace addresses, not proof of continued access or
 *   successful native opening. Backend proof remains current, and drain sharing
 *   uses each request's covered scope rather than registration existence alone.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   A returned handle owns a registration/ready wait; completed acknowledgment,
 *   timeout or close permits finally to clear the timer and pending reference.
 *   Close removes registration then attempts send/disconnect/kill independently,
 *   without certifying child exit. Synchronous setup/native or sink exceptions
 *   can interrupt before a handle or settlement is returned; no rollback or
 *   caller cancellation deadline is provided here. Namespace addresses persist
 *   by distinct historical lexical roots until exit cleanup is attempted, with
 *   no count/byte cap or guarantee under failed/abrupt native cleanup.
 */
export function openBrokeredWatch(
  locations: readonly WatchBrokerLocation[],
  options: {
    allEvents: boolean;
    drains: boolean;
    filesystem: TtscTransformFilesystemOperations;
    probeRoot?: string;
    sink: WatchBrokerSink;
  },
): {
  close(): void;
  drain(): Promise<boolean>;
  ready: Promise<void>;
} {
  const broker = getWatchBroker();
  // The child watches canonical directories, and reports its events under that
  // spelling. Everything else in the adapter speaks the caller's own spelling,
  // which on Windows can be an 8.3 short form of the same directory, so keep
  // the way back: a filter that compared the child's spelling against the
  // configuration's would be comparing two names for one directory that share
  // no common prefix (samchon/ttsc#1307).
  const spellings = new Map<string, string>();
  const normalized = locations.map((location) => {
    let directory: string;
    try {
      directory = options.filesystem.realpath(location.directory);
    } catch {
      directory = path.resolve(location.directory);
    }
    spellings.set(directory, location.directory);
    // A probe proves only a backend that writes one, FSEvents, and one whose
    // directory cannot be prepared, below a read-only `node_modules`, leaves
    // the location unproven rather than the watch failed, as a probe the child
    // cannot write does (samchon/ttsc#1480).
    let probe: ReturnType<typeof probeForLocation>;
    try {
      probe = broker.probes
        ? probeForLocation(
            directory,
            options.probeRoot,
            probeDirectory,
            options.filesystem,
          )
        : undefined;
    } catch {
      probe = undefined;
    }
    return {
      directory,
      ...(location.names === undefined ? {} : { names: location.names }),
      ...(location.recursive === true ? { recursive: true } : {}),
      ...(probe === undefined ? {} : { probe }),
    };
  });
  broker.pendingRegistrations += 1;
  WatchBrokerTransport.reference(broker, true);
  const id = broker.nextId++;
  let resolveReady!: () => void;
  const answered = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  broker.registrations.set(id, {
    drains: options.drains,
    ready: resolveReady,
    sink: options.sink,
    spellings,
  });
  const close = (): void => {
    const active = broker.registrations.get(id);
    if (active === undefined) return;
    broker.registrations.delete(id);
    active.ready();
    let failed = false;
    let failure: unknown;
    try {
      WatchBrokerTransport.send(broker, { id, op: "remove" });
    } catch (error) {
      failed = true;
      failure = error;
    }
    if (broker.registrations.size === 0) {
      if (WATCH_BROKER.current === broker) {
        WATCH_BROKER.current = undefined;
      }
      try {
        WatchBrokerTransport.close(broker);
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
  WatchBrokerTransport.send(broker, {
    allEvents: options.allEvents,
    locations: normalized,
    id,
    op: "add",
  });
  let timer: NodeJS.Timeout | undefined;
  const ready = Promise.race([
    answered,
    new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        // Nothing heard within the probe timeout: the watches cannot prove
        // they deliver, so they are given up rather than awaited further.
        if (broker.registrations.get(id) !== undefined) {
          options.sink.failed();
          try {
            close();
          } catch {
            // The child is already gone; the watches are failed either way.
          }
        }
        resolve();
      }, WATCH_PROBE_TIMEOUT_MS);
    }),
  ]).finally(() => {
    clearTimeout(timer);
    broker.pendingRegistrations -= 1;
    // `ref`/`unref` is a flag rather than a counter, so this must not clear a
    // reference an in-flight acknowledgement is holding: a delivery waiting on
    // a reply over an unreferenced channel lets the loop empty and the process
    // exit mid-build.
    if (broker.pendingRegistrations === 0 && broker.pendingDrains === 0) {
      WatchBrokerTransport.reference(broker, false);
    }
  });
  return {
    close,
    drain: () => drainWatchBroker(broker, undefined, id),
    ready,
  };
}

/** Probe directories already prepared by this process, by project root. */
const PROBE_DIRECTORIES = new Map<string, string>();

/**
 * The directory below `probeRoot`'s tool cache where the broker writes its
 * probes, named after this process so a later process can remove it once this
 * one is gone (`WATCH_PROBE_DIRECTORY_PREFIX`). It is removed when this process
 * exits, and a stale one is swept before it is named.
 *
 * One exit listener removes every probe directory of the process: a listener
 * per project root would add one for each project a process watches, past the
 * count at which Node warns of a leak.
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
  if (PROBE_DIRECTORIES.size === 0) {
    process.once("exit", () => {
      for (const opened of PROBE_DIRECTORIES.values()) {
        try {
          fs.rmSync(opened, { force: true, recursive: true });
        } catch {
          // A directory left behind is swept by the next process to probe.
        }
      }
    });
  }
  PROBE_DIRECTORIES.set(probeRoot, directory);
  return directory;
}
