import { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import type { PluginContentIdentities } from "./PluginContentIdentities";
import { PluginLoadAnswers } from "./PluginLoadAnswers";

/**
 * Plugin-load answers whose proof is their key together with a metadata
 * witness: Go readings, which depend on the variables the Go tool receives,
 * which the key carries, and on files no variable names, which the witness does
 * (`PluginBuildEnvironmentWitness`).
 *
 * A process already keeps such a reading while its witness holds
 * (`processPluginBuildEnvironment`); every launch is a new process, so the
 * readings ran again on each one (samchon/ttsc#1852). These records carry the
 * same proof across processes: an answer is served only while its witness
 * holds, and is written only when its witness held right after the reading, as
 * `PluginLoadAnswers` admits only a computation proven unchanged around it.
 *
 * @evidence contracts/common.md#principled-implementation Served answers require their recorded witness to hold now; recorded answers required it to hold right after their reading.
 * @evidence contracts/common.md#clear-and-simple-design One owner pairs the answer store with witness validation for every witnessed family.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A malformed, moved or refused record is not served; the caller reads again.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the two-part proof and the admission rule.
 * @evidence contracts/portability.md#os-neutral-implementation The witness keeps native path, link and stat identity.
 * @evidence contracts/performance.md#efficient-algorithms A read parses one record and stats each witnessed path once; a write validates once and serializes the entries.
 * @evidence contracts/performance.md#reuse-equivalent-work Equal keys share one reading across processes while the witness holds.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Records are single files of the answer store, aged by its collector; nothing is retained in memory.
 */
export namespace WitnessedLoadAnswers {
  /**
   * The answer recorded for `identity` with its witness, when the witness still
   * holds and `accept` takes the value.
   *
   * @param store The opened store, or `undefined` for no persistence.
   * @param kind Answer family.
   * @param identity Every keyed input of the answer.
   * @param accept Shape check of the recorded value.
   * @evidence contracts/common.md#principled-implementation An answer is returned only when its shape is accepted and every witnessed path and variable still matches.
   * @evidence contracts/common.md#clear-and-simple-design The answer store owns the file; this member owns the witness half of the proof.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A malformed or moved record returns undefined rather than a partial answer.
   * @evidence contracts/common.md#meaningful-documentation Native prose states both conditions of a served answer.
   * @evidence contracts/portability.md#os-neutral-implementation Validation uses the witness's native stat, link and variable observations.
   * @evidence contracts/performance.md#efficient-algorithms One record parse and one stat per witnessed path, stopping at the first mismatch.
   * @evidence contracts/performance.md#reuse-equivalent-work A still-holding answer replaces the reading it records.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned witness belongs to the caller; nothing is retained.
   */
  export function read<T>(
    store: PluginContentIdentities.Store | undefined,
    kind: string,
    identity: unknown,
    accept: (value: unknown) => value is T,
  ): { value: T; witness: PluginBuildEnvironmentWitness.Record } | undefined {
    const entry = PluginLoadAnswers.read(store, kind, identity);
    if (typeof entry !== "object" || entry === null) return undefined;
    const { value, witness } = entry as { value?: unknown; witness?: unknown };
    if (
      !accept(value) ||
      !Array.isArray(witness) ||
      !witness.every(
        (row) =>
          Array.isArray(row) &&
          row.length === 2 &&
          typeof row[0] === "string" &&
          typeof row[1] === "string",
      )
    )
      return undefined;
    const record: PluginBuildEnvironmentWitness.Record = new Map(
      witness as [string, string][],
    );
    return PluginBuildEnvironmentWitness.holds(record)
      ? { value, witness: record }
      : undefined;
  }

  /**
   * Record `value` under `identity` when `witness` holds now.
   *
   * @param store The opened store, or `undefined` for no persistence.
   * @param kind Answer family.
   * @param identity Every keyed input of the answer.
   * @param value JSON-serializable answer.
   * @param witness Metadata observed before the reading.
   * @evidence contracts/common.md#principled-implementation Only a reading whose witness held right after it is recorded.
   * @evidence contracts/common.md#clear-and-simple-design Admission and serialization share the store's single-file publication.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A refused or moved witness records nothing.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the admission condition.
   * @evidence contracts/portability.md#os-neutral-implementation Validation uses native observations; publication belongs to the store.
   * @evidence contracts/performance.md#efficient-algorithms One validation pass and one serialization of the witness rows.
   * @evidence contracts/performance.md#reuse-equivalent-work The record lets later processes skip the reading.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One file in the answer store, aged by its collector.
   */
  export function write(
    store: PluginContentIdentities.Store | undefined,
    kind: string,
    identity: unknown,
    value: unknown,
    witness: PluginBuildEnvironmentWitness.Record,
  ): void {
    if (store === undefined || !PluginBuildEnvironmentWitness.holds(witness))
      return;
    PluginLoadAnswers.write(store, kind, identity, {
      value,
      witness: [...witness],
    });
  }

  /**
   * Add `source`'s observations the caller has not made itself, so a caller
   * that compares its witness after a build compares these too.
   *
   * @param target The caller's witness, or `undefined` for none.
   * @param source Observations of the answer just used.
   * @evidence contracts/common.md#principled-implementation The caller's earlier observation of a path wins, as a first observation does in the witness.
   * @evidence contracts/common.md#clear-and-simple-design One merge serves served and fresh answers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No observation is dropped or rewritten.
   * @evidence contracts/common.md#meaningful-documentation Native prose states why the observations join the caller's.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation A map merge performs no native operation.
   * @evidence contracts/performance.md#efficient-algorithms One pass over the source rows.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A merge coordinates no work.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Rows move into the caller's map.
   */
  export function join(
    target: PluginBuildEnvironmentWitness.Record | undefined,
    source: PluginBuildEnvironmentWitness.Record,
  ): void {
    if (target === undefined) return;
    for (const [file, state] of source)
      if (!target.has(file)) target.set(file, state);
  }
}
