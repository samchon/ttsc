import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { hashText } from "../utils/hashText";
import { compilerStatKind } from "./compilerStatKind";

/** Hash only a successful compiler-style ReadFile result, without kind fallback. */
export function graphInputReadHash(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  observedKind?: "directory" | "file" | "missing",
): string | null {
  const kind = observedKind ?? compilerStatKind(file, filesystem);
  try {
    if (kind === "directory") return null;
    const bytes = filesystem.readFile(file);
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      const even = bytes.subarray(
        2,
        2 + Math.floor((bytes.length - 2) / 2) * 2,
      );
      return hashText(Buffer.from(even.toString("utf16le"), "utf8"));
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      const even = Buffer.from(
        bytes.subarray(2, 2 + Math.floor((bytes.length - 2) / 2) * 2),
      );
      even.swap16();
      return hashText(Buffer.from(even.toString("utf16le"), "utf8"));
    }
    const content =
      bytes.length >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf
        ? bytes.subarray(3)
        : bytes;
    return hashText(content);
  } catch {
    return null;
  }
}
