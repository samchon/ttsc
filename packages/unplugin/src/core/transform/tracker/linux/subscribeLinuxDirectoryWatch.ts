import path from "node:path";

import { LINUX_DIRECTORY_WATCHES } from "./LINUX_DIRECTORY_WATCHES";
import type { LinuxDirectoryWatch } from "./LinuxDirectoryWatch";
import { getLinuxWatchHelper } from "./getLinuxWatchHelper";
import { referenceLinuxWatchHelper } from "./referenceLinuxWatchHelper";
import { sendLinuxWatchHelper } from "./sendLinuxWatchHelper";

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
  subscribed.listeners.add(listener);
  subscribed.errors.add(onError);
  let released = false;
  return {
    close: () => {
      if (released) return;
      released = true;
      subscribed.listeners.delete(listener);
      subscribed.errors.delete(onError);
      if (subscribed.listeners.size === 0) subscribed.close();
    },
    ready: subscribed.ready,
  };
}
