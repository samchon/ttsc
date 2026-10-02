import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";

/**
 * {@link pathIdentityKey} memoized inside one envelope's derivation state.
 * Callers always pass already-resolved absolute paths, so the input string is a
 * stable memo key.
 *
 * @evidence contracts/common.md#principled-implementation The context computes filesystem identity, and memoization preserves that result for an already-resolved absolute spelling within one stable generation snapshot.
 * @evidence contracts/common.md#clear-and-simple-design A lookup-compute-store adapter centralizes identity reuse for all envelope selectors without giving each selector its own filesystem policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Identity comes from the supported pathIdentityKey boundary; the memo does not guess identity from case-folded text or alter foreign filesystem methods.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the absolute-path precondition and per-envelope memo ownership; tags are separated from that usage information under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The supplied identity context owns native realpath and case semantics; this wrapper keys exact input strings without replacing those semantics with platform-name heuristics.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The identities map grows with distinct spellings queried for one generation and is released with the weakly owned envelope state; this adapter opens no independent handles.
 * @evidence contracts/performance.md#efficient-algorithms A map hit avoids another identity resolution; the first query pays the shared context's resolution cost and stores one result per distinct queried spelling.
 * @evidence contracts/performance.md#reuse-equivalent-work Exact absolute spellings reuse identity within the same envelope/context snapshot; callers must not reuse the state after the generation's relevant filesystem identity changes.
 */
export function derivationIdentity(
  state: TtscEnvelopeDerivation,
  file: string,
): string {
  const existing = state.identities.get(file);
  if (existing !== undefined) {
    return existing;
  }
  const identity = pathIdentityKey(file, state.identityContext);
  state.identities.set(file, identity);
  return identity;
}
