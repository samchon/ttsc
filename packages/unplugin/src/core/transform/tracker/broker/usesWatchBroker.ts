import type { TtscTransformFilesystemOperations } from "../../filesystem/TtscTransformFilesystemOperations";

/**
 * Whether a tracker over `filesystem` opens its watches in the isolated watch
 * broker rather than in this process.
 *
 * The host filesystem on Windows and macOS does: Windows so that a native
 * fs-event abort cannot take the host down, and macOS so that no watch opened
 * or closed elsewhere in the host can re-create the FSEventStream the adapter's
 * watches share (samchon/ttsc#1418). An embedder that supplies its own `watch`
 * observes another filesystem, and keeps it.
 */
export function usesWatchBroker(
  filesystem: TtscTransformFilesystemOperations,
): boolean {
  return (
    filesystem.watch === undefined &&
    (process.platform === "win32" || process.platform === "darwin")
  );
}
