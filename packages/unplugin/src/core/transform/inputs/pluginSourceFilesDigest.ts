import type fs from "node:fs";
import path from "node:path";
import {
  type IPluginSourceListing,
  pluginSourceFilesSignature,
  provenPluginSourceDigest,
} from "ttsc/plugin-source";

import { filesystemClockReferences } from "../clock/filesystemClockReferences";
import { filesystemListingDevices } from "../clock/filesystemListingDevices";
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
 * The population's listing is kept with the digest, so a later proof states the
 * listed directories' stamps instead of enumerating them, on a device where
 * this view saw directory stamps move with an entry change
 * (`filesystemListingDevices`). A directory whose stamps moved, or that cannot
 * be stated, sends the proof back to the walk.
 *
 * Source enumeration and byte reads use ttsc's native filesystem. Injected
 * metadata must describe that same source tree; this adapter does not make
 * arbitrary foreign filesystems interchangeable. The process-wide map has no
 * historical-directory eviction or owner partition and can grow with distinct
 * directory spellings.
 *
 * @param directory The source directory. WARNING (samchon/ttsc#1725): the map
 *   below ends with the process, and every bundler worker or restart is a new
 *   one, so each first proof read every plugin source byte again (0.35 s for
 *   typia's Go module). A caller that names its project takes a miss's digest
 *   from that project's plugin cache records, which the load that reported the
 *   state wrote.
 * @param filesystem The operations whose clock reference the caller refreshed
 *   (`refreshFilesystemClockReference`), which decides separability.
 * @param projectRoot Project whose plugin cache root holds the records.
 * @throws When a listed file cannot be read, as `pluginSourceDigest` does.
 * @evidence contracts/common.md#principled-implementation The build's exact file selector signs names and metadata around a fresh byte digest; matching separable signatures permit reuse only under the same native source-tree and refreshed-clock premises.
 * @evidence contracts/common.md#clear-and-simple-design This coordinator owns the directory digest entry while ttsc owns selection and byte hashing and inputMetadataEvidence owns stamp interpretation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A quiet tracker or equal timestamps alone cannot certify reuse; changed or unavailable evidence requires the real source digest rather than expected output or a compensating cache exception.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain population invalidation, before/after proof, fresh clock ordering, native-view assumptions and unbounded retained entries, with separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral native source paths use Node resolution and ttsc's native selector; injected metadata must observe those paths. A different filesystem view or path dialect is not supported by the native enumeration/read calls here.
 * @evidence contracts/performance.md#efficient-algorithms Reuse with a held listing stats D directories and F files without enumerating any; without one it enumerates D directories. A miss performs two metadata walks and one O(B) byte digest. Selection sorts its population, and temporary storage follows the file list and largest file buffer.
 * @evidence contracts/performance.md#reuse-equivalent-work All calls share DIGESTS by resolved directory spelling; current separable metadata must match the signature recorded around the producer read. The key does not partition filesystem owners, so sharing assumes one native source view. A miss of a caller naming its project takes the digest the load recorded in that project's plugin cache, across processes.
 * @evidence contracts/performance.md#bound-retention-and-release-resources DIGESTS is module-owned and retains one digest/signature per encountered key until failed stabilization deletes that key or the process ends; no historical-directory bound or explicit teardown currently exists.
 */
export function pluginSourceFilesDigest(
  directory: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  projectRoot?: string,
): string {
  const key = path.resolve(directory);
  /**
   * Supply this caller's metadata and clock view to the shared native selector.
   * The filesystem must observe the same source tree the selector enumerates.
   */
  const evidence = (file: string) => inputMetadataEvidence(file, filesystem);
  const known = DIGESTS.get(key);
  const before = pluginSourceFilesSignature(key, evidence, {
    directory: (entry) => directoryEvidence(entry, filesystem),
    known: known?.listing,
  });
  if (
    before !== undefined &&
    before.separable &&
    known?.signature === before.signature
  ) {
    // A walk that stated every directory leaves its listing for the next proof.
    if (before.listing !== undefined && before.listing !== known.listing)
      DIGESTS.set(key, { ...known, listing: before.listing });
    return known.digest;
  }
  const digest = provenPluginSourceDigest(key, projectRoot);
  const after = pluginSourceFilesSignature(key, evidence, {
    directory: (entry) => directoryEvidence(entry, filesystem),
  });
  if (
    before !== undefined &&
    after !== undefined &&
    after.signature === before.signature &&
    after.separable
  ) {
    DIGESTS.set(key, {
      digest,
      signature: after.signature,
      listing: after.listing,
    });
  } else {
    DIGESTS.delete(key);
  }
  return digest;
}

/**
 * The digests kept, by directory, each with the signature of the metadata it
 * was read under.
 */
const DIGESTS = new Map<
  string,
  { digest: string; signature: string; listing?: IPluginSourceListing }
>();

/**
 * A directory's metadata signature when its stamps witness its entries in this
 * view: a device the view admitted (`filesystemListingDevices`), and both
 * stamps strictly older than the view's reference on it.
 */
function directoryEvidence(
  directory: string,
  filesystem: TtscTransformFilesystemOperations,
): string | undefined {
  const stated = (stats: fs.BigIntStats): string | undefined => {
    const reference = filesystemClockReferences(filesystem).get(stats.dev);
    return filesystemListingDevices(filesystem).has(stats.dev) &&
      reference !== undefined &&
      stats.mtimeNs < reference &&
      stats.ctimeNs < reference
      ? [
          stats.dev,
          stats.ino,
          stats.mode,
          stats.nlink,
          stats.mtimeNs,
          stats.ctimeNs,
        ].join(":")
      : undefined;
  };
  try {
    const entry = filesystem.lstat(directory);
    // A source root reached through a link is stated by the link and by the
    // directory it names: a retarget moves the first, an entry change the
    // second.
    const target = entry.isSymbolicLink()
      ? filesystem.statBigInt(directory)
      : entry;
    if (!target.isDirectory()) return undefined;
    const own = stated(entry);
    if (own === undefined || target === entry) return own;
    const named = stated(target);
    return named === undefined ? undefined : `${own}>${named}`;
  } catch {
    return undefined;
  }
}
