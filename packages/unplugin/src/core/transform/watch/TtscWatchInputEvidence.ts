import type { TtscWatchInputState } from "./TtscWatchInputState";

/**
 * What the generation already knows about one derived watch input, handed to
 * the adapter so it does not rederive it per input per delivery.
 *
 * All facts are generation state: the identity is the memoized
 * {@link pathIdentityKey} of the input, `missing` preserves the original public
 * existence contract, and `unavailable` distinguishes a failed file predicate
 * from ordinary absence. An adapter that computes them itself pays a
 * `realpath`, a case-sensitivity directory listing, and an `existsSync` for
 * every input of every delivered module, which is O(modules x inputs) for one
 * build (samchon/ttsc#1246).
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
