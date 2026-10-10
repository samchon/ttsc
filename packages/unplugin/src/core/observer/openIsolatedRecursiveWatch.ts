import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { openBrokeredWatch } from "../transform/tracker/broker/openBrokeredWatch";

/**
 * Open one recursive observer inside the transform core's isolated watch broker
 * instead of the host process.
 *
 * On Windows, ttsc's direct native helper excludes access-only notifications
 * and reports actual mutation, loss and failure through the same broker sink.
 * On macOS, libuv serves every directory watch of a loop through one
 * FSEventStream and re-creates it whenever any watch opens or closes, losing
 * the events in between (samchon/ttsc#1418), where the broker opens one stream
 * per watch. The observer's scopes get the isolation the transform core's
 * trackers have, through the same registration (`openBrokeredWatch`) with a
 * sink of their own that forwards events (samchon/ttsc#1485). Attributed events
 * reach `listener` with a joined caller-directory path; unattributed events use
 * null. A failed registration reaches `onError`, which hands the scope's
 * entries to the bounded poll.
 *
 * Registration completes asynchronously, and FSEvents can later drop events
 * (samchon/ttsc#1425). Until the broker confirms the watch, and whenever it
 * reports such a gap or an event it could not place, an event can have gone
 * unheard, so each is delivered as one unattributed event, which makes the
 * observer re-check every entry the scope covers against its recorded state. On
 * macOS a probe-capable project stream's child withholds ordinary callbacks
 * until its opening probe returns (samchon/ttsc#1454). Ready promise completion
 * only ends a wait; this wrapper rechecks unless closed or already failed,
 * rather than certifying every earlier native mutation was observed.
 *
 * @param probeRoot The project root, when the scope is the project's: the
 *   broker may then prove the scope's stream delivered, through a probe below
 *   the project's tool cache (samchon/ttsc#1453). An external scope names
 *   none.
 * @evidence contracts/common.md#principled-implementation Broker isolation contains native watcher failures; opening confirmation and gaps trigger rechecks rather than authorizing unchanged inputs silently.
 * @evidence contracts/common.md#clear-and-simple-design One registration forwards events and failures while the input observer owns conditions, polling, and consumer actions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The owned broker protocol does not patch native methods, and dropped events cannot become freshness proof.
 * @evidence contracts/common.md#meaningful-documentation The prose explains isolation, asynchronous readiness, gaps, and project-only probe ownership.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral observation routes Windows and macOS native capability differences through the shared broker; native path joining reconstructs event paths, while failure and gaps require rechecks.
 * @evidence contracts/performance.md#efficient-algorithms One location still delegates native normalization, optional probe namespace lookup/sweep, IPC encoding and cold child/backend setup. Each named callback joins path text and invokes the listener; condition batching and native/content revalidation cost remain with the observer, not bounded by one transport event.
 * @evidence contracts/performance.md#reuse-equivalent-work Existing broker infrastructure is shared across scopes, while this registration retains its own event sink and observation authority.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One registration retains listener/error closures and a ready reaction. Close marks the wrapper inactive before attempting delegated cleanup, which can throw without proving child exit. Failure calls onError once but does not itself close; the owner must retire it. Late ready cannot reactivate closed/failed rechecks. Setup exceptions can occur before a handle is returned; rollback/deadline ownership remains with the broker operation.
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
