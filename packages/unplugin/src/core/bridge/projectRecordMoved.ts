import fs from "node:fs";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../transform/filesystem/TtscTransformFilesystemOperations";
import { walkProjectInputs } from "../transform/project/walkProjectInputs";
import { watchInputEvidenceMatchesDisk } from "../transform/watch/watchInputEvidenceMatchesDisk";
import type { TtscProjectRecord } from "./TtscProjectRecord";
import { membershipRecordDigest } from "./membershipRecordDigest";

/**
 * What moved a project's state away from what its record holds, or nothing when
 * the disk still holds the recorded state: the proof a build start makes of a
 * record (`refreshProjectRecordFiles`), separable from the move it follows
 * with, so a harness or a maintainer can ask the same question of a record
 * without moving it.
 *
 * Each recorded input is proven against the disk the way a delivery proves a
 * generation (`watchInputEvidenceMatchesDisk`), and the walk is run again under
 * the recorded policy and its digest compared (`membershipRecordDigest`).
 *
 * @returns The tsconfig when it is gone, the first input whose state moved, the
 *   project root when the root files did, or `undefined`.
 */
export function projectRecordMoved(
  record: TtscProjectRecord,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | undefined {
  if (!fs.existsSync(record.tsconfig)) return record.tsconfig;
  for (const [input, evidence] of Object.entries(record.inputs)) {
    if (evidence === null || typeof evidence !== "object") return input;
    if (!watchInputEvidenceMatchesDisk(input, evidence, filesystem))
      return input;
  }
  if (record.membership === null) return undefined;
  const { policy } = record.membership;
  const { directories } = walkProjectInputs(record.root, filesystem, policy);
  return membershipRecordDigest(policy, directories) ===
    record.membership.digest
    ? undefined
    : record.root;
}
