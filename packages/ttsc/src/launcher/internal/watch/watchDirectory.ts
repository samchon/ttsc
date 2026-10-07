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
 * @evidence contracts/common.md#principled-implementation Backend selection preserves relative names and observation-gap notifications through one shared subscription contract.
 * @evidence contracts/common.md#clear-and-simple-design The dispatcher chooses the process registry or the fs.watch adapter without duplicating event interpretation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fallback serves an unavailable optional production binding and emits its warning; no foreign watcher method is monkeypatched.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs and parameters explain backend choice, relative names, gaps and returned ownership following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation macOS's optional FSEvents binding is isolated explicitly; all other native subscriptions use Node's supported fs.watch API.
 *
 * @evidence contracts/performance.md#efficient-algorithms Cached availability selects one backend. Registration delegates path resolution, native subscription setup and, for FSEvents, ancestor lookup/descendant subscription transfers; event work remains with the selected backend. Delegated path/depth/watch populations are not bounded by this one-watch result.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work The optional binding is loaded once per process; eligible macOS subscriptions share the registry's ancestor streams rather than constructing independent registries.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Returned subscriptions transfer close responsibility to their caller; the process registry retains binding availability and active stream/watch indexes. Closing the last stream subscriber removes logical ownership and attempts native stop; FSEvents stop errors are swallowed, so physical release is not confirmed on failure.
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
