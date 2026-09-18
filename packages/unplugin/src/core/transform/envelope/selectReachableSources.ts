import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import type { TtscEnvelopeGraphIndexes } from "./TtscEnvelopeGraphIndexes";
import { derivationIdentity } from "./derivationIdentity";

/**
 * Return the source files whose direct graph edges are reachable from `file`,
 * including `file` itself. Resolution candidates belong to importers rather
 * than targets, so this is intentionally distinct from selectReachableEdges.
 */
export function selectReachableSources(
  graph: TtscEnvelopeGraphIndexes,
  state: TtscEnvelopeDerivation,
  file: string,
): string[] {
  const output = [file];
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
      output.push(graph.spellings.get(identity) ?? target);
    }
  }
  return output;
}
