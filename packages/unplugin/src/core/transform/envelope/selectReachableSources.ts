import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import type { TtscEnvelopeGraphIndexes } from "./TtscEnvelopeGraphIndexes";
import { derivationIdentity } from "./derivationIdentity";

/**
 * Return the source files whose direct graph edges are reachable from `file`,
 * including `file` itself. Resolution candidates belong to importers rather
 * than targets, so this is intentionally distinct from selectReachableEdges.
 *
 * The first element keeps the caller's spelling of `file`; newly reached
 * identities use the graph's source spelling when available. This includes a
 * source exactly once by physical identity even if cycles or aliases reach it.
 *
 * @evidence contracts/common.md#principled-implementation A depth-first visited-identity traversal includes the start and every reachable importer exactly once, using source spellings so candidate ownership is resolved from importer identity rather than target text.
 * @evidence contracts/common.md#clear-and-simple-design The source-closure selector differs visibly from target-edge selection only in including the start and choosing source spellings, reflecting their distinct consumer semantics.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Physical visited identities handle cycles and aliases without arbitrary traversal cutoffs or importer-name exceptions.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain importer ownership, start inclusion, spelling choice and cycle/alias behavior with separate acknowledgment tags under the documentation skill.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Walks the edge index by the identity strings the envelope's identity context produced; it adds no platform assumption of its own.
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
