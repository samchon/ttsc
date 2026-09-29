import { refreshProcessClockReference } from "../transform/clock/refreshProcessClockReference";
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
 * the recorded policy and its digest compared (`membershipRecordDigest`). A
 * plugin source is proven by the metadata of its files where that metadata
 * holds (`pluginSourceFilesDigest`), which stands for their bytes only against
 * a clock reference minted since any rollback, so the proof mints one first, as
 * a delivery does. It holds no generation, so the reference is minted in the
 * probe directory this process keeps (`refreshProcessClockReference`).
 *
 * @returns The tsconfig when it is gone, which a build start answers by
 *   removing the record rather than moving it, the first input whose state
 *   moved, the project root when the root files did, or `undefined`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Each codec is re-proved against the same filesystem view and membership is
 *   re-walked under the stored policy. A fresh process clock reference prevents
 *   rolled-back timestamps alone from certifying a plugin source unchanged.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This operation owns the read-only state verdict; refreshProjectRecordFile
 *   owns the resulting removal or signal side effect.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Codec-specific validation follows producer evidence rather than treating
 *   a quiet watcher or a single root-file timestamp as proof of all inputs.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain detached proof and clock-reference necessity;
 *   return meanings and separated tags follow documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Existence, codec replay and project walking share the supplied filesystem and its path grammar; process-clock ownership remains host-native and provides the boundary needed before metadata reuse.
 * @evidence contracts/performance.md#efficient-algorithms Each input is replayed until the first mismatch, and membership walks only when present and earlier evidence still holds; work grows with the examined input bytes and selected directory population.
 * @evidence contracts/performance.md#reuse-equivalent-work The detached proof reuses recorded producer facts only after current replay and a fresh clock reference establish validity; build-start callers share the verdict per project rather than trusting stale watcher silence.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The proof owns no independent cache or watcher; its returned mismatch is caller-owned and the process-clock service owns the native reference lifecycle.
 */
export function projectRecordMoved(
  record: TtscProjectRecord,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): string | undefined {
  if (!filesystem.exists(record.tsconfig)) return record.tsconfig;
  refreshProcessClockReference(record.root, filesystem);
  for (const [input, evidence] of Object.entries(record.inputs)) {
    if (evidence === null || typeof evidence !== "object") return input;
    if (!watchInputEvidenceMatchesDisk(input, evidence, filesystem))
      return input;
  }
  if (record.membership === null) return undefined;
  const { policy } = record.membership;
  const { complete, directories } = walkProjectInputs(
    record.root,
    filesystem,
    policy,
  );
  if (!complete) return record.root;
  return membershipRecordDigest(policy, directories) ===
    record.membership.digest
    ? undefined
    : record.root;
}
