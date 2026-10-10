import readline from "node:readline";
import { resolveBinary } from "ttsc/binary";

import { traceProcessSpawn } from "../../../tracing/traceProcessSpawn";
import { WATCH_BROKER } from "./WATCH_BROKER";
import type { WatchBroker } from "./WatchBroker";
import { fseventsBindingPath } from "./fseventsBindingPath";
import { routeWatchBrokerMessage } from "./routeWatchBrokerMessage";
import { warnMissingFseventsBinding } from "./warnMissingFseventsBinding";
import { watchBrokerSource } from "./watchBrokerSource";

/**
 * Return this loaded adapter's watch broker, starting it on first use.
 *
 * Broker-eligible Windows and macOS default watches share an isolated child;
 * caller-supplied watch capabilities can bypass it. Isolation has a reason on
 * each native backend:
 *
 * - Windows runs ttsc's native completion-port helper directly. Its directory
 *   filter excludes access-time notifications: reads must not masquerade as
 *   writes (#1719). Actual writes, metadata changes, native loss and failed
 *   coverage remain observable; equal bytes cannot erase an A-B-A event. No
 *   Node fs-event handle is opened in the host or an intermediate process.
 * - On macOS, libuv serves every directory watch of one event loop through a
 *   single FSEventStream and re-creates it whenever any watch in that loop
 *   opens or closes, losing the events in between (samchon/ttsc#1418), and it
 *   discards the notice FSEvents gives when events were dropped. The child
 *   watches through the `fsevents` binding instead, one stream per watch, and
 *   passes each drop on as a gap (samchon/ttsc#1425); see
 *   {@link watchBrokerSource}.
 *
 * Registration/drain owners unreference the child and IPC channel after their
 * outstanding acknowledgments finish; startup itself returns a referenced
 * child. Last-registration closure ends the request stream and attempts
 * termination. This accessor has no independent shutdown deadline or exit
 * wait.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Native watches run in a protocol child. Error/exit dispatch reports failure
 *   and false drain completion, not proven silence; sink/release callbacks must
 *   complete for all owners to be notified and cleared.
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
 *   Windows resolves the same ttsc binary as its compiler owner and uses the
 *   native __watch command; macOS uses this runtime and supported FSEvents.
 *   Argument-array spawn, hidden Windows processes and ordered transport stay
 *   inside this boundary.
 * @evidence contracts/performance.md#efficient-algorithms
 *   A current-holder read is fixed work. Cold startup includes optional native
 *   module resolution/warning, child source construction and native process/IPC
 *   creation; resolution/path/source bytes and process startup cost do not
 *   vanish into one spawn call. Failure visits R registrations and D drain
 *   callbacks, whose native/reference/sink work remains delegated; it does not
 *   enumerate watched source trees.
 *   Enabled private tracing serializes the actual executable/source argv and
 *   lifecycle events; this observation cost follows their text bytes.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   This module copy's eligible registrations share the broker under its runtime/binding
 *   view chosen at startup. Completed error/exit handling clears only that
 *   current instance so later opens can start another. A current holder is not
 *   a health certificate; binding installation changes are not re-resolved
 *   while it remains current, and sink exceptions can interrupt failure handling.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   One current module holder retains a direct child and registration/drain maps;
 *   those populations and caller-retained retired brokers have no cap here.
 *   Request owners manage references/timers, and last closure attempts native
 *   disconnection/kill rather than proving exit. Completed failure routing
 *   clears maps/releases drains; callback exceptions can interrupt it. This
 *   accessor owns no independent cancellation or child-exit deadline.
 */
export function getWatchBroker(): WatchBroker {
  if (WATCH_BROKER.current !== undefined) {
    return WATCH_BROKER.current;
  }
  const fsevents =
    process.platform === "darwin" ? fseventsBindingPath() : undefined;
  if (fsevents === null) warnMissingFseventsBinding();
  const native = process.platform === "win32";
  const binary = native ? resolveBinary() : process.execPath;
  if (binary === null)
    throw new Error("No ttsc native watch helper is available");
  const child = traceProcessSpawn(
    binary,
    native ? ["__watch"] : ["-e", watchBrokerSource(fsevents)],
    {
      stdio: native
        ? ["pipe", "pipe", "ignore"]
        : ["ignore", "ignore", "ignore", "ipc"],
      windowsHide: true,
    },
  );
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
  if (native) {
    // All Windows registrations share one direct native child. No Node watcher,
    // nested child, global runtime patch, or access-time system change is needed.
    const input = child.stdin;
    const output = child.stdout;
    if (input === null || output === null) {
      child.kill();
      throw new Error("The native watch helper has no protocol pipes");
    }
    broker.transport = {
      send(message) {
        if (input.destroyed || input.writableEnded) return false;
        // write(false) means buffered backpressure, not refusal. The callback
        // reports a real transport failure to every still-live registration.
        input.write(JSON.stringify(message) + "\n", (error) => {
          if (error !== null && error !== undefined) {
            fail();
            child.kill();
          }
        });
        return true;
      },
      reference(active) {
        const pipe = output as typeof output & {
          ref?: () => void;
          unref?: () => void;
        };
        if (active) {
          child.ref();
          pipe.ref?.();
        } else {
          child.unref();
          pipe.unref?.();
        }
      },
      close() {
        input.end();
      },
    };
    const lost = (): void => {
      fail();
      child.kill();
    };
    input.on("error", lost);
    output.on("error", lost);
    output.on("end", lost);
    readline
      .createInterface({ input: output, crlfDelay: Infinity })
      .on("line", (line) => {
        let message: unknown;
        try {
          message = JSON.parse(line) as unknown;
        } catch {
          lost();
          return;
        }
        routeWatchBrokerMessage(broker, message);
      });
  }
  child.on("error", fail);
  child.on("exit", fail);
  child.on("message", (message: unknown) =>
    routeWatchBrokerMessage(broker, message),
  );
  WATCH_BROKER.current = broker;
  return broker;
}
