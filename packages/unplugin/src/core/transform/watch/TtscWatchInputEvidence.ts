import type { TtscWatchInputState } from "./TtscWatchInputState";

/**
 * What the generation already knows about one derived watch input, handed to
 * the adapter so it does not rederive it per input per delivery.
 *
 * All facts are generation state: the identity is the memoized
 * `pathIdentityKey` of the input, `missing` preserves the original public
 * existence contract, and `unavailable` distinguishes a failed file predicate
 * from ordinary absence. An adapter that computes them itself pays a
 * `realpath`, a case-sensitivity directory listing, and an `existsSync` for
 * every input of every delivered module, which is O(modules x inputs) for one
 * build (samchon/ttsc#1246).
 *
 * @evidence contracts/common.md#principled-implementation Identity, availability and optional codec state preserve distinct generation observations; unavailable refines missing without claiming a current disk read.
 * @evidence contracts/common.md#clear-and-simple-design The carrier keeps derived facts together so adapters consume one generation answer instead of reconstructing independent predicates.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown state stays optional; the supported missing/not-file distinction does not substitute fabricated content.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain generation ownership and repeated observation costs; spaced member comments and separated tags follow documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Filesystem identity is supplied by the generation's native identity owner rather than derived from path casing or an OS name here.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscWatchInputEvidence only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscWatchInputEvidence only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscWatchInputEvidence only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface TtscWatchInputEvidence {
  /** Memoized filesystem identity of the input. */
  identity: string;

  /** Whether the generation recorded this input as unavailable as a file. */
  missing: boolean;

  /** The generation state Metro can compare with its main-process baseline. */
  state?: TtscWatchInputState;

  /** Which unavailable predicate must become true before invalidation. */
  unavailable?: "missing" | "not-file";
}
