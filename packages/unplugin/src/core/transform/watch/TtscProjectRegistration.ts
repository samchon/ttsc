import type { TtscWatchInput } from "./TtscWatchInput";

/**
 * What one delivery hands a host that observes the project through its record
 * (`TtscTransformHooks.project`): the record file and the inputs a watching
 * session's bridge observes to move it. A written digest identifies a current
 * snapshot; an existing record handed over after a refused write has no digest.
 *
 * @evidence contracts/common.md#principled-implementation The record path, optional written digest, failure flag and snapshot callback distinguish content proof from a record merely found on disk.
 * @evidence contracts/common.md#clear-and-simple-design One delivery carrier groups the persisted record with its live-watch inputs while keeping reading behind a named callback signature.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An absent digest remains absent when no current write landed; the type does not fabricate a cache proof for an existing record.
 * @evidence contracts/common.md#meaningful-documentation Native members explain digest ownership, recovery state and snapshot replacement; separated members and tags follow documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation The actual native record spelling is carried separately from its content digest and input identities, with no OS-wide case assumption.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscProjectRegistration only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscProjectRegistration only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscProjectRegistration only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface TtscProjectRegistration {
  /**
   * The digest of the bytes this process wrote to {@link record} for the
   * delivery's generation (`projectRecordDigest`), or `undefined` for a record
   * no write of this process landed on, handed over as it is. A host that keeps
   * no snapshot of the record compares it with the record's bytes before it
   * serves the module from a cache (`createRollupCachedModuleProof`).
   */
  digest?: string;

  /** Whether the delivery failed and the inputs are the recovery inputs. */
  failed: boolean;

  /**
   * This registration's retained snapshot of generation and routing inputs,
   * with the evidence the record holds, for a bridge that observes them live.
   * Additional config-selection inputs produce a new immutable snapshot, so
   * later registrations can replace the bridge's observed input set.
   */
  inputs: TtscWatchProjectInputs;

  /** Host-approved record path; digest identifies a current written snapshot. */
  record: string;
}

/**
 * Obtain the readonly watching snapshot retained for this registration.
 *
 * Later registrations may carry a new snapshot when the same generation gains
 * another selection dependency. Consumers must not mutate the array or entries.
 *
 * @evidence contracts/common.md#principled-implementation The zero-argument result exposes a registration's stable snapshot while later registrations can represent an expanded dependency set.
 * @evidence contracts/common.md#clear-and-simple-design A named function alias preserves the existing property signature and avoids changing callback assignability through method syntax.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Snapshot delivery carries recorded inputs instead of reconstructing evidence from an expected cache outcome.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe snapshot replacement and caller ownership; separated tags follow documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native spellings and identity facts stay in the input carrier; this callback performs no platform-dependent path rewrite.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscWatchProjectInputs only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscWatchProjectInputs only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscWatchProjectInputs only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export type TtscWatchProjectInputs = () => readonly TtscWatchInput[];
