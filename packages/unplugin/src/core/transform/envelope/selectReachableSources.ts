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
 * @evidence contracts/portability.md#os-neutral-implementation The start and queried edge spellings use the generation's native identity context, including cold realpath, ancestor and actual case observations. Graph source spellings select presentation after native identity admission; they do not establish identity by lexical text. The supplied absolute spellings and context must represent the same stable generation view.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the caller-owned output array escapes; the worklist and visited set are local, with no retained history, watchers or file handles.
 * @evidence contracts/performance.md#efficient-algorithms Each reached identity is popped once and each reached adjacency entry scanned once, giving V + E structural operations. Spelling/key text hashing or comparison and cold native path/ancestor/case observations add identity costs, including queries for duplicate edge spellings. Stack, visited identities and output retain reached-vertex populations and their text; source spelling selection is one additional Map query per newly reached identity.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This source closure is an invocation-local computation; per-delivery watch-list reuse belongs to selectWatchInputs and generation index reuse belongs to envelopeGraphIndexes.
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
