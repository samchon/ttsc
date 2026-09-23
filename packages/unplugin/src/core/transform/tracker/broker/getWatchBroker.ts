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
