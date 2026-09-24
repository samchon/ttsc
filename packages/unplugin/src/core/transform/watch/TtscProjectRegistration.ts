import type { TtscWatchInput } from "./TtscWatchInput";

/**
 * What one delivery hands a host that observes the project through its record
 * (`TtscTransformHooks.project`): the record file, written to the generation's
 * state before the hand-over, and the inputs a watching session's bridge
 * observes to move it.
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
   * Every input of the generation, with the evidence the record holds, for a
   * bridge that observes them live. Derived on first call and memoized per
   * generation, so a host without a bridge never pays for it.
   */
  inputs: () => readonly TtscWatchInput[];
  /** The project record file (`projectRecordFile`), up to date. */
  record: string;
}
