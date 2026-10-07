import path from "node:path";
import {
  pluginSourceDigest,
  pluginSourceFilesSignature,
} from "ttsc/plugin-source";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { inputMetadataEvidence } from "./inputMetadataEvidence";

/**
 * Return the build's plugin-source digest, reusing it only when the complete
 * file population and metadata signature remain clock-separable and unchanged.
 *
 * The shared file selector includes relative names, so addition, deletion and
 * rename invalidate the signature. A fresh digest is kept only when signatures
 * taken around its byte read agree and all stamps are separable. Reuse checks
 * separability again against the caller's refreshed device clock references; a
 * historical reference cannot establish safety after a clock rollback.
 *
 * Source enumeration and byte reads use ttsc's native filesystem. Injected
 * metadata must describe that same source tree; this adapter does not make
 * arbitrary foreign filesystems interchangeable. The process-wide map has no
 * historical-directory eviction or owner partition and can grow with distinct
 * directory spellings.
 *
 * @param directory The source directory.
 * @param filesystem The operations whose clock reference the caller refreshed
 *   (`refreshFilesystemClockReference`), which decides separability.
 * @throws When a listed file cannot be read, as `pluginSourceDigest` does.
 * @evidence contracts/common.md#principled-implementation The build's exact file selector signs names and metadata around a fresh byte digest; matching separable signatures permit reuse only under the same native source-tree and refreshed-clock premises.
 * @evidence contracts/common.md#clear-and-simple-design This coordinator owns the directory digest entry while ttsc owns selection and byte hashing and inputMetadataEvidence owns stamp interpretation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A quiet tracker or equal timestamps alone cannot certify reuse; changed or unavailable evidence requires the real source digest rather than expected output or a compensating cache exception.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain population invalidation, before/after proof, fresh clock ordering, native-view assumptions and unbounded retained entries, with separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral native source paths use Node resolution and ttsc's native selector; injected metadata must observe those paths. A different filesystem view or path dialect is not supported by the native enumeration/read calls here.
 * @evidence contracts/performance.md#efficient-algorithms Reuse still enumerates and stats F files; a miss performs two metadata walks and one O(B) byte digest. Selection sorts its population, and temporary storage follows the file list and largest file buffer.
 * @evidence contracts/performance.md#reuse-equivalent-work All calls share DIGESTS by resolved directory spelling; current separable metadata must match the signature recorded around the producer read. The key does not partition filesystem owners, so sharing assumes one native source view.
 * @evidence contracts/performance.md#bound-retention-and-release-resources DIGESTS is module-owned and retains one digest/signature per encountered key until failed stabilization deletes that key or the process ends; no historical-directory bound or explicit teardown currently exists.
 */
export function pluginSourceFilesDigest(
  directory: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string {
  const key = path.resolve(directory);
  /**
   * Supply this caller's metadata and clock view to the shared native selector.
   * The filesystem must observe the same source tree the selector enumerates.
   */
  const evidence = (file: string) => inputMetadataEvidence(file, filesystem);
  const before = pluginSourceFilesSignature(key, evidence);
  const known = DIGESTS.get(key);
  if (
    before !== undefined &&
    before.separable &&
    known?.signature === before.signature
  ) {
    return known.digest;
  }
  const digest = pluginSourceDigest(key);
  const after = pluginSourceFilesSignature(key, evidence);
  if (
    before !== undefined &&
    after !== undefined &&
    after.signature === before.signature &&
    after.separable
  ) {
    DIGESTS.set(key, { digest, signature: after.signature });
  } else {
    DIGESTS.delete(key);
  }
  return digest;
}

/**
 * The digests kept, by directory, each with the signature of the metadata it
 * was read under.
 */
const DIGESTS = new Map<string, { digest: string; signature: string }>();
