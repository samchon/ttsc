import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import { collectDeclaredIdentities } from "./collectDeclaredIdentities";
import { derivationIdentity } from "./derivationIdentity";

/**
 * Report whether the plugin declared `file` volatile: its output depends on
 * non-file inputs (environment, time, network), so neither the project
 * transform cache nor a bundler's persistent cache may replay it. Reads the
 * per-envelope identity set instead of rescanning the member list.
 */
export function isVolatileFile(
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
  const declared = (state.volatileFiles ??= collectDeclaredIdentities(
    state,
    props.projectRoot,
    props.result.volatile,
  ));
  return declared.has(derivationIdentity(state, props.file));
}
