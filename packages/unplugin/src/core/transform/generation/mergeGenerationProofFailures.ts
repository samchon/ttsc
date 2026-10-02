import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";
import { recordGenerationProofFailure } from "./recordGenerationProofFailure";

/**
 * Fold source witnesses into a target through the shared bounded recorder.
 * Source omissions remain counted because their lost identities cannot be
 * deduplicated against the target's retained evidence.
 * The source remains unchanged; retained witnesses are shared references, so
 * producers must treat their classifications as fixed after recording.
 *
 * @evidence contracts/common.md#principled-implementation Retained source entries use the target recorder's identity policy, while saturated addition preserves already omitted occurrence counts that cannot be recovered from source entries.
 * @evidence contracts/common.md#clear-and-simple-design This operation coordinates aggregation without duplicating recorder limits or witness identity encoding.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing witnesses remain omitted rather than being silently converted into proof success or guessed unique identities.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain shared recorder ownership and the reason lost source identities cannot be deduplicated.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Merge visits the source's recorder-bounded retained entries once. Each
 *   delegated insertion encodes the complete witness tuple and queries its
 *   identity, so work and temporary encoded keys retain witness-text cost even
 *   with at most eight entries. Omission addition is constant work; discarded
 *   evidence is not reconstructed.
 * @evidence contracts/performance.md#reuse-equivalent-work The shared recorder reuses retained target identities to suppress duplicates across evidence families; mutable aggregate merges are not memoized.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The target remains subject to the recorder's eight-entry/seen-key bound; merge retains no source history beyond copied witnesses and its saturated omission count.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Combines in-memory witness collections; it parses no path.
 */
export function mergeGenerationProofFailures(
  target: TtscGenerationProofFailures,
  source: TtscGenerationProofFailures,
): void {
  for (const failure of source.entries) {
    recordGenerationProofFailure(target, failure);
  }
  target.omitted = Math.min(
    Number.MAX_SAFE_INTEGER,
    target.omitted + source.omitted,
  );
}
