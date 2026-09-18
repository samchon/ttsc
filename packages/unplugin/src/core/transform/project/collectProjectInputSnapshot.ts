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

/** Hash project files and snapshot the directory topology in one walk. */
export function collectProjectInputSnapshot(
  projectRoot: string,
  identities: FilesystemPathIdentityContext,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
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
