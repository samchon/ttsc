import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { resultFilesystem } from "../cache/resultFilesystem";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";

/**
 * Derivation states keyed by the compiler result object. One result object is
 * produced by one compile against one project root, so the root captured at
 * build time is the only root the state ever sees.
 */
const ENVELOPE_DERIVATIONS = new WeakMap<
  ITtscCompilerTransformation,
  TtscEnvelopeDerivation
>();

/** Return the derivation state of `props.result`, building it on first use. */
export function envelopeDerivation(props: {
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): TtscEnvelopeDerivation {
  const existing = ENVELOPE_DERIVATIONS.get(props.result);
  if (existing !== undefined) {
    return existing;
  }
  const identityContext = createHostPathIdentityContext(
    resultFilesystem(props.result),
  );
  const spelling = path.resolve(props.projectRoot);
  const created: TtscEnvelopeDerivation = {
    identityContext,
    identities: new Map(),
    project: {
      physical: identityContext.resolve(spelling).path,
      spelling,
    },
    watchInputs: new Map(),
  };
  ENVELOPE_DERIVATIONS.set(props.result, created);
  return created;
}
