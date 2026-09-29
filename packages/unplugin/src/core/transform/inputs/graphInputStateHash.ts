import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { hashText } from "../utils/hashText";
import { compilerStatKind } from "./compilerStatKind";
import { graphInputReadHash } from "./graphInputReadHash";

/**
 * Fingerprint compiler-normalized text, or the directory-kind sentinel when
 * text cannot be read from a directory. Other failed reads return null. A
 * directory hash records kind rather than a recursive listing of its contents.
 *
 * @evidence contracts/common.md#principled-implementation The compiler read hash is preferred, and only an observed directory receives the shared directory marker; other unreadable kinds preserve null.
 * @evidence contracts/common.md#clear-and-simple-design This combines the separate kind and text observers while keeping byte normalization with graphInputReadHash.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The sentinel is the declared directory state encoding, not a fabricated file hash or an assertion that directory membership stayed unchanged.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes content, directory kind and failed reads, using a separated acknowledgment block under documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral stat and read observations share the supplied filesystem; directory status comes from native capability rather than separators or extensions.
 * @evidence contracts/performance.md#efficient-algorithms One stat is passed into the text reader rather than repeated; hashing costs O(B) bytes and directory fallback does no enumeration.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The operation returns a fresh state fingerprint; saved fingerprint equivalence is governed by generation proof owners.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the returned digest escapes; temporary buffers and hash state are owned by the read operation and no historical state is kept here.
 */
export function graphInputStateHash(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | null {
  const kind = compilerStatKind(file, filesystem);
  const readHash = graphInputReadHash(file, filesystem, kind);
  if (readHash !== null) return readHash;
  return kind === "directory" ? hashText("ttsc:host-input:directory\0") : null;
}
