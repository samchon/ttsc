import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies native transform decoding tolerates malformed `graph` and `volatile`
 * envelope fields: invalid members are dropped, well-formed adjacency keys and
 * proof-failure reasons survive, and the transform itself never fails.
 *
 * The graph and volatile fields are advisory invalidation metadata with the
 * same tolerance contract as `dependencies` (samchon/ttsc#716): a buggy plugin
 * envelope must degrade to fewer watch registrations, not to a failed build.
 * Whole-field validation would also be wrong — one malformed edge must not
 * discard the sound remainder of the graph.
 *
 * 1. Serialize the shared malformedAdvisory envelope, whose graph carries empty keys, non-list edges, a non-list globals, a non-string config and malformed hash, observation, proof-failure and realpath entries, and whose volatile is not a list.
 * 2. Decode it with parseNativeTransformOutput, which must not throw.
 * 3. Assert the retained graph deep-equals the literal expected value and volatile is undefined.
 *
 * @evidence contracts/testing.md#behavioral-verification Decodes mixed graph observations and checks the complete literal retained graph, malformed/conflicting proof-failure reasons and absent malformed volatile section.
 * @evidence contracts/testing.md#independent-expectations Independently authored valid source edges, config path, SHA256-shaped content and missing-state observations define retained values; invalid booleans and mutually true file/directory observations define exact failure reasons.
 * @evidence contracts/testing.md#distinguishing-cases One valid edge survives beside an invalid list and an all-invalid leaf that remains a node. Empty keys, malformed hash/realpath/reason entries and malformed volatile are filtered while valid missing-state/null witnesses remain.
 * @evidence contracts/testing.md#execution-ownership A unit test calling parseNativeTransformOutput on in-memory JSON; graph metadata is only decoded here, not compared with the disk, and no native producer or host runs.
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
