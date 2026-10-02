import type { ITtscCompilerTransformation } from "ttsc";

import { searchedReferencedProjects } from "../../tsconfig/searchedReferencedProjects";
import { formatDiagnostics } from "../diagnostics/formatDiagnostics";
import { formatUnknownError } from "../diagnostics/formatUnknownError";
import { TtscCompileFailureError } from "../errors/TtscCompileFailureError";
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
 *
 * @evidence contracts/common.md#principled-implementation The matched producer key selects both transformed text and its own source map, preventing provenance from another alias entry; exception/failure results and missing program output raise their distinct supported errors.
 * @evidence contracts/common.md#clear-and-simple-design Result discrimination precedes lookup, a local output adapter binds code to map, and the shared identity index isolates alternate-spelling lookup from error reporting.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fallback supports real producer key spelling differences with first-match precedence; absent output is reported rather than synthesized from original source or a different module's map.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe source/map coupling, error behavior and exact versus identity lookup; the acknowledgment block follows the documentation skill's spacing guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Project key matching and alternate key identities use the envelope's filesystem context, so physical aliases and native case behavior are not guessed from lowercased strings.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One key per physical output identity is retained in weakly owned envelope state; returned artifacts reference generation output, and this selector owns no independent handle or cross-generation history.
 * @evidence contracts/performance.md#efficient-algorithms Exact record lookup is the common path; a miss builds the output-key index once in O(number of output keys), and subsequent misses use keyed identity access instead of rescanning every output.
 * @evidence contracts/performance.md#reuse-equivalent-work The output index is reused only for the same immutable generation and project root; text and maps remain coupled by the saved producer key, not by an inferred equality of their contents.
 */
export function selectTransformedSource(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
  tsconfig: string;
}): TtscTransformedOutput {
  if (props.result.type === "exception") {
    throw new TtscCompileFailureError(formatUnknownError(props.result.error));
  }
  if (props.result.type === "failure") {
    throw new TtscCompileFailureError(
      formatDiagnostics(props.result.diagnostics),
    );
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
