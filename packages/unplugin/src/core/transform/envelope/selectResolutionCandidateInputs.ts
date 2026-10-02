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
 * per-envelope state, so one delivery scans only the recorded inputs instead of
 * re-resolving every source.
 *
 * @evidence contracts/common.md#principled-implementation Universal resolver inputs always contribute, and importer-owned candidate lists contribute only when their source identity belongs to the delivered file's reachable source closure, including the file itself.
 * @evidence contracts/common.md#clear-and-simple-design Source closure, universal input copying and importer membership filtering are distinct stages over shared indexes; compiler resolution is not repeated here.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Plugin completeness cannot suppress compiler-owned resolver inputs, and absent graph/exception results produce no guessed resolution paths or substituted compiler answers.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain host ownership, completeness independence and shared importer identities; acknowledgment separation follows the documentation skill.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Selects recorded candidate lists through the shared index and identity strings; no filesystem is read.
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
