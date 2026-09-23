import path from "node:path";

import { LINUX_DIRECTORY_WATCHES } from "./LINUX_DIRECTORY_WATCHES";
import type { LinuxDirectoryWatch } from "./LinuxDirectoryWatch";
import { getLinuxWatchHelper } from "./getLinuxWatchHelper";
import { referenceLinuxWatchHelper } from "./referenceLinuxWatchHelper";
import { sendLinuxWatchHelper } from "./sendLinuxWatchHelper";
import { syncLinuxWatchHelper } from "./syncLinuxWatchHelper";

/**
 * Subscribe to one directory's non-recursive watch, opening it only when no
 * other observer holds it and closing it when the last one leaves.
 *
 * The watch lives in the Linux watch helper, not in `fs.watch`, whose inotify
 * reader discards the kernel's notice that events were dropped
 * (samchon/ttsc#1426). The helper reports that notice to every watch as an
 * event without a name. It answers asynchronously, so the watch hears nothing
 * until `ready` resolves `true`; a caller that must not miss an event waits for
 * it. `ready` resolves `false`, and `onError` runs, when the directory cannot
 * be watched, for instance once the per-user inotify limit is reached.
 *
 * A subscriber hears exactly what a watch of its own would, the events of
 * writes made after it subscribed (samchon/ttsc#1486). The subscriber that
 * opens the watch hears it from the helper's answer on, and the helper writes
 * no event of a watch before that answer. One that joins a watch another
 * subscriber opened would otherwise be handed every line the helper had already
 * written and Node had not yet read, the tail of writes made before it existed:
 * a tracker opened right after an edit heard the rest of that edit as a change
 * during its compile, and compiled the project again. So a joining subscriber
 * hears nothing until the helper answers a sync sent when it joined, which the
 * helper writes only after every event queued before the request, and hears
 * every line after it. Its `ready` resolves at that answer, and a sync the
 * helper does not answer leaves it not live, reported through `onError`, since
 * it cannot know what it missed.
 *
 * Throws when there is no helper to serve the watch, which the caller treats as
 * a failed tracker, falling back to snapshot validation.
 */
export function subscribeLinuxDirectoryWatch(
  directory: string,
  listener: (eventType: string, filename: string | null) => void,
  onError: () => void,
): { close(): void; ready: Promise<boolean> } {
  const key = path.resolve(directory);
  let shared = LINUX_DIRECTORY_WATCHES.get(key);
  const opening = shared === undefined;
  if (shared === undefined) {
    const helper = getLinuxWatchHelper();
    if (helper === undefined) {
      throw new Error(`no Linux watch helper can watch ${key}`);
    }
    const listeners: LinuxDirectoryWatch["listeners"] = new Set();
    const errors: LinuxDirectoryWatch["errors"] = new Set();
    const id = helper.nextId++;
    let answer!: (live: boolean) => void;
    const ready = new Promise<boolean>((resolve) => {
      answer = resolve;
    });
    let answered = false;
    let ended = false;
    const opened: LinuxDirectoryWatch = {
      close: () => {
        if (LINUX_DIRECTORY_WATCHES.get(key) === opened) {
          LINUX_DIRECTORY_WATCHES.delete(key);
        }
        if (helper.subscriptions.delete(id)) {
          if (!answered) referenceLinuxWatchHelper(helper, -1);
          sendLinuxWatchHelper(helper, { id, op: "remove" });
        }
        if (!answered) {
          answered = true;
          answer(false);
        }
      },
      errors,
      helper,
      listeners,
      ready,
    };
    // The directory was removed, could not be watched, or lost its helper;
    // every subscriber hears it once and the shared watch is gone.
    const end = (): void => {
      if (ended) return;
      ended = true;
      opened.close();
      for (const fail of [...errors]) fail();
      listeners.clear();
      errors.clear();
    };
    helper.subscriptions.set(id, {
      end,
      event: (eventType, filename) => {
        for (const notify of [...listeners]) notify(eventType, filename);
      },
      ready: (live) => {
        if (answered) return;
        answered = true;
        answer(live);
        if (!live) end();
      },
    });
    LINUX_DIRECTORY_WATCHES.set(key, opened);
    referenceLinuxWatchHelper(helper, 1);
    if (!sendLinuxWatchHelper(helper, { id, op: "add", path: key })) {
      helper.subscriptions.delete(id);
      referenceLinuxWatchHelper(helper, -1);
      LINUX_DIRECTORY_WATCHES.delete(key);
      throw new Error(`the Linux watch helper cannot watch ${key}`);
    }
    shared = opened;
  }
  const subscribed = shared;
  // Whether this subscriber hears the watch yet: its opener at once, a joiner
  // from the answer to its sync on, switched synchronously with the answer's
  // line so the very next line reaches it.
  let hearing = opening;
  const heard = (eventType: string, filename: string | null): void => {
    if (hearing) listener(eventType, filename);
  };
  // This subscription's own entry in the watch's error set, whatever function
  // the caller passed.
  const ended = (): void => onError();
  subscribed.listeners.add(heard);
  subscribed.errors.add(ended);
  let released = false;
  const close = (): void => {
    if (released) return;
    released = true;
    subscribed.listeners.delete(heard);
    subscribed.errors.delete(ended);
    if (subscribed.listeners.size === 0) subscribed.close();
  };
  const ready = opening
    ? subscribed.ready
    : syncLinuxWatchHelper(subscribed.helper, (answered) => {
        if (answered) hearing = true;
      }).then((answered) => {
        if (answered) return subscribed.ready;
        // Still subscribed, so the watch itself did not end: this subscriber
        // alone cannot vouch for what it covers.
        if (subscribed.errors.has(ended)) {
          close();
          onError();
        }
        return false;
      });
  return { close, ready };
}
