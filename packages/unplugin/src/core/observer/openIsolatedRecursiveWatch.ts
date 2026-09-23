import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { openBrokeredWatch } from "../transform/tracker/broker/openBrokeredWatch";

/**
 * Open one recursive observer inside the transform core's isolated watch broker
 * instead of the host process.
 *
 * On Windows, Node's fs-event backend can abort the process that owns a watch,
 * for instance with `Assertion failed: !_wcsnicmp(filename, dir, dirlen)` in
 * `src\win\fs-event.c` (samchon/ttsc#1411). On macOS, libuv serves every
 * directory watch of a loop through one FSEventStream and re-creates it
 * whenever any watch opens or closes, losing the events in between
 * (samchon/ttsc#1418), where the broker opens one stream per watch. The
 * observer's scopes get the isolation the transform core's trackers have,
 * through the same registration (`openBrokeredWatch`) with a sink of their own
 * that forwards every event (samchon/ttsc#1485). Every event reaches `listener`
 * with an absolute path, and a watch the broker reports failed reaches
 * `onError`, which hands the scope's entries to the bounded poll.
 *
 * Registration completes asynchronously, and FSEvents can later drop events
 * (samchon/ttsc#1425). Until the broker confirms the watch, and whenever it
 * reports such a gap or an event it could not place, an event can have gone
 * unheard, so each is delivered as one unattributed event, which makes the
 * observer re-check every entry the scope covers against its recorded state. On
 * macOS the project scope's stream confirms only once its opening probe came
 * back through it, so the re-check on confirmation covers everything before
 * that moment (samchon/ttsc#1454).
 *
 * @param probeRoot The project root, when the scope is the project's: the
 *   broker may then prove the scope's stream delivered, through a probe below
 *   the project's tool cache (samchon/ttsc#1453). An external scope names
 *   none.
 */
export function openIsolatedRecursiveWatch(
  root: string,
  listener: (eventType: string, file: string | null) => void,
  onError: () => void,
  _admit?: (directory: string) => boolean,
  probeRoot?: string,
): { close(): void } {
  let closed = false;
  let failed = false;
  const recheck = (): void => {
    if (!closed && !failed) listener("rename", null);
  };
  const watch = openBrokeredWatch([{ directory: root, recursive: true }], {
    allEvents: true,
    // The scope never drains: its events are forwarded as they come, and a
    // drain's verdict on other registrations' proofs is not its business.
    drains: false,
    filesystem: DEFAULT_FILESYSTEM_OPERATIONS,
    ...(probeRoot === undefined ? {} : { probeRoot }),
    sink: {
      event: (directory, filename, eventType) => {
        if (!closed) {
          listener(
            eventType,
            filename === null ? null : path.join(directory, filename),
          );
        }
      },
      failed: () => {
        if (failed || closed) return;
        failed = true;
        onError();
      },
      gap: recheck,
      unattributed: recheck,
      unproven: () => undefined,
    },
  });
  void watch.ready.then(recheck);
  return {
    close: () => {
      closed = true;
      watch.close();
    },
  };
}
