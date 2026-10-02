import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import type { TtscEnvelopeGraphIndexes } from "./TtscEnvelopeGraphIndexes";
import { derivationIdentity } from "./derivationIdentity";

/**
 * Walk the reachability closure of the graph's direct `edges` from `file`,
 * returning the absolute path of every file reached (the starting file itself
 * excluded, even when a cycle points back at it). Reads the shared per-envelope
 * edge index instead of rebuilding it per delivery.
 *
 * Traversal coalesces physical vertices using the supplied generation context;
 * the first reached target spelling is retained. The starting identity is
 * marked before traversal, so cycles never reintroduce it into the output.
 *
 * @evidence contracts/common.md#principled-implementation A depth-first worklist and identity visited set enumerate each reachable vertex once; premarking the start removes it even when a cycle returns to the same file through an alias.
 * @evidence contracts/common.md#clear-and-simple-design One local stack, visited set and output array expose closure traversal over the already-built adjacency map; graph parsing and identity semantics remain with their owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cycle prevention follows visited identity rather than a depth cap, retry chain or special source name; target spellings are taken from actual graph edges.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state starting-file exclusion, shared indexing, physical vertex equivalence and first-target spelling, with acknowledgment separation under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Every queried source or target spelling passes through the generation's native identity context. Cold spellings can require realpath, ancestor and actual case observations; this traversal does not replace that boundary with lexical equality or an OS-name case rule. The supplied absolute spellings and context must describe the same stable generation view.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The traversal retains no history or handles; its returned array is caller-owned and its stack and visited set are local to one invocation.
 * @evidence contracts/performance.md#efficient-algorithms Each reached identity is popped once and each reached adjacency entry scanned once, giving V + E structural operations. Identity and Map/Set queries also pay spelling/key text hashing or comparison, and cold spellings add native path/ancestor/case observations. Stack, visited identities and output grow with reached vertices and retained text; duplicate edge spellings still require identity queries.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This closure operation owns no cross-request cache; selectWatchInputs owns final per-spelling reuse and envelopeGraphIndexes owns shared adjacency reuse.
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
