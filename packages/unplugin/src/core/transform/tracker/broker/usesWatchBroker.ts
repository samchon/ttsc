import type { TtscTransformFilesystemOperations } from "../../filesystem/TtscTransformFilesystemOperations";

/**
 * Whether a tracker over `filesystem` opens its watches in the isolated watch
 * broker rather than in this process.
 *
 * The host filesystem on Windows and macOS does: Windows so that a native
 * fs-event abort cannot take the host down, and macOS so that each watch is its
 * own FSEventStream, whose dropped events are reported, rather than one libuv
 * re-creates whenever any watch in the host opens or closes, and whose drops it
 * discards (samchon/ttsc#1418, samchon/ttsc#1425). An embedder that supplies
 * its own `watch` observes another filesystem, and keeps it.
 */
export function usesWatchBroker(
  filesystem: TtscTransformFilesystemOperations,
): boolean {
  return (
    filesystem.watch === undefined &&
    (process.platform === "win32" || process.platform === "darwin")
  );
}
