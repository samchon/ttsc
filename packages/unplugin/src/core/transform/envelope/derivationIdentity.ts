import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";

/**
 * {@link pathIdentityKey} memoized inside one envelope's derivation state. Pass
 * an already-resolved native absolute spelling. The raw input string is the
 * memo key; a relative spelling would introduce current-directory state which
 * is not represented in that key.
 *
 * @evidence contracts/common.md#principled-implementation The context computes filesystem identity, and memoization preserves that result for an already-resolved absolute spelling within one stable generation snapshot.
 * @evidence contracts/common.md#clear-and-simple-design A lookup-compute-store adapter centralizes identity reuse for all envelope selectors without giving each selector its own filesystem policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Identity comes from the supported pathIdentityKey boundary; the memo does not guess identity from case-folded text or alter foreign filesystem methods.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the absolute-path precondition and per-envelope memo ownership; tags are separated from that usage information under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The supplied identity context owns native realpath and case semantics; this wrapper keys exact input strings without replacing those semantics with platform-name heuristics.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The map retains exact spelling and identity text for distinct generation queries; its context also retains observed path/ancestor/case entries. There is no separate per-query eviction or byte cap. Storage becomes collectible with unretained envelope state; this adapter opens no independent handle.
 * @evidence contracts/performance.md#efficient-algorithms A hit avoids native identity replay but still pays map key text hashing/comparison. A first spelling additionally resolves path text and uncached native realpath/ancestor/case observations through the shared context, then stores its identity; one resolver request is not constant-cost native work.
 * @evidence contracts/performance.md#reuse-equivalent-work Exact absolute spellings reuse identity within the same envelope/context snapshot; callers must not reuse the state after the generation's relevant filesystem identity changes.
 */
export function derivationIdentity(
  /** Generation state retaining one qualified identity observation lifetime. */
  state: TtscEnvelopeDerivation,
  /** Already-resolved native absolute spelling used unchanged as the memo key. */
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
