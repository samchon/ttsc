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
    output.push(...selectReachableEdges(graph, state, props.file));
    output.push(...graph.globals);
  }
  output.push(...graph.configs);
  return output;
}
