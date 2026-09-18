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
    output.push(...entry.files);
  }
  return output;
}
