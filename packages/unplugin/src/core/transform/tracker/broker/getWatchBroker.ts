import { spawn } from "node:child_process";

import { WATCH_BROKER } from "./WATCH_BROKER";
import type { WatchBroker } from "./WatchBroker";
import { fseventsBindingPath } from "./fseventsBindingPath";
import { routeWatchBrokerMessage } from "./routeWatchBrokerMessage";
import { warnMissingFseventsBinding } from "./warnMissingFseventsBinding";
import { watchBrokerSource } from "./watchBrokerSource";

/**
 * Return the process-wide watch broker, starting it on first use.
 *
 * Every Windows and macOS watch of the transform core's trackers and of the
 * input observer's scopes lives in one isolated child process, for a reason on
 * each:
 *
 * - Node's Windows fs-event backend can hit a native assertion that aborts the
 *   whole process when a watched temporary tree is deleted. In the child that
 *   crash becomes an ordinary exit that fails the affected trackers, and those
 *   generations fall back to proving themselves from recorded state instead of
 *   taking the host down.
 * - On macOS, libuv serves every directory watch of one event loop through a
 *   single FSEventStream and re-creates it whenever any watch in that loop
 *   opens or closes, losing the events in between (samchon/ttsc#1418), and it
 *   discards the notice FSEvents gives when events were dropped. The child
 *   watches through the `fsevents` binding instead, one stream per watch, and
 *   passes each drop on as a gap (samchon/ttsc#1425); see
 *   {@link watchBrokerSource}.
 *
 * The child is unreferenced between requests, so it never keeps a host alive.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Native failures are isolated in one protocol child; exit fails registrations
 *   and releases drains false instead of certifying their silence.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One holder owns startup and process failure routing; registration lifetime
 *   and drain scope remain with their owning operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The optional macOS binding is resolved normally; no fs.watch patch or
 *   guessed delay substitutes for dropped-event capability.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native platform-reason list and lifecycle paragraph explain isolation and
 *   process ownership under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral startup uses the current Node executable and argument-array spawn;
 *   native FSEvents loading and platform differences remain in this boundary.
 * @evidence contracts/performance.md#efficient-algorithms
 *   The current broker lookup is constant work; failure visits registrations and
 *   outstanding drains once, linear in those owners rather than watched files.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   All native tracker and observer registrations share the current broker;
 *   failure clears that instance so later opens never reuse a dead producer.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Registrations own broker demand and the last closer disconnects and kills it;
 *   requests reference the channel while awaiting replies. Failed children clear
 *   registrations and drains, allowing their timers and waiters to retire.
 */
export function getWatchBroker(): WatchBroker {
  if (WATCH_BROKER.current !== undefined) {
    return WATCH_BROKER.current;
  }
  const fsevents =
    process.platform === "darwin" ? fseventsBindingPath() : undefined;
  if (fsevents === null) warnMissingFseventsBinding();
  const child = spawn(process.execPath, ["-e", watchBrokerSource(fsevents)], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
    windowsHide: true,
  });
  const broker: WatchBroker = {
    child,
    drains: new Map(),
    nextId: 1,
    pendingDrains: 0,
    pendingRegistrations: 0,
    probes: typeof fsevents === "string",
    registrations: new Map(),
  };
  const fail = (): void => {
    for (const registration of broker.registrations.values()) {
      registration.sink.failed();
      registration.ready();
    }
    broker.registrations.clear();
    // A broker that died answers no round-trip. Release every waiter instead of
    // stalling the deliveries behind them; every registration was told its
    // watches failed, so a generation proves itself from its own state and an
    // input observer's scope falls back to its poll.
    for (const release of broker.drains.values()) release(false);
    broker.drains.clear();
    if (WATCH_BROKER.current === broker) {
      WATCH_BROKER.current = undefined;
    }
  };
  child.on("error", fail);
  child.on("exit", fail);
  child.on("message", (message: unknown) =>
    routeWatchBrokerMessage(broker, message),
  );
  WATCH_BROKER.current = broker;
  return broker;
}
