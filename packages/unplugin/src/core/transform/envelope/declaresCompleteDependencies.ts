import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import { collectDeclaredIdentities } from "./collectDeclaredIdentities";
import { derivationIdentity } from "./derivationIdentity";

/**
 * Report whether the envelope declared `dependencies[file]` complete, i.e. the
 * plugin took responsibility for that file's whole input set beyond the file
 * itself and the universal config chain. Callers must still keep the baseline
 * for a file the same envelope declared volatile.
 *
 * @evidence contracts/common.md#principled-implementation Membership in the producer's explicit completeness declaration transfers input responsibility; exceptions assert no membership, and callers retain the conservative baseline for contradictory volatility.
 * @evidence contracts/common.md#clear-and-simple-design This predicate owns declaration lookup only; deriveWatchInputs owns which host inputs that declaration may remove.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Completeness requires an actual envelope declaration and never follows from a short dependency list or a successful transform.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the producer's responsibility, universal config exception and volatility caveat rather than merely naming the boolean; tag separation follows the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Declaration membership compares identities through the envelope context, so native case and realpath behavior are shared with the queried file rather than inferred from textual spelling.
 * @evidence contracts/performance.md#efficient-algorithms The first query folds the declaration list once; later membership uses a set and memoized identity instead of rescanning all declarations per module.
 * @evidence contracts/performance.md#reuse-equivalent-work The set is cached on one envelope's state and reused for that generation's files; this requires a stable producer declaration and the same root/context throughout the generation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The cached set has at most one entry per declared physical identity and belongs to the weakly owned envelope state; the predicate opens no handles and retains no separate history.
 */
export function declaresCompleteDependencies(
  state: TtscEnvelopeDerivation,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
  },
): boolean {
  if (props.result.type === "exception") {
    return false;
  }
  const declared = (state.dependenciesComplete ??= collectDeclaredIdentities(
    state,
    props.projectRoot,
    props.result.dependenciesComplete,
  ));
  return declared.has(derivationIdentity(state, props.file));
}
