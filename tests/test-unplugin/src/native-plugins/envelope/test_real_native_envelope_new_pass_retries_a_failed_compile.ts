import assert from "node:assert/strict";

import { cachedGeneration } from "../../internal/transform-terminal-verdict/cachedGeneration";
import { startFailingCompile } from "../../internal/transform-terminal-verdict/startFailingCompile";

/**
 * Verifies the next pass drops the verdict and attempts the compile again.
 *
 * A pass verdict is bounded by the pass that produced it, and deliberately not
 * proven against a recorded environment: project diagnostics and opaque host
 * exceptions both settle the attempt without claiming permanent failure. A new
 * pass is the first boundary at which the host itself claims something may have
 * changed, so the attempt is repeated there — which is what keeps a genuinely
 * transient failure from becoming permanent, at a bounded cost of one compile
 * per pass.
 */
export async function test_real_native_envelope_new_pass_retries_a_failed_compile(): Promise<void> {
  const { api, cache, deliver, modules } = await startFailingCompile();
  try {
    api.beginTtscTransformBuild(cache);
    await assert.rejects(() => deliver(modules[0]!), /is not assignable/);
    const first = cachedGeneration(cache);

    api.beginTtscTransformBuild(cache);
    await assert.rejects(() => deliver(modules[0]!), /is not assignable/);
    const second = cachedGeneration(cache);
    assert.notEqual(
      second,
      first,
      "a new pass must attempt the compile again rather than replay the previous pass's verdict",
    );

    for (const file of modules.slice(1)) {
      await assert.rejects(() => deliver(file), /is not assignable/);
      assert.equal(
        cachedGeneration(cache),
        second,
        "the rest of the second pass must replay that pass's own verdict",
      );
    }
  } finally {
    api.resetTtscTransformCache(cache);
  }
}
