import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscProjectMutationTracker } from "../transform/tracker/TtscProjectMutationTracker";
import { registerBrokeredMutationTracker } from "../transform/tracker/broker/registerBrokeredMutationTracker";

/**
 * Open one recursive observer inside the transform core's isolated watch broker
 * instead of the dev server process.
 *
 * On Windows, Node's fs-event backend can abort the process that owns a watch,
 * for instance with `Assertion failed: !_wcsnicmp(filename, dir, dirlen)` in
 * `src\win\fs-event.c` (samchon/ttsc#1411). On macOS, libuv serves every
 * directory watch of a loop through one FSEventStream and re-creates it
 * whenever any watch opens or closes, losing the events in between
 * (samchon/ttsc#1418), where the broker opens one stream per watch. The
 * transform core already runs those platforms' watches in a child process; this
 * gives the Vite serve watcher the same isolation. Every event reaches
 * `listener` with an absolute path, and a watch the broker reports failed
 * reaches `onError`, which hands the scope's entries to the bounded poll.
 *
 * Registration completes asynchronously, and FSEvents can later drop events
 * (samchon/ttsc#1425). Until the broker confirms the watch, and whenever it
 * reports such a gap, an event can have gone unheard, so each is delivered as
 * one unattributed event, which makes the watcher re-check every entry the
 * scope covers against its recorded state.
 */
export function openIsolatedRecursiveWatch(
  root: string,
  listener: (eventType: string, file: string | null) => void,
  onError: () => void,
): { close(): void } {
  let closed = false;
  let failed = false;
  // A tracker-shaped handle whose only role is to carry the broker's
  // registration; the classifier forwards every event and records nothing.
  const handle = {
    changes: new Set<string>(),
    changesOmitted: false,
    close: () => undefined,
    get failed(): boolean {
      return failed;
    },
    set failed(value: boolean) {
      if (value && !failed && !closed) {
        failed = true;
        onError();
      }
    },
    membershipChanged: false,
  } as TtscProjectMutationTracker;
  const recheck = (): void => {
    if (!closed && !failed) listener("rename", null);
  };
  void registerBrokeredMutationTracker(
    handle,
    [{ directory: root, recursive: true }],
    true,
    DEFAULT_FILESYSTEM_OPERATIONS,
    undefined,
    undefined,
    undefined,
    (location, filename, eventType) => {
      if (!closed) {
        listener(
          eventType,
          filename === null ? null : path.join(location, filename),
        );
      }
      return undefined;
    },
    recheck,
  ).then(recheck, () => {
    handle.failed = true;
  });
  return {
    close: () => {
      closed = true;
      handle.close();
    },
  };
}
