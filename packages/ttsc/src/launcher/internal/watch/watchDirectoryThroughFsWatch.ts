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
 * @param openWatch Owned native-compatible subscription operation; fs.watch by default.
 *
 * @returns The open watch.
 *
 * @evidence contracts/common.md#principled-implementation The native event and optional filename are normalized to the common watch contract; an absent name explicitly marks an observation gap.
 * @evidence contracts/common.md#clear-and-simple-design One supported fs.watch subscription maps its event callback without another scheduling or polling layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown native events become the declared rename category, without invented filenames or patched fs methods. An explicitly supplied observer is invoked through this parameter rather than installed into the global filesystem.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs and parameters explain backend role, recursion and returned watch ownership following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Node owns native recursive-watch support and filename representation; this adapter preserves null names and converts present names through their native string boundary.
 *
 * @evidence contracts/performance.md#efficient-algorithms Subscription setup is delegated to the supplied native-compatible observer. Each callback selects one event category and converts present filename text through toString before invoking the listener; name-byte conversion and listener/native observer costs are not bounded by the fixed scalar mapping.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each requested subscription has its own listener and lifetime; registry sharing belongs to the selecting owner.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources The native default acquires one persistent FSWatcher; a supplied observer owns its corresponding subscription. The returned owner must close it on retirement, failure or shutdown. This adapter performs no close or release confirmation itself.
 */
export function watchDirectoryThroughFsWatch(
  location: string,
  recursive: boolean,
  listener: (
    event: "change" | "rename",
    filename: string | null,
    gap?: boolean,
  ) => void,
  openWatch: typeof fs.watch = fs.watch,
): DirectoryWatcher {
  return openWatch(location, { persistent: true, recursive }, (event, name) => {
    listener(
      event === "change" ? "change" : "rename",
      name === null ? null : name.toString(),
      name === null,
    );
  });
}
