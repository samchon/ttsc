/**
 * Own the descriptor evaluator's observation status and captured records.
 *
 * The final descriptor envelope carries this snapshot independently of the
 * optional NDJSON channel. An uninstalled runtime or a failed observation
 * cannot certify a reusable descriptor from an apparently empty channel.
 *
 * @evidence contracts/common.md#principled-implementation Ordered immutable record strings and an explicit completeness bit distinguish a completed empty observation from a missing or failed recorder.
 * @evidence contracts/common.md#clear-and-simple-design This namespace groups installation, append, failure and snapshot transitions for one evaluator-owned state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Its state is private to this module and does not replace foreign resolver methods or infer unseen inputs.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state envelope purpose, missing-installation meaning and separation from the optional NDJSON channel.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace representation groups transitions; individual functions own their algorithm choices.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Cache admission belongs to the envelope consumer rather than this representation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Functions own acquisition and snapshots; the namespace itself does not independently retain resources.
 */
export namespace PluginDescriptorInputObservation {
  /**
   * Arm observation after public runtime hooks have installed successfully.
   * Reinstallation does not erase observations or recover a failed proof.
   *
   * @evidence contracts/common.md#principled-implementation Successful hook installation establishes the observation owner's initial state; a repeated begin leaves an already invalid proof invalid.
   * @evidence contracts/common.md#clear-and-simple-design One initialization transition belongs to the runtime installer, separate from captured records and consumer snapshots.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts State changes occur in this owned recorder rather than a foreign module or a guessed cache-success flag.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies the installation prerequisite and repeated-call behavior with a blank line before tags.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms This fixed state transition does not select a processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Initialization authorizes observation, not reuse of a computation.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources Initialization creates no handles and preserves the existing process-owned population rather than silently dropping observations.
   */
  export function begin(): void {
    if (installed) return;
    installed = true;
    complete = true;
  }

  /**
   * Retain ordered records for the final evaluator envelope.
   *
   * @evidence contracts/common.md#principled-implementation Copying each serialized record preserves the exact order and fingerprints established by the resolver producer.
   * @evidence contracts/common.md#clear-and-simple-design Producers provide already observed records; this owner performs no second filesystem read that could pair later state with earlier evaluation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Captured records are actual producer observations, without inferred missing edges or fallback success claims.
   * @evidence contracts/common.md#meaningful-documentation The native purpose distinguishes retained observations from a later filesystem reconstruction, with prose separated from tags.
   * @evidence contracts/performance.md#efficient-algorithms Appending N serialized records costs O(N) array insertions and retains their existing string values without reparsing or repeated joins.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Recording observation results does not decide whether descriptor evaluations may share a result.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The evaluator process owns these strings until exit; population and bytes grow with observed resolver edges and have no fixed cap. No descriptor or native handle is retained here.
   */
  export function record(records: readonly string[]): void {
    for (const record of records) lines.push(record);
  }

  /**
   * Irreversibly refuse proof after an observation or channel failure.
   *
   * @evidence contracts/common.md#principled-implementation A failed observation cannot be reconstructed from a partial record population, so false remains false for this evaluator lifetime.
   * @evidence contracts/common.md#clear-and-simple-design One failure transition avoids producer-specific success assumptions or recovery wrappers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The flag records an actual missing proof instead of treating a swallowed native error as cacheable success.
   * @evidence contracts/common.md#meaningful-documentation Native prose specifies monotonic invalidation and the failures that cause it, with separated tags.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms A fixed boolean assignment does not own an input-processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records proof failure; consumers own cache admission.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Invalidating a proof neither acquires nor releases resources and does not own retained-record lifetime.
   */
  export function invalidate(): void {
    complete = false;
  }

  /**
   * Copy the final status and records without exposing mutable owned state.
   *
   * @evidence contracts/common.md#principled-implementation An uninstalled recorder reports incomplete; the array copy prevents envelope consumers from changing retained observations.
   * @evidence contracts/common.md#clear-and-simple-design One snapshot carries status and records together, so an empty successful channel cannot substitute for missing observation ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Snapshot output reflects owned state without foreign mutation or invented dependency records.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the uninstalled meaning and copy ownership, separated from acknowledgment tags.
   * @evidence contracts/performance.md#efficient-algorithms Snapshotting N records costs O(N) references and no repeat parsing or filesystem scan.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The snapshot supplies proof to the owning cache policy and does not share evaluator computations itself.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The copied array transfers to the envelope consumer while the original remains process-owned; strings are immutable and no native handles escape.
   */
  export function snapshot(): { complete: boolean; lines: string[] } {
    return { complete: installed && complete, lines: [...lines] };
  }
}

let installed = false;
let complete = false;
const lines: string[] = [];
