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
import { selectPluginSourceInputs } from "./selectPluginSourceInputs";
import { selectResolutionCandidateInputs } from "./selectResolutionCandidateInputs";

/**
 * Compute one file's watch-input list over the shared per-envelope state.
 *
 * Plugin, resolver and host inputs retain distinct lexical aliases, since a
 * symlink retarget can change one spelling independently of another. Graph
 * reachability inputs coalesce by physical identity. The delivered file,
 * temporary configuration and scratch inputs are excluded in their respective
 * spelling or identity domain.
 *
 * The supplied file identity must come from this state's context. The caller
 * owns memoization of the final ordered array; this operation only constructs it.
 *
 * @evidence contracts/common.md#principled-implementation Separate lexical and physical seen sets preserve alias-sensitive inputs while coalescing realized graph files; completeness narrows graph inputs only when the same file is not declared volatile.
 * @evidence contracts/common.md#clear-and-simple-design Two local append policies make the different equivalence domains explicit, while specialized selectors own dependency, graph, resolver, host and plugin-source selection.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Temporary and scratch exclusions refer to generated implementation inputs, and contradictory completeness/volatility retains the conservative bound instead of compensating for missing producer evidence.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain alias preservation, exclusions, the identity precondition and memo ownership; they stay separate from acknowledgment tags under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve establishes lexical names and derivationIdentity uses the shared filesystem context for physical names; neither case folding nor separators are guessed from an OS label.
 * @evidence contracts/performance.md#efficient-algorithms
 *   First use can build the shared graph and declaration/key indexes; selection
 *   then traverses reachable edges/importers and scans selected dependency,
 *   resolver, host and plugin lists. Each appended occurrence pays native
 *   lexical path/scratch checks and keyed text queries, with cold physical
 *   spellings adding native identity observations. Local sets and output grow
 *   with selected inputs and their text; delegated temporary populations remain
 *   part of this computation rather than disappearing behind append helpers.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Lexical duplicates share one emitted entry, while distinct lexical aliases
 *   remain separate. Graph inputs reuse an already-emitted physical identity.
 *   Generation state shares parsed indexes and qualified identity observations;
 *   the caller selectWatchInputs owns completed per-spelling list reuse under
 *   fixed result/root/options and a stable native identity view.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Local sets retain no invocation history or handles. The returned array is
 *   transferred to the caller, which owns its storage and memo lifetime;
 *   generation state owns the shared indexes and identity observations.
 */
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
  // A plugin's Go source is a universal input of every module, observed as a
  // whole subtree (samchon/ttsc#1487).
  for (const input of selectPluginSourceInputs(props.result).keys())
    appendLexical(input);
  return output;
}
