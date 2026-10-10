import assert from "node:assert/strict";

import { selectExternalInputPaths } from "../../../../../packages/unplugin/src/core/transform/envelope/selectExternalInputPaths";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies graph fanout cannot multiply native input classification.
 *
 * Inputs rejected because the project walk covers them still need lexical
 * deduplication. Deduplicating only emitted external names misses this case.
 *
 * 1. Classify one source through a sparse graph and count its native observations.
 * 2. Repeat that source across every producer input category with large fanout.
 * 3. Require identical native work and the same empty external input set.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual selectExternalInputPaths returns no external members for a regular admitted source, and a 1000-occurrence corpus across graph endpoints/globals/configs/candidates/host/dependency lists performs exactly the sparse corpus's native leaf observations.
 * @evidence contracts/testing.md#independent-expectations The fixture's actual source belongs to its include src policy; repeated references name the same lexical address and therefore cannot require more native classification. The sparse observation count is only a cost contrast, not an expected output computed by the selector.
 * @evidence contracts/testing.md#distinguishing-cases Sparse versus high-fanout references and emitted versus rejected walk membership distinguish early lexical deduplication from an output-only seen set. Existing external-input cases own distinct alias and missing-candidate semantics.
 * @evidence contracts/testing.md#execution-ownership Discovered source unit supplies literal graph data and a supported lstat counter over actual fixture files. No compiler, Go peer, watcher or product host is started; finally resets the owned cache.
 */
export function test_shared_graph_inputs_are_classified_once_per_lexical_path(): void {
  const fixture = createCachedDeliveryUnitFixture();
  const observe = (count: number) => {
    let queries = 0;
    const inputs = Array<string>(count).fill("src/main.ts");
    const external = selectExternalInputPaths({
      projectRoot: fixture.good.projectRoot,
      membershipPolicy: fixture.good.membershipPolicy,
      result: { type: "success", typescript: { "src/main.ts": fixture.code },
        dependencies: { "src/main.ts": inputs }, hostInputs: inputs,
        graph: { edges: { "src/main.ts": inputs }, globals: inputs, configs: inputs,
          candidates: { "src/main.ts": inputs }, resolutionInputs: inputs } },
      filesystem: { ...DEFAULT_FILESYSTEM_OPERATIONS,
        lstat(file) { if (file === fixture.file) queries++; return DEFAULT_FILESYSTEM_OPERATIONS.lstat(file); },
      },
    });
    return { external, queries };
  };
  try {
    const sparse = observe(1);
    assert.deepEqual(sparse.external, []);
    assert.ok(sparse.queries > 0);
    const dense = observe(1000);
    assert.deepEqual(dense.external, []);
    assert.equal(dense.queries, sparse.queries);
  } finally { fixture.dispose(); }
}
