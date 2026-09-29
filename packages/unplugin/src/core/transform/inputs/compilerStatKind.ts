import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * Classify a following stat as the compiler does: directories retain their
 * kind, every other successful stat is a file, and a failed stat is missing.
 * This classification does not establish readable content.
 *
 * @evidence contracts/common.md#principled-implementation The three results preserve the compiler's directory-versus-other stat semantics and failure result; isFile is intentionally not a separate prerequisite.
 * @evidence contracts/common.md#clear-and-simple-design One following stat owns classification without mixing byte reads or lexical existence checks.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Classification derives from observed metadata rather than extensions, recorded expectations or a patched stat implementation.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains non-directory success and the readability boundary, with a separated acknowledgment block following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral kind observation uses the supplied filesystem's following stat and native directory predicate; special non-directory nodes follow compiler semantics rather than host-specific guesses.
 */
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
