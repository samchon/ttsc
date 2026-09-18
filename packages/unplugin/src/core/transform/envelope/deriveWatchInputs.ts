import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { isTransformScratchInput } from "../tsconfig/isTransformScratchInput";
import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import { declaresCompleteDependencies } from "./declaresCompleteDependencies";
import { derivationIdentity } from "./derivationIdentity";
import { envelopeGraphIndexes } from "./envelopeGraphIndexes";
import { isVolatileFile } from "./isVolatileFile";
import { selectFileDependencies } from "./selectFileDependencies";
import { selectGraphInputs } from "./selectGraphInputs";
import { selectHostInputs } from "./selectHostInputs";
import { selectResolutionCandidateInputs } from "./selectResolutionCandidateInputs";

/** Compute one file's watch-input list over the shared per-envelope state. */
export function deriveWatchInputs(
  state: TtscEnvelopeDerivation,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
    scratchDirectory?: string;
    temporaryTsconfig?: string;
  },
  fileIdentity: string,
): string[] {
  const graph = envelopeGraphIndexes(state, props);
  const output: string[] = [];
  const physicalSeen = new Set<string>();
  const lexicalSeen = new Set<string>();
  const excluded = new Set([fileIdentity]);
  if (props.temporaryTsconfig !== undefined) {
    excluded.add(derivationIdentity(state, props.temporaryTsconfig));
  }
  const currentSpelling = path.resolve(props.file);
  const temporarySpelling =
    props.temporaryTsconfig === undefined
      ? undefined
      : path.resolve(props.temporaryTsconfig);
  const appendLexical = (input: string): void => {
    const spelling = path.resolve(input);
    if (
      spelling === currentSpelling ||
      spelling === temporarySpelling ||
      isTransformScratchInput(spelling, props.scratchDirectory) ||
      lexicalSeen.has(spelling)
    ) {
      return;
    }
    lexicalSeen.add(spelling);
    physicalSeen.add(derivationIdentity(state, input));
    output.push(input);
  };
  const appendPhysical = (input: string): void => {
    if (isTransformScratchInput(input, props.scratchDirectory)) return;
    const identity = derivationIdentity(state, input);
    if (excluded.has(identity) || physicalSeen.has(identity)) return;
    physicalSeen.add(identity);
    lexicalSeen.add(path.resolve(input));
    output.push(input);
  };
  for (const input of selectFileDependencies(props)) appendLexical(input);
  for (const input of selectGraphInputs(graph, state, {
    ...props,
    complete:
      declaresCompleteDependencies(state, props) &&
      !isVolatileFile(state, props),
  }))
    appendPhysical(input);
  // Resolver inputs, plugin dependencies, and universal host inputs
  // preserve lexical aliases. Physical deduplication would collapse
  // `alias/selection.cjs` into the selected target path, so a bundler would
  // watch only the target and miss a symlink/junction retarget.
  for (const input of selectResolutionCandidateInputs(graph, state, props))
    appendLexical(input);
  for (const input of selectHostInputs(props)) appendLexical(input);
  return output;
}
