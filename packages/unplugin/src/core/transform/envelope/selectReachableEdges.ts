import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import type { TtscEnvelopeGraphIndexes } from "./TtscEnvelopeGraphIndexes";
import { derivationIdentity } from "./derivationIdentity";

/**
 * Walk the reachability closure of the graph's direct `edges` from `file`,
 * returning the absolute path of every file reached (the starting file itself
 * excluded, even when a cycle points back at it). Reads the shared per-envelope
 * edge index instead of rebuilding it per delivery.
 */
export function selectReachableEdges(
  graph: TtscEnvelopeGraphIndexes,
  state: TtscEnvelopeDerivation,
  file: string,
): string[] {
  const output: string[] = [];
  const visited = new Set<string>([derivationIdentity(state, file)]);
  const queue = [file];
  while (queue.length !== 0) {
    const current = queue.pop()!;
    for (const target of graph.edges.get(derivationIdentity(state, current)) ??
      []) {
      const identity = derivationIdentity(state, target);
      if (visited.has(identity)) {
        continue;
      }
      visited.add(identity);
      queue.push(target);
      output.push(target);
    }
  }
  return output;
}
