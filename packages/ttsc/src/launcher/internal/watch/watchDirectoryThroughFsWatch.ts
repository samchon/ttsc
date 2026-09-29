import fs from "node:fs";

import type { DirectoryWatcher } from "./DirectoryWatcher";

/**
 * Watch a directory through `fs.watch`, with the signature of `watchDirectory`:
 * `change` for an entry whose content moved, `rename` for every other event,
 * and a `null` name with a gap flag when anything below may have changed.
 *
 * This is the backend of every platform but macOS with the `fsevents` binding,
 * and the one a caller chooses to observe the watch set through `fs.watch`.
 *
 * @param location The directory, spelled as the filesystem names it.
 * @param recursive Whether entries below subdirectories are heard.
 * @param listener Receives each event.
 *
 * @returns The open watch.
 *
 * @evidence contracts/common.md#principled-implementation The native event and optional filename are normalized to the common watch contract; an absent name explicitly marks an observation gap.
 * @evidence contracts/common.md#clear-and-simple-design One supported fs.watch subscription maps its event callback without another scheduling or polling layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown native events become the declared rename category, without invented filenames or patched fs methods.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs and parameters explain backend role, recursion and returned watch ownership following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Node owns native recursive-watch support and filename representation; this adapter preserves null names and converts present names through their native string boundary.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The native backend owns observation processing; this adapter only maps one event.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each requested subscription has its own listener and lifetime; registry sharing belongs to the selecting owner.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources One persistent FSWatcher is acquired and returned to the owner, which must close it on retirement, failure or shutdown.
 */
export function watchDirectoryThroughFsWatch(
  location: string,
  recursive: boolean,
  listener: (
    event: "change" | "rename",
    filename: string | null,
    gap?: boolean,
  ) => void,
): DirectoryWatcher {
  return fs.watch(location, { persistent: true, recursive }, (event, name) => {
    listener(
      event === "change" ? "change" : "rename",
      name === null ? null : name.toString(),
      name === null,
    );
  });
}
