import type { ITtscCompilerTransformation } from "ttsc";

import { searchedReferencedProjects } from "../../tsconfig/searchedReferencedProjects";
import { formatDiagnostics } from "../diagnostics/formatDiagnostics";
import { formatUnknownError } from "../diagnostics/formatUnknownError";
import { TtscMissingProgramOutputError } from "../errors/TtscMissingProgramOutputError";
import { toProjectKey } from "../project/toProjectKey";
import { createEnvelopeKeyIndex } from "./createEnvelopeKeyIndex";
import { derivationIdentity } from "./derivationIdentity";
import { envelopeDerivation } from "./envelopeDerivation";

/**
 * Extract the transformed source for a single file from the compiler result.
 *
 * Throws on compiler exception or hard failure so the bundler surfaces the
 * error to the user. On success, tries a fast exact-match lookup by
 * project-relative key first, then falls back to a resolve-based scan for the
 * rare case where the key in `result.typescript` uses an absolute or
 * differently-cased path.
 */
export function selectTransformedSource(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  tsconfig: string;
}): string {
  if (props.result.type === "exception") {
    throw new Error(formatUnknownError(props.result.error));
  }
  if (props.result.type === "failure") {
    throw new Error(formatDiagnostics(props.result.diagnostics));
  }

  // Fast path: the compiler key matches the normalised project-relative path.
  const state = envelopeDerivation(props);
  const key = toProjectKey(
    props.projectRoot,
    props.file,
    state.identityContext,
  );
  const direct = props.result.typescript[key];
  if (direct !== undefined) {
    return direct;
  }
  // Slow path: the first-match identity index of the envelope's `typescript`
  // keys, built once per generation instead of scanned per delivery.
  const index = (state.outputIndex ??= createEnvelopeKeyIndex(
    state,
    props.projectRoot,
    props.result.typescript,
  ));
  const source = index.get(derivationIdentity(state, props.file));
  if (source !== undefined) {
    return source;
  }
  throw new TtscMissingProgramOutputError(
    props.file,
    props.tsconfig,
    searchedReferencedProjects(props.tsconfig),
  );
}
