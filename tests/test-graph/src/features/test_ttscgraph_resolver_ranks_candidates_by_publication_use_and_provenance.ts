import assert from "node:assert/strict";

import { resolveGraphHandle } from "../../../../packages/graph/src/server/resolveHandle";
import { createSyntheticGraph } from "../internal/resolverGraph";

/**
 * Verifies resolver ranking weighs publication, use and provenance rather than
 * visitation or identity order.
 *
 * An ambiguous name should open on the declaration a caller most likely means:
 * the one the package publishes through several barrels, then the exported one,
 * then one the codebase calls, then an unreferenced authored one, with
 * test-path and dependency declarations last. Identity order would give a
 * different sequence, so the expected order can only come from the scores.
 *
 * 1. Declare `Handler` six times: re-exported through three barrels, flagged
 *    exported, called once, unreferenced, under a test directory and external.
 * 2. Resolve the bare name.
 * 3. Require the literal order barrel-exported, exported flag, called,
 *    unreferenced, test path, external.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveGraphHandle must return the six Handler declarations in the literal order barrel-exported, exported flag, called, unreferenced, test-path, external.
 * @evidence contracts/testing.md#independent-expectations The order follows from the documented ranking policy (published surface first, then how much leans on the node, test and dependency declarations last) applied to authored edges and flags; the authored ids are chosen so alphabetical identity order differs from the expected order, which only the scores can produce.
 * @evidence contracts/testing.md#distinguishing-cases Each adjacent pair differs in one ranking property: export edges against the exported flag, the flag against use, use against none, a source path against a test path, and a test path against a dependency; the numeric weights and equal-score ties are owned by the tie-break test.
 * @evidence contracts/testing.md#execution-ownership The src/features export calls the resolver over an in-memory synthetic dump in the unit process; no producer, session or host is started.
 */
export function test_ttscgraph_resolver_ranks_candidates_by_publication_use_and_provenance(): void {
  const handler = (file: string, extra: object = {}) => ({
    id: `${file}#Handler:class`,
    kind: "class" as const,
    name: "Handler",
    file,
    external: false,
    ...extra,
  });
  const helper = (file: string) => ({
    id: `${file}#helper:function`,
    kind: "function" as const,
    name: "helper",
    file,
    external: false,
  });
  const graph = createSyntheticGraph(
    [
      handler("test/a.test.ts"),
      handler("src/z-unused.ts"),
      handler("src/y-called.ts"),
      handler("src/x-flag.ts", { exported: true }),
      handler("src/w-barrels.ts"),
      handler("src/b-dependency.ts", { external: true }),
      helper("src/index-1.ts"),
      helper("src/index-2.ts"),
      helper("src/index-3.ts"),
      helper("src/user.ts"),
    ],
    [
      ...["src/index-1.ts", "src/index-2.ts", "src/index-3.ts"].map((file) => ({
        from: `${file}#helper:function`,
        to: "src/w-barrels.ts#Handler:class",
        kind: "exports" as const,
      })),
      {
        from: "src/user.ts#helper:function",
        to: "src/y-called.ts#Handler:class",
        kind: "calls" as const,
      },
    ],
  );
  const resolved = resolveGraphHandle(graph, "Handler");
  assert.deepStrictEqual(
    resolved.candidates?.map((candidate) => candidate.id),
    [
      "src/w-barrels.ts#Handler:class",
      "src/x-flag.ts#Handler:class",
      "src/y-called.ts#Handler:class",
      "src/z-unused.ts#Handler:class",
      "test/a.test.ts#Handler:class",
      "src/b-dependency.ts#Handler:class",
    ],
  );
}
