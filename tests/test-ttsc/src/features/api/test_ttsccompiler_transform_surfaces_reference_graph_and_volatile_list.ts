import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies native transform decoding surfaces the envelope's reference graph and
 * volatile list.
 *
 * Implements the consumer half of samchon/ttsc#716: a transform host stamps a
 * `graph` section (direct resolved reference edges, global-scope files,
 * tsconfig chain) and may declare non-hermetic outputs through `volatile`; the
 * programmatic API must pass both through so bundler adapters can derive watch
 * inputs and bypass caching. A host that dropped either field would make sound
 * cache invalidation impossible regardless of what plugins emit.
 *
 * 1. Decode the original native wire input directly through the production decoder.
 * 2. Assert the retained fields or exact rejection below.
 * 3. The real Go transport batch retains API result and no-publication boundaries.
 *
 * @evidence contracts/testing.md#behavioral-verification Decodes the valid native fixture and asserts the complete config/edge/global graph and separate volatile source list with exact path identities.
 * @evidence contracts/testing.md#independent-expectations Literal graph and volatile values authored in the wire fixture define the expected result; the unit does not synthesize dependencies from product graph logic or a generated snapshot.
 * @evidence contracts/testing.md#distinguishing-cases Config-chain, resolved edge, global source and volatile output occupy distinct fields and must all survive. The malformed-graph case owns negative filtering while candidate-order metadata has its own positive case.
 * @evidence contracts/testing.md#execution-ownership This named unit calls parseNativeTransformOutput with in-memory JSON only. It registers no filesystem watches or cache exemptions; actual native transport and consumer invalidation remain separate boundaries.
 */
export const test_ttsccompiler_transform_surfaces_reference_graph_and_volatile_list =
  () => {
    const result = parseNativeTransformOutput(
      JSON.stringify(NativeTransformEnvelopeFixture.valid),
      "",
    );

    assert.deepEqual(result.graph, {
      configs: ["tsconfig.json"],
      edges: { "src/main.ts": ["src/mytype.ts"] },
      globals: ["src/ambient.d.ts"],
    });
    assert.deepEqual(result.volatile, ["src/volatile.ts"]);
  };
