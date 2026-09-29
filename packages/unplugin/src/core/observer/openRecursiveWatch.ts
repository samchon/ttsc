import fs from "node:fs";

import { openLinuxDirectoryObserver } from "../transform/tracker/linux/openLinuxDirectoryObserver";

/**
 * Open the in-process recursive observer for one input observer scope, on a
 * platform whose scopes are not brokered: Windows and macOS open theirs in the
 * isolated watch broker instead (`openIsolatedRecursiveWatch`).
 *
 * Non-persistent, so it never keeps a host process alive by itself. Errors are
 * reported to `onError`, which moves the scope's entries to the bounded
 * fallback poll instead of losing them.
 *
 * Where Node has no native recursive notification, its `recursive` option walks
 * the whole tree and watches every file, `node_modules` included. There the
 * scope opens the directory-level observer instead, which watches only the
 * directories `admit` accepts and those its handle's `track` names
 * (samchon/ttsc#1389). Its watches live in the Linux watch helper and go live
 * asynchronously (samchon/ttsc#1426), so once they are, the scope re-checks
 * every entry it covers, as an unattributed event makes it do: an entry could
 * have changed before any watch heard it.
 *
 * @evidence contracts/common.md#principled-implementation Linux directory-level observation watches admitted paths and triggers readiness rechecks; native recursive failures enter the same conservative fallback boundary.
 * @evidence contracts/common.md#clear-and-simple-design Platform capability selects an existing backend, returning closure and optional tracking only.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Readiness triggers actual recorded-state checks, without assuming handle construction proves earlier unchanged inputs.
 * @evidence contracts/common.md#meaningful-documentation The prose explains recursive emulation cost and why asynchronous startup requires an unattributed event.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral watch selection respects backend capability: admitted directory watches on Linux and native recursive watches where supported, with errors relinquishing observation authority.
 * @evidence contracts/performance.md#efficient-algorithms Directory-level observation avoids Node's file-per-watch recursive emulation and traverses only directories the admission policy requires.
 * @evidence contracts/performance.md#reuse-equivalent-work The shared Linux watch helper owns backend subscriptions, while scope callbacks keep their own coverage and proof conditions.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The nonpersistent backend returns an owned close handle; the observer closes failed, unused external, and disposed scopes.
 */
export function openRecursiveWatch(
  root: string,
  listener: (eventType: string, file: string | null) => void,
  onError: () => void,
  admit: (directory: string) => boolean = () => true,
): {
  close(): void;
  track?(file: string, subtree?: boolean): void;
  prune?(): void;
} {
  if (process.platform !== "darwin" && process.platform !== "win32") {
    const observer = openLinuxDirectoryObserver(root, admit, listener, onError);
    void observer.ready.then((live) => {
      if (live) listener("rename", null);
    });
    return observer;
  }
  const watcher = fs.watch(
    root,
    { persistent: false, recursive: true },
    (eventType, file) =>
      listener(eventType, file === null ? null : String(file)),
  );
  watcher.on("error", onError);
  return { close: () => watcher.close() };
}
