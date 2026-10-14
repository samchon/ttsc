import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { selectCachedGenerationAction } from "../../../../../packages/unplugin/src/core/transform/cache/selectCachedGenerationAction";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies preparation compares source state without consuming the warning
 * reserved for a divergent module actually delivered by the host.
 *
 * A speculative read can race an edit before its project is compiled. Host
 * rewrite warnings belong to actual delivered modules; preparation must
 * preserve the same source-validation decision while leaving those warnings
 * untouched.
 *
 * 1. Compare divergent text against an unchanged native compiled baseline in
 *    preparation mode, requiring serving permission without a warning mark.
 * 2. Deliver the same divergence normally and require its warning mark.
 * 3. Change actual disk bytes and require capture despite warning suppression.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual selectCachedGenerationAction over a native source fixture, observing serve/capture decisions and the generation's actual warning-attempt set. Preparation leaves the set absent, ordinary delivery records its path and changed disk state requests recapture.
 * @evidence contracts/testing.md#independent-expectations Authored delivered text differs from independently fixed disk bytes. The contract reserves host-rewrite reporting for actual delivery while native disk changes invalidate the old baseline; literal actions and absent/present warning-attempt state assert those separate responsibilities.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts preparation and ordinary delivery of identical divergent text, then a true native source change under suppression. Existing action-selection units own volatile, incomplete, missing-pass and replacement-generation cases; native capture E2E owns preparation transport and during-compile races.
 * @evidence contracts/testing.md#execution-ownership This discoverable unit calls the production action selector and source validator directly over a suite-owned native fixture. It installs no consumer, builds no artifact and replaces no foreign method or global. Finally disposes the fixture and its cache resources.
 */
export function test_precompilation_source_comparison_keeps_warnings_for_delivery(): void {
  const fixture = createCachedDeliveryUnitFixture();
  const { cache, key, good, file, source } = fixture;
  const generation = Promise.resolve(good);
  cache.set(key, generation);
  const divergent = source + "// text from another observation\n";
  try {
    const props = {
      cache,
      key,
      cached: good,
      generation,
      file,
      source: divergent,
      epoch: 1,
    };
    assert.equal(
      selectCachedGenerationAction({ ...props, reportDivergence: false }),
      "serve",
    );
    assert.equal(Object.hasOwn(good, "divergentDeliveryReported"), false);
    assert.equal(selectCachedGenerationAction(props), "serve");
    assert.equal(good.divergentDeliveryReported?.has(path.resolve(file)), true);
    fs.writeFileSync(file, "export const actualEdit = 9;\n");
    assert.equal(
      selectCachedGenerationAction({ ...props, reportDivergence: false }),
      "capture",
    );
    assert.equal(cache.has(key), false);
  } finally {
    fixture.dispose();
  }
}
