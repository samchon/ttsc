import type { DirectoryWatcher } from "./DirectoryWatcher";
import { FseventsStreams } from "./FseventsStreams";
import { watchDirectoryThroughFsWatch } from "./watchDirectoryThroughFsWatch";

/**
 * Watch a directory's entries, or everything below it when `recursive`.
 *
 * On macOS, the `fsevents` binding keeps directory streams independent of
 * libuv's process-wide `fs.watch` stream. A dropped-events notice reaches each
 * affected watch with a `null` filename, so its owner re-reads its inputs.
 * Other platforms use `fs.watch`; macOS does too, with one warning, when the
 * optional binding cannot be loaded.
 *
 * @param location The directory, spelled as the filesystem names it.
 * @param recursive Whether entries below subdirectories are heard.
 * @param listener Receives `change` or `rename` and a relative entry name, or
 *   `null` when anything below the directory may have changed. The final flag
 *   marks an observation gap that needs a content recheck.
 * @returns The open watch.
 */
export function watchDirectory(
  location: string,
  recursive: boolean,
  listener: (
    event: "change" | "rename",
    filename: string | null,
    gap?: boolean,
  ) => void,
): DirectoryWatcher {
  const streams = fseventsStreams();
  if (streams !== undefined) return streams.open(location, recursive, listener);
  return watchDirectoryThroughFsWatch(location, recursive, listener);
}

let registry: FseventsStreams | null | undefined;

/** The shared streams, or `undefined` where watches go through `fs.watch`. */
function fseventsStreams(): FseventsStreams | undefined {
  if (registry === undefined) {
    registry = process.platform === "darwin" ? FseventsStreams.load() : null;
  }
  return registry ?? undefined;
}
