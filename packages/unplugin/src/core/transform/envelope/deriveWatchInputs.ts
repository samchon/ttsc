import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import { deriveWatchInputsFromIndexes } from "./deriveWatchInputsFromIndexes";
import { envelopeGraphIndexes } from "./envelopeGraphIndexes";
import { selectPluginSourceInputs } from "./selectPluginSourceInputs";

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
 * owns memoization of the final ordered array; this operation only constructs
 * it.
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
  if (props.result.type === "exception") return [];
  return deriveWatchInputsFromIndexes(
    state,
    envelopeGraphIndexes(state, props),
    props,
    props.result,
    selectPluginSourceInputs(props.result).keys(),
    fileIdentity,
  );
}
