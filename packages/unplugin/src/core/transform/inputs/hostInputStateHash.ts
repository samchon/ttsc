import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { hashText } from "../utils/hashText";

/**
 * Hash host-input raw bytes. If reading fails, an observed directory receives
 * the shared directory marker and any other state returns null. Unlike graph
 * reads, successful host bytes retain their BOM and original encoding.
 *
 * @evidence contracts/common.md#principled-implementation Byte hashing preserves the host-input contract independently of compiler text normalization, with following stat used only to classify a failed read.
 * @evidence contracts/common.md#clear-and-simple-design The read-first path and directory fallback produce one optional fingerprint without mixing graph decoding into host state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual bytes determine successful hashes; the directory marker is a contract-defined kind value and unreadable files do not gain guessed contents.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes raw bytes, graph normalization and null fallback, with a blank tag separator following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral content comes from the supplied read capability with no line-ending or byte-order rewrite; following stat determines native directory fallback.
 * @evidence contracts/performance.md#efficient-algorithms Successful reads require one O(B) byte hash and no stat; only failed reads request metadata, retaining a call-local Buffer proportional to file size.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each invocation observes current bytes; generation owners establish when a saved host hash can replace this read.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No cache, open descriptor or asynchronous task is retained by this synchronous fingerprint helper.
 */
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
