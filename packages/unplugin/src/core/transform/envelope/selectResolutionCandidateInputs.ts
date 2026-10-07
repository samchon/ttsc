import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import type { TtscEnvelopeGraphIndexes } from "./TtscEnvelopeGraphIndexes";
import { derivationIdentity } from "./derivationIdentity";
import { selectReachableSources } from "./selectReachableSources";

/**
 * Return exact importer-owned and universal resolver inputs for `file`. They
 * remain host-owned even when a plugin declares `dependenciesComplete`: plugin
 * code cannot vouch for a compiler resolution or automatic type change that
 * occurs without any plugin input changing.
 *
 * Importer entries and their source identities come from the shared
 * per-envelope state. Selection traverses the reachable importers and scans
 * recorded candidate entries without repeating compiler module resolution;
 * newly queried path spellings can still require native identity observations.
 *
 * @evidence contracts/common.md#principled-implementation Universal resolver inputs always contribute, and importer-owned candidate lists contribute only when their source identity belongs to the delivered file's reachable source closure, including the file itself.
 * @evidence contracts/common.md#clear-and-simple-design Source closure, universal input copying and importer membership filtering are distinct stages over shared indexes; compiler resolution is not repeated here.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Plugin completeness cannot suppress compiler-owned resolver inputs, and absent graph/exception results produce no guessed resolution paths or substituted compiler answers.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain host ownership, completeness independence and shared importer identities; acknowledgment separation follows the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Reachable importer selection and its membership keys use derivationIdentity with the generation's native context. Cold spellings may read realpath, ancestor and actual case observations; candidate list spellings remain as recorded native absolute paths. Selection neither substitutes an OS-name case policy nor repeats compiler resolution, and requires the same stable generation view as its indexes.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Local reachable and output containers belong to one selection; no persistent state or watcher handles are acquired, and the returned array belongs to its caller.
 * @evidence contracts/performance.md#efficient-algorithms Reachable-source traversal pays visited V + E structural work plus spelling/key text and cold native identity observations. Mapping those sources allocates another V-entry array before the membership set; one candidate-entry scan then appends universal and selected list members. Temporary arrays, sets and output scale with reachable sources, universal inputs, selected inputs and their retained text, without compiler module resolution.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This selector owns no request memo; shared candidate parsing belongs to envelopeGraphIndexes and final per-module list reuse belongs to selectWatchInputs.
 */
export function selectResolutionCandidateInputs(
  graph: TtscEnvelopeGraphIndexes,
  state: TtscEnvelopeDerivation,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
  },
): string[] {
  if (props.result.type === "exception" || props.result.graph === undefined) {
    return [];
  }
  const reachable = new Set(
    selectReachableSources(graph, state, props.file).map((source) =>
      derivationIdentity(state, source),
    ),
  );
  const output: string[] = [...graph.resolutionInputs];
  if (props.result.graph.candidates === undefined) return output;
  for (const entry of graph.candidates) {
    if (!reachable.has(entry.source)) {
      continue;
    }
    for (const entryToAppend of entry.files) output.push(entryToAppend);
  }
  return output;
}
