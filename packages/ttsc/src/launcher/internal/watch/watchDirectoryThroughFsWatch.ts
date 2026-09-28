import fs from "node:fs";

import type { DirectoryWatcher } from "./DirectoryWatcher";

/**
 * Watch a directory through `fs.watch`, with the signature of
 * `watchDirectory`: `change` for an entry whose content moved, `rename` for
 * every other event, and a `null` name when anything below may have changed.
 *
 * This is the backend of every platform but macOS with the `fsevents` binding,
 * and the one a caller chooses to observe the watch set through `fs.watch`.
 *
 * @param location The directory, spelled as the filesystem names it.
 * @param recursive Whether entries below subdirectories are heard.
 * @param listener Receives each event.
 * @returns The open watch.
 */
export function watchDirectoryThroughFsWatch(
  location: string,
  recursive: boolean,
  listener: (event: "change" | "rename", filename: string | null) => void,
): DirectoryWatcher {
  return fs.watch(location, { persistent: true, recursive }, (event, name) => {
    listener(
      event === "change" ? "change" : "rename",
      name === null ? null : name.toString(),
    );
  });
}
