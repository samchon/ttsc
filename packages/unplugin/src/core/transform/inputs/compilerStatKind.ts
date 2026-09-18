import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/** Current result of TypeScript-Go's Stat predicate. */
export function compilerStatKind(
  file: string,
  filesystem: TtscTransformFilesystemOperations,
): "directory" | "file" | "missing" {
  try {
    return filesystem.stat(file).isDirectory() ? "directory" : "file";
  } catch {
    return "missing";
  }
}
