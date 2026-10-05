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
 * its own `watch` retains that capability, including for a host-filesystem
 * view.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A supplied filesystem watcher is authoritative; only the native host
 *   implementation chooses isolated Windows or macOS notification ownership.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One capability guard and two platform names select the backend; opening
 *   watches and managing child lifetime remain separate responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Isolation addresses native failure and stream continuity at their owner;
 *   it does not replace a supplied watcher or patch host internals.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs state the backend selection and its distinct platform
 *   reasons, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral callers delegate explicit native backend selection here.
 *   Platform checks concern watcher capability, not path equality or casing.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Constant-time comparisons.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure predicate over the filesystem view and the platform.
 */
export function usesWatchBroker(
  filesystem: TtscTransformFilesystemOperations,
): boolean {
  return (
    filesystem.watch === undefined &&
    (filesystem.platform === undefined ||
      filesystem.platform === process.platform) &&
    (process.platform === "win32" || process.platform === "darwin")
  );
}
