import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { hashText } from "../utils/hashText";
import { compilerStatKind } from "./compilerStatKind";
import { graphInputReadHash } from "./graphInputReadHash";

/** Fingerprint the text/kind state returned by TypeScript-Go's filesystem. */
export function graphInputStateHash(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | null {
  const kind = compilerStatKind(file, filesystem);
  const readHash = graphInputReadHash(file, filesystem, kind);
  if (readHash !== null) return readHash;
  return kind === "directory" ? hashText("ttsc:host-input:directory\0") : null;
}
