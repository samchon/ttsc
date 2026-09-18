import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { hashText } from "../utils/hashText";

/** Content/kind fingerprint matching the compiler host-input contract. */
export function hostInputStateHash(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | null {
  try {
    return hashText(filesystem.readFile(file));
  } catch {
    try {
      return filesystem.stat(file).isDirectory()
        ? hashText("ttsc:host-input:directory\0")
        : null;
    } catch {
      return null;
    }
  }
}
