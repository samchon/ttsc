import type { ITtscCompilerTransformation } from "ttsc";

import { searchedReferencedProjects } from "../../tsconfig/searchedReferencedProjects";
import { formatDiagnostics } from "../diagnostics/formatDiagnostics";
import { formatUnknownError } from "../diagnostics/formatUnknownError";
import { TtscMissingProgramOutputError } from "../errors/TtscMissingProgramOutputError";
import { toProjectKey } from "../project/toProjectKey";
import type { TtscTransformedOutput } from "./TtscTransformedOutput";
import { createEnvelopeKeyIndex } from "./createEnvelopeKeyIndex";
import { derivationIdentity } from "./derivationIdentity";
import { envelopeDerivation } from "./envelopeDerivation";

/**
 * Extract the transformed source for a single file from the compiler result,
 * with the source map the envelope carries for the same key.
 *
 * Throws on compiler exception or hard failure so the bundler surfaces the
 * error to the user. On success, tries a fast exact-match lookup by
 * project-relative key first, then falls back to a resolve-based scan for the
 * rare case where the key in `result.typescript` uses an absolute or
 * differently-cased path. The map is read under the key the text was found
 * under, so the two always describe the same envelope entry
 * (samchon/ttsc#1392).
 */
export function selectTransformedSource(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  tsconfig: string;
}): TtscTransformedOutput {
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
  const { sourceMaps, typescript } = props.result;
  const output = (found: string): TtscTransformedOutput => {
    const map =
      sourceMaps !== undefined &&
      Object.prototype.hasOwnProperty.call(sourceMaps, found)
        ? sourceMaps[found]
        : undefined;
    return map === undefined
      ? { code: typescript[found]! }
      : { code: typescript[found]!, map };
  };
  if (Object.prototype.hasOwnProperty.call(typescript, key)) {
    return output(key);
  }
  // Slow path: the first-match identity index of the envelope's `typescript`
  // keys, built once per generation instead of scanned per delivery.
  const index = (state.outputIndex ??= createEnvelopeKeyIndex(
    state,
    props.projectRoot,
    Object.fromEntries(Object.keys(typescript).map((entry) => [entry, entry])),
  ));
  const found = index.get(derivationIdentity(state, props.file));
  if (found !== undefined) {
    return output(found);
  }
  throw new TtscMissingProgramOutputError(
    props.file,
    props.tsconfig,
    searchedReferencedProjects(props.tsconfig),
  );
}
