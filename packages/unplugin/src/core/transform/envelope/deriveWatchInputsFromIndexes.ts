import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { isTransformScratchInput } from "../tsconfig/isTransformScratchInput";
import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import type { TtscEnvelopeGraphIndexes } from "./TtscEnvelopeGraphIndexes";
import { declaresCompleteDependencies } from "./declaresCompleteDependencies";
import { derivationIdentity } from "./derivationIdentity";
import { isVolatileFile } from "./isVolatileFile";
import { selectFileDependencies } from "./selectFileDependencies";
import { selectGraphInputs } from "./selectGraphInputs";
import { selectHostInputs } from "./selectHostInputs";
import { selectResolutionCandidateInputs } from "./selectResolutionCandidateInputs";

/** Dependency metadata borrowed from a generation by watch routing. */
type Dependencies = Pick<
  ITtscCompilerTransformation.ISuccess | ITtscCompilerTransformation.IFailure,
  | "type"
  | "dependencies"
  | "dependenciesComplete"
  | "hostInputs"
  | "volatile"
  | "workspaceInputs"
>;

/**
 * Derive watch paths using only the indexed graph and dependency metadata.
 *
 * @evidence contracts/common.md#principled-implementation The ordinary and grouped routes share every selection, exclusion and deduplication rule.
 * @evidence contracts/common.md#clear-and-simple-design Index preparation and watch selection have separate inputs so a watch group can borrow the latter.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Reads indexed graph and compiler-declared dependencies without reconstructing an envelope.
 * @evidence contracts/common.md#meaningful-documentation Names the retained metadata and shared selection.
 * @evidence contracts/portability.md#os-neutral-implementation Uses native spelling and the supplied identity context.
 * @evidence contracts/performance.md#efficient-algorithms Traverses selected graph paths and scans the resolution candidates. A first dependency selection can build the producer dependency-key index. Output and graph preparation remain with the caller.
 * @evidence contracts/performance.md#reuse-equivalent-work The supplied state shares identity and declaration indexes and the supplied graph is reused.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each call owns its transient sets and result array and retains no compiler payload.
 */
export function deriveWatchInputsFromIndexes(
  state: Pick<
    TtscEnvelopeDerivation,
    "identityContext" | "identities" | "selection"
  >,
  graph: Pick<
    TtscEnvelopeGraphIndexes,
    | "edges"
    | "spellings"
    | "candidates"
    | "globals"
    | "configs"
    | "resolutionInputs"
  >,
  props: {
    file: string;
    projectRoot: string;
    scratchDirectory?: string;
    temporaryTsconfig?: string;
  },
  result: Dependencies,
  pluginSourceInputs: Iterable<string>,
  fileIdentity: string,
): string[] {
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
  const dependencyProps = { ...props, result };
  for (const input of selectFileDependencies(state, props, result.dependencies))
    appendLexical(input);
  for (const input of selectGraphInputs(graph, state, {
    file: props.file,
    complete:
      declaresCompleteDependencies(state, dependencyProps) &&
      !isVolatileFile(state, dependencyProps),
  }))
    appendPhysical(input);
  // Resolver inputs, plugin dependencies, and universal host inputs
  // preserve lexical aliases. Physical deduplication would collapse
  // `alias/selection.cjs` into the selected target path, so a bundler would
  // watch only the target and miss a symlink/junction retarget.
  for (const input of selectResolutionCandidateInputs(graph, state, props.file))
    appendLexical(input);
  for (const input of selectHostInputs(dependencyProps)) appendLexical(input);
  // A plugin's Go source is a universal input of every module, observed as a
  // whole subtree (samchon/ttsc#1487).
  for (const input of pluginSourceInputs) appendLexical(input);
  return output;
}
