import { RuntimeFilesystem } from "../../../launcher/internal/runtime/RuntimeFilesystem";

/**
 * Read the bytes of a file already classified as regular by the SDK hasher.
 * Reject a POSIX file that became nonregular between classification and open.
 *
 * @evidence contracts/common.md#principled-implementation The shared nonblocking read checks the opened POSIX descriptor and returns bytes only for regular files. Windows uses its existing read after classification.
 * @evidence contracts/common.md#clear-and-simple-design Both Go fingerprint entry points share one default reader, with explicit readers remaining injectable.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A nonregular replacement fails the read instead of fabricating file bytes or waiting for a writer.
 * @evidence contracts/common.md#meaningful-documentation The prose states the caller's prior-classification responsibility and the behavior on replacement.
 * @evidence contracts/portability.md#os-neutral-implementation Native descriptors qualify POSIX reads. The shared reader owns Windows behavior.
 * @evidence contracts/performance.md#efficient-algorithms The reader performs one native read with POSIX descriptor classification. Time and temporary memory depend on the bytes read.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each operation reads current file bytes.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The shared reader closes any descriptor before returning. The caller owns the returned bytes.
 */
export function readSourceBuildFile(location: string | Buffer): Buffer {
  const bytes = RuntimeFilesystem.readObservedRegularFile(location);
  if (bytes === undefined)
    throw new Error(
      `ttsc: Go SDK input is no longer a regular file: ${location}`,
    );
  return bytes;
}
