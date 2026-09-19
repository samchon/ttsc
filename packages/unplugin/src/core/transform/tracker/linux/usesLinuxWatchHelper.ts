import type { TtscTransformFilesystemOperations } from "../../filesystem/TtscTransformFilesystemOperations";

/**
 * Whether a tracker over `filesystem` opens its watches in the Linux watch
 * helper rather than through `fs.watch` (samchon/ttsc#1426).
 *
 * The host filesystem on every platform but Windows and macOS does, since those
 * two watch in the isolated broker instead. An embedder that supplies its own
 * `watch` observes another filesystem, and keeps it.
 */
export function usesLinuxWatchHelper(
  filesystem: TtscTransformFilesystemOperations,
): boolean {
  return (
    filesystem.watch === undefined &&
    process.platform !== "win32" &&
    process.platform !== "darwin"
  );
}
