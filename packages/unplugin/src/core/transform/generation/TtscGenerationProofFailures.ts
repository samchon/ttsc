import type { TtscGenerationProofFailure } from "./TtscGenerationProofFailure";

/**
 * Bounded proof witnesses for one transform attempt, populated through
 * recordGenerationProofFailure. The seen set covers retained entries only;
 * omitted is a saturated count of additional occurrences, not a unique count.
 *
 * @evidence contracts/common.md#principled-implementation Entries preserve printable witnesses, seen identifies retained duplicates and omitted records loss without retaining an unbounded identity set.
 * @evidence contracts/common.md#clear-and-simple-design The carrier separates retained evidence from dropped occurrence accounting; the shared recorder enforces its bound and consistency.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Lost evidence remains visible through omitted rather than being silently discarded or claimed deduplicated without a retained identity.
 * @evidence contracts/common.md#meaningful-documentation Native prose states recorder ownership and duplicate-count limitations, while separated member comments explain each representation.
 * @evidence contracts/portability.md#os-neutral-implementation Entries preserve each witness's native lexical path unchanged; seen stores opaque recorder identities rather than interpreting path separators or filesystem equivalence.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscGenerationProofFailures only declares a shape; it has no computation
 *   at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscGenerationProofFailures only declares a shape; it has no work to
 *   reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscGenerationProofFailures only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface TtscGenerationProofFailures {
  /** Unique witnesses kept, at most `MAX_GENERATION_PROOF_FAILURES`. */
  entries: TtscGenerationProofFailure[];

  /**
   * Complete streaming classification, including witnesses omitted from
   * diagnostics.
   */
  snapshotCompatible?: boolean;

  /**
   * Borrowed generation-owned classifier, absent without a captured native
   * view.
   *
   * @evidence contracts/common.md#principled-implementation The sticky compatibility verdict accounts for every occurrence before diagnostic truncation; after its first refusal no later occurrence can restore delivery authority.
   * @evidence contracts/common.md#clear-and-simple-design Collectors borrow one generation classifier rather than rebuilding its recorded-input index.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The callback records compatibility only; callers still require complete producer proof and never infer cache freshness from it.
   * @evidence contracts/common.md#meaningful-documentation The member states optionality and ownership, while the generation classifier documents actual path and kind admission.
   * @evidence contracts/portability.md#os-neutral-implementation The callback receives native lexical witness paths and delegates their interpretation to the generation's classifier.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This signature declares no runtime computation; the classifier implementation owns its index and lookup costs.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This signature declares no memo; generation capture owns sharing the callback.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This signature acquires no resource; generation capture owns the borrowed closure's lifetime.
   */
  snapshotFailureClassifier?: (failure: TtscGenerationProofFailure) => boolean;

  /** Saturated count of further witness occurrences dropped after the bound. */
  omitted: number;

  /**
   * Keys of the kept witnesses, bounded with them so duplicates are not
   * recorded twice.
   */
  seen: Set<string>;
}
