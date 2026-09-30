import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";

/**
 * Verifies native reference-graph candidates retain their importer and order.
 *
 * Candidate metadata identifies superseding resolution targets. The decoder
 * must preserve that ordered positive population rather than dropping a valid
 * field while accepting the rest of the graph. Native transport uses the same
 * payload in the shared one-project envelope batch.
 *
 * 1. Decode a valid source envelope carrying candidates and the original graph.
 * 2. Assert the complete candidate, config, edge and global map unchanged.
 *
 * @evidence contracts/testing.md#behavioral-verification parseNativeTransformOutput retains the candidate map keyed by importing file and all original graph fields.
 * @evidence contracts/testing.md#independent-expectations The native envelope contract preserves producer-reported candidate priority; independently authored literal graph values are the oracle.
 * @evidence contracts/testing.md#distinguishing-cases Two ordered superseding candidates remain distinct from the absence of candidates owned by the existing graph unit; config, resolved edge and global values remain intact.
 * @evidence contracts/testing.md#execution-ownership The named source-unit function runs under src/unit/api and calls the authored decoder directly; the same payload crosses real native transport in the one-project E2E batch.
 */
export function test_ttsccompiler_transform_surfaces_superseding_resolution_candidates() {
  const result = parseNativeTransformOutput(JSON.stringify({
    typescript: { "src/main.ts": 'export const value = "PLUGIN";\nconsole.log(value);\n' },
    graph: {
      candidates: { "src/main.ts": ["src/mytype.ts", "src/mytype.tsx"] },
      configs: ["tsconfig.json"],
      edges: { "src/main.ts": ["src/mytype.ts"] },
      globals: ["src/ambient.d.ts"],
    },
  }), "");
  assert.deepEqual(result.graph, {
    candidates: { "src/main.ts": ["src/mytype.ts", "src/mytype.tsx"] },
    configs: ["tsconfig.json"],
    edges: { "src/main.ts": ["src/mytype.ts"] },
    globals: ["src/ambient.d.ts"],
  });
}
