import assert from "node:assert/strict";

import { startFailingCompile } from "../../internal/transform-terminal-verdict/startFailingCompile";

/**
 * Verifies a host with no pass boundary keeps evicting a failed compile.
 *
 * The retention is scoped to a pass precisely because a long-lived worker has
 * none: Metro and the Turbopack loader must retry on their very next delivery
 * so a transient toolchain failure never becomes permanent for the life of the
 * process. This is the negative twin of the retention above, and the property
 * samchon/ttsc#672 established.
 */
export async function test_real_native_envelope_failed_compile_without_a_pass_is_still_evicted(): Promise<void> {
  const { api, cache, deliver, modules } = await startFailingCompile();
  try {
    await assert.rejects(() => deliver(modules[0]!), /is not assignable/);
    assert.equal(
      cache.size,
      0,
      "without a delivery pass a failed compile must not stay cached",
    );
    await assert.rejects(() => deliver(modules[1]!), /is not assignable/);
    assert.equal(cache.size, 0);
  } finally {
    api.resetTtscTransformCache(cache);
  }
}
