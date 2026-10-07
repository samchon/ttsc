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

  /** Saturated count of further witness occurrences dropped after the bound. */
  omitted: number;

  /**
   * Keys of the kept witnesses, bounded with them so duplicates are not
   * recorded twice.
   */
  seen: Set<string>;
}
