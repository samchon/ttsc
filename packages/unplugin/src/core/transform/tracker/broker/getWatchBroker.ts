import { spawn } from "node:child_process";

import { WATCH_BROKER } from "./WATCH_BROKER";
import type { WatchBroker } from "./WatchBroker";
import { fseventsBindingPath } from "./fseventsBindingPath";
import { routeWatchBrokerMessage } from "./routeWatchBrokerMessage";
import { watchBrokerSource } from "./watchBrokerSource";

/**
 * Return the process-wide watch broker, starting it on first use.
 *
 * Every Windows and macOS observer of the transform core and the Vite serve
 * watcher lives in one isolated child process, for a reason on each:
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
 */
export function getWatchBroker(): WatchBroker {
  if (WATCH_BROKER.current !== undefined) {
    return WATCH_BROKER.current;
  }
  const child = spawn(
    process.execPath,
    [
      "-e",
      watchBrokerSource(
        process.platform === "darwin" ? fseventsBindingPath() : undefined,
      ),
    ],
    {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      windowsHide: true,
    },
  );
  const broker: WatchBroker = {
    child,
    drains: new Map(),
    nextId: 1,
    pendingDrains: 0,
    pendingRegistrations: 0,
    trackers: new Map(),
  };
  const fail = (): void => {
    for (const registration of broker.trackers.values()) {
      registration.tracker.failed = true;
      registration.ready();
    }
    broker.trackers.clear();
    // A broker that died answers no round-trip. Release every waiter instead of
    // stalling the deliveries behind them; their trackers are failed now, so
    // validation falls back to proving the generation from its own state.
    for (const release of broker.drains.values()) release();
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
