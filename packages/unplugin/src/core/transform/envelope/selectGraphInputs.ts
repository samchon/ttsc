import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import type { TtscEnvelopeGraphIndexes } from "./TtscEnvelopeGraphIndexes";
import { selectReachableEdges } from "./selectReachableEdges";

/**
 * Flatten the host-owned reference graph for one file into absolute paths.
 *
 * The full contribution is the reachability closure of `edges` starting at the
 * file, plus every global-scope file and the config chain. Flattening direct
 * edges into a per-file list happens here — at the adapter boundary — because
 * bundler `fileDependencies` snapshots are flat; the protocol itself carries
 * only direct edges.
 *
 * `complete` drops the reach and globals halves, keeping only the universal
 * config chain: the caller established that the plugin declared its own
 * `dependencies[file]` list the complete replacement for them. Returns an empty
 * list on exceptions or without a graph.
 *
 * @evidence contracts/common.md#principled-implementation The direct-edge reachability closure plus globals forms the ordinary language-semantic bound, while explicit completeness drops only those two categories and preserves the universal config chain.
 * @evidence contracts/common.md#clear-and-simple-design One completeness branch chooses graph contributions and selectReachableEdges owns traversal; resolver and plugin inputs remain separate selectors because their ownership differs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Narrowing requires the caller's established completeness premise and does not silently discard configs or fabricate edges when a graph is absent.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why flat bundler inputs are derived at this boundary, the exact completeness effect and empty outcomes; acknowledgment spacing follows the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Graph paths are already native absolute spellings from the shared builder, and physical reachability identity belongs to its filesystem context; this selector introduces no additional separator or case policy.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Complete declarations copy only the config list. Otherwise the delegated
 *   closure scans every reached adjacency entry and queries native identities,
 *   then this function copies reached targets, globals and configs. Cost
 *   includes key/path text and cold native observations, not just returned
 *   members. The closure's temporary state and this output grow with their
 *   respective visited and selected populations.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function selectGraphInputs(
  graph: TtscEnvelopeGraphIndexes,
  state: TtscEnvelopeDerivation,
  props: {
    complete: boolean;
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
  },
): string[] {
  if (props.result.type === "exception" || props.result.graph === undefined) {
    return [];
  }
  const output: string[] = [];
  if (!props.complete) {
    for (const entryToAppend of selectReachableEdges(graph, state, props.file)) output.push(entryToAppend);
    for (const entryToAppend of graph.globals) output.push(entryToAppend);
  }
  for (const entryToAppend of graph.configs) output.push(entryToAppend);
  return output;
}
