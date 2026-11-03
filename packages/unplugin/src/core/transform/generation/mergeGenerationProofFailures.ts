import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";
import { recordGenerationProofFailure } from "./recordGenerationProofFailure";

/**
 * Fold source witnesses into a target through the shared bounded recorder.
 * Source omissions remain counted because their lost identities cannot be
 * deduplicated against the target's retained evidence.
 *
 * Capture supplies distinct source and target collections, leaving the source
 * unchanged. Retained witnesses are shared references, so producers must treat
 * their classifications as fixed after recording.
 *
 * @evidence contracts/common.md#principled-implementation Retained source entries use the target recorder's identity policy, while saturated addition preserves already omitted occurrence counts that cannot be recovered from source entries. A positive omitted-witness summary transfers only under the same generation classifier; refusal remains sticky before diagnostic truncation.
 * @evidence contracts/common.md#clear-and-simple-design This operation coordinates aggregation without duplicating recorder limits or witness identity encoding.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing witnesses remain omitted rather than being silently converted into proof success or guessed unique identities.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain shared recorder ownership and the reason lost source identities cannot be deduplicated.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Merge visits the source's recorder-bounded retained entries once. Each
 *   delegated insertion encodes the complete witness tuple and queries its
 *   identity and optionally classifies lexical paths, so work and temporary encoded keys retain witness-text cost even
 *   with at most eight entries. Omission addition is constant work; discarded
 *   evidence is not reconstructed.
 * @evidence contracts/performance.md#reuse-equivalent-work The shared recorder reuses retained target identities to suppress duplicates across evidence families; mutable aggregate merges are not memoized.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The target remains subject to the recorder's eight-entry/seen-key bound; merge retains no source history beyond copied witnesses and its saturated omission count. The optional borrowed classifier keeps its generation input indexes reachable while either the generation or aggregate retains it; those indexes are not subject to the diagnostic witness bound.
 * @evidence contracts/portability.md#os-neutral-implementation Combines in-memory witnesses through the recorder, whose optional generation classifier owns native lexical path resolution.
 */
export function mergeGenerationProofFailures(
  target: TtscGenerationProofFailures,
  source: TtscGenerationProofFailures,
): void {
  for (const failure of source.entries) {
    recordGenerationProofFailure(target, failure);
  }
  if (
    target.snapshotFailureClassifier !== undefined &&
    (source.snapshotCompatible === false ||
      (source.omitted !== 0 &&
        (source.snapshotCompatible !== true ||
          source.snapshotFailureClassifier !==
            target.snapshotFailureClassifier)))
  )
    target.snapshotCompatible = false;
  target.omitted = Math.min(
    Number.MAX_SAFE_INTEGER,
    target.omitted + source.omitted,
  );
}
