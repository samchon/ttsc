import path from "node:path";

import { LINUX_DIRECTORY_WATCHES } from "./LINUX_DIRECTORY_WATCHES";
import type { LinuxDirectoryWatch } from "./LinuxDirectoryWatch";
import { getLinuxWatchHelper } from "./getLinuxWatchHelper";
import { referenceLinuxWatchHelper } from "./referenceLinuxWatchHelper";
import { sendLinuxWatchHelper } from "./sendLinuxWatchHelper";
import { syncLinuxWatchHelper } from "./syncLinuxWatchHelper";

/**
 * Subscribe to one directory's non-recursive watch, opening it only when no
 * other observer holds that resolved spelling. Last detach retires the shared
 * watch; native failure can retire it earlier and notify remaining observers.
 *
 * The watch lives in the Linux watch helper, not in `fs.watch`, whose inotify
 * reader discards the kernel's notice that events were dropped
 * (samchon/ttsc#1426). The helper reports that notice to every watch as an
 * event without a name. It answers asynchronously, so the watch hears nothing
 * until `ready` resolves `true`; a caller that must not miss an event waits for
 * it. `ready` resolves `false`, and `onError` runs, when the directory cannot
 * be watched, for instance once the per-user inotify limit is reached.
 *
 * Each subscriber admits protocol lines after its opening frontier
 * (samchon/ttsc#1486); this is not atomic timestamp classification of writes.
 * The subscriber that
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
 * Readiness is not a continuing liveness certificate: a later error or explicit
 * close retires coverage. Callbacks must return normally to complete fanout and
 * terminal clearing; this adapter does not isolate arbitrary callback throws.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A first subscriber waits for native opening; a joining subscriber waits for
 *   its own ordered sync before accepting later lines, preserving temporal scope.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One shared directory entry owns the native subscription; each observer owns
 *   wrappers and a closer. Last detach or native failure retires the shared
 *   entry; native transport cleanup remains helper-owned.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Joining cannot consume pre-subscription queued events as fresh mutations;
 *   failed synchronization reports unavailable coverage rather than guessed success.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain sharing, first and joining readiness, loss events
 *   and failure under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral owners receive names and lifecycle callbacks while helper protocol
 *   ordering remains native-owned; node:path resolves the subscription key.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Key resolution/hash work follows directory text. A cold helper lookup can
 *   resolve native binary/package state and spawn; opening serializes that path
 *   and acquires a native watch, while joins send distinct ordered sync requests.
 *   Dispatch/error fanout copies s callback references and invokes their work;
 *   it does not scan all graph files, but native/IPC cost is not constant.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Within the loaded directory registry, resolved spellings share one helper
 *   watch while every join validates its own protocol frontier. Native aliases
 *   can still occupy separate keys; readiness is not reusable proof of later
 *   liveness or filesystem equivalence.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Each closer removes its callback wrappers; last detach attempts native
 *   removal and retires the entry/id. Failure removes native ownership before
 *   error fanout, whose callback exceptions can interrupt subsequent clearing.
 *   Closing a joining subscriber does not cancel its already-started sync;
 *   that owner's reply/failure/deadline still ends its task. Directory keys,
 *   subscriber closures and simultaneous joins have no population/byte cap;
 *   failed native removal is not certified release by a local map deletion.
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
