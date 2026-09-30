import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies TtscCompiler.transform tolerates malformed `graph` and `volatile`
 * envelope fields: invalid members are dropped, well-formed adjacency keys and
 * proof-failure reasons survive, and the transform itself never fails.
 *
 * The graph and volatile fields are advisory invalidation metadata with the
 * same tolerance contract as `dependencies` (samchon/ttsc#716): a buggy plugin
 * envelope must degrade to fewer watch registrations, not to a failed build.
 * Whole-field validation would also be wrong — one malformed edge must not
 * discard the sound remainder of the graph.
 *
 * 1. Decode the original native wire input directly through the production decoder.
 * 2. Assert the retained fields or exact rejection below.
 * 3. The real Go transport batch retains API result and no-publication boundaries.
 */
export const test_ttsccompiler_transform_drops_malformed_graph_members_and_volatile =
  () => {
    const result = parseNativeTransformOutput(
      JSON.stringify(NativeTransformEnvelopeFixture.malformedAdvisory),
      "",
    );

    assert.deepEqual(result.graph, {
      configs: ["tsconfig.json"],
      edges: {
        "src/main.ts": ["src/good.d.ts"],
        "src/worse.ts": [],
      },
      globals: [],
      inputHashes: {
        "src/good.d.ts": "a".repeat(64),
        "src/missing.d.ts": null,
      },
      inputObservations: {
        "src/good.d.ts": { fileExists: true },
        "src/missing.d.ts": {
          directoryExists: true,
          fileExists: false,
        },
      },
      inputProofFailures: {
        "src/bad.d.ts": "malformed-observation",
        "src/missing.d.ts": "content-unavailable",
        "src/worse.d.ts": "conflicting-observation",
      },
      inputRealpaths: {
        "src/good.d.ts": null,
        "src/missing.d.ts": null,
      },
    });
    assert.equal(result.volatile, undefined);
  };
