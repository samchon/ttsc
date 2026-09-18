import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import { collectDeclaredIdentities } from "./collectDeclaredIdentities";
import { derivationIdentity } from "./derivationIdentity";

/**
 * Report whether the envelope declared `dependencies[file]` complete, i.e. the
 * plugin took responsibility for that file's whole input set beyond the file
 * itself and the universal config chain. Callers must still keep the baseline
 * for a file the same envelope declared volatile.
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
