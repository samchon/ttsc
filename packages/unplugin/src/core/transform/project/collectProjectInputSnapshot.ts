import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { inputMetadataEvidence } from "../inputs/inputMetadataEvidence";
import { hashText } from "../utils/hashText";
import type { TtscProjectDirectorySnapshot } from "./TtscProjectDirectorySnapshot";
import type { TtscProjectWalkFailure } from "./TtscProjectWalkFailure";
import { toProjectKey } from "./toProjectKey";
import { walkProjectInputs } from "./walkProjectInputs";

/**
 * Hash project files and snapshot directory topology in one walk.
 *
 * Reuse a recorded hash only when separable metadata still matches its proven
 * signature. Reads are bracketed by metadata observations; unavailable or
 * changed signatures mark the snapshot incomplete instead of hiding that
 * observed instability. A validating caller may restrict
 * hashing to its declared keys while retaining the whole membership walk.
 * The caller owns the identity observation lifetime and refreshes native clock
 * references before relying on separability; this collector does not mint them.
 *
 * @evidence contracts/common.md#principled-implementation The snapshot separates directory completeness, file-read stability and attributable failures; only matching separable metadata substitutes for the content read that established a prior hash.
 * @evidence contracts/common.md#clear-and-simple-design One walk feeds one file pass, with shared metadata and key helpers owning their respective boundaries; returned sets preserve which proof obligations failed.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unreadable or changing files mark incompleteness rather than yielding successful partial hashes, and declared-key filtering does not suppress directory membership proof.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain metadata-authorized reuse and declared-key restriction; inline comments justify clock separation and failure attribution without mirroring trivial assignments.
 * @evidence contracts/portability.md#os-neutral-implementation Enumeration and reads use the supplied native filesystem view; identity keys share its case/link policy, and bigint metadata plus filesystem clock separation avoid assuming one timestamp precision on every platform.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This operation returns caller-owned proof collections and opens no retained handle; generation retention belongs to the consuming cache owner.
 * @evidence contracts/performance.md#efficient-algorithms
 *   The full membership walk precedes one admitted-file pass. Native project-key
 *   resolution is required even for a file later excluded by declared keys;
 *   selected files add metadata/path/bigint formatting and uncached identity
 *   observations. Qualified hashes skip byte reads; other inputs read/hash B
 *   bytes and recapture metadata. Walk sorting, directory/entry storage, digest
 *   text, file proof records and copied failures contribute their populations;
 *   declared filtering bounds selected reads, not the full walk or its outputs.
 * @evidence contracts/performance.md#reuse-equivalent-work Proven hashes replace content reads only when the same key retains a matching separable metadata signature; absent or nonseparable evidence forces a fresh bracketed read and clock authority is rechecked.
 */
export function collectProjectInputSnapshot(
  /** Lexical root whose native membership is fully enumerated. */
  projectRoot: string,
  /** Caller-owned identity context with an appropriate current observation lifetime. */
  identities: FilesystemPathIdentityContext,
  /** Coherent native read/metadata/listing view used by the entire snapshot. */
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  /** Prior readable hashes and witnesses qualified against the caller-refreshed clock. */
  proven?: {
    hashes: Record<string, string>;
    signatures: Record<string, string>;
  },
  options?: {
    /**
     * Restrict hashing to these project keys. Supplied by a validating caller,
     * which compares over exactly this set, and omitted by a capturing one,
     * which has no generation to compare against yet.
     */
    declaredKeys?: ReadonlySet<string>;

    /** What the resolved configuration admits into the program. */
    policy?: ITtscProjectMembershipPolicy;
  },
): {
  complete: boolean;
  directoryComplete: boolean;
  fileSignatures: Record<string, string>;
  hashes: Record<string, string>;
  notificationUnsafeInputs: Set<string>;
  projectDirectories: TtscProjectDirectorySnapshot[];
  provenSignatures: Record<string, string>;
  unstableFiles: Set<string>;
  walkFailures: TtscProjectWalkFailure[];
} {
  const hashes: Record<string, string> = {};
  const notificationUnsafeInputs = new Set<string>();
  const fileSignatures: Record<string, string> = {};
  const provenSignatures: Record<string, string> = {};
  const unstableFiles = new Set<string>();
  let attributed = true;
  const walked = walkProjectInputs(projectRoot, filesystem, options?.policy);
  const walkFailures = [...walked.failures];
  let complete = walked.complete;
  for (const file of walked.files) {
    try {
      const key = toProjectKey(projectRoot, file, identities);
      // A caller validating a generation compares hashes over that
      // generation's declared inputs alone (`sameHashes` takes the declared key
      // set), so reading anything else is work whose result is never consulted.
      // Skipping it is what keeps a directory full of emitted files from
      // costing a read per file on the pass that first sees them
      // (samchon/ttsc#1307). Capture passes supply no restriction and still
      // record the whole walk.
      if (
        options?.declaredKeys !== undefined &&
        !options.declaredKeys.has(key)
      ) {
        continue;
      }
      const before = inputMetadataEvidence(file, filesystem);
      if (before?.notificationAuthoritative !== true) {
        notificationUnsafeInputs.add(key);
      }
      // A file whose signature still equals the one captured around the read
      // that produced the recorded hash carries that content, so the whole
      // project does not have to be re-read to prove one delivery. Recheck the
      // clock ordering as well: rollback can make a formerly safe floor unable
      // to answer for a new write (samchon/ttsc#1344).
      if (
        before !== undefined &&
        before.separable &&
        proven !== undefined &&
        proven.signatures[key] === before.signature &&
        Object.prototype.hasOwnProperty.call(proven.hashes, key)
      ) {
        hashes[key] = proven.hashes[key]!;
        fileSignatures[key] = before.signature;
        provenSignatures[key] = before.signature;
        continue;
      }
      const contents = filesystem.readFile(file);
      const after = inputMetadataEvidence(file, filesystem);
      if (after?.notificationAuthoritative !== true) {
        notificationUnsafeInputs.add(key);
      }
      hashes[key] = hashText(contents);
      if (
        before === undefined ||
        after === undefined ||
        before.signature !== after.signature
      ) {
        complete = false;
        unstableFiles.add(key);
        walkFailures.push({ kind: "file-changed-during-read", path: file });
      } else {
        fileSignatures[key] = after.signature;
        // Only a signature whose stamp's tick the filesystem's clock provably
        // left before this read may later stand in for the content comparison
        // (`stampSeparable`); the raw signature above still participates
        // in the generation-time stability comparison.
        if (before.separable) {
          provenSignatures[key] = after.signature;
        }
      }
    } catch {
      // File watchers may observe a transform while another process is moving
      // or deleting files. The missing key invalidates older cache entries.
      complete = false;
      walkFailures.push({ kind: "file-read-failed", path: file });
      try {
        unstableFiles.add(toProjectKey(projectRoot, file, identities));
      } catch {
        // Without a key the failure cannot be attributed, so it keeps the
        // whole snapshot incomplete rather than being scoped away.
        attributed = false;
      }
    }
  }
  return {
    complete,
    directoryComplete: walked.complete && attributed,
    fileSignatures,
    hashes,
    notificationUnsafeInputs,
    projectDirectories: walked.directories,
    provenSignatures,
    unstableFiles,
    walkFailures,
  };
}
