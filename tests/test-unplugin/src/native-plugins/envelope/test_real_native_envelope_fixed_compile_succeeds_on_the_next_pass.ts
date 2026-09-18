import assert from "node:assert/strict";
import fs from "node:fs";

import { startFailingCompile } from "../../internal/transform-terminal-verdict/startFailingCompile";

/**
 * Verifies a corrected project compiles again on the next pass.
 *
 * Retention must never become a dead end. Recovery arrives at the pass boundary
 * rather than through a special case, and the corrected delivery has to produce
 * real output rather than merely a different verdict.
 *
 * 1. Open a pass and deliver a module of a failing project.
 * 2. Fix the broken file and open a new pass.
 * 3. Deliver the module again and assert it transforms.
 */
export async function test_real_native_envelope_fixed_compile_succeeds_on_the_next_pass(): Promise<void> {
  const { api, brokenFile, cache, deliver, modules } =
    await startFailingCompile();
  try {
    api.beginTtscTransformBuild(cache);
    await assert.rejects(() => deliver(modules[0]!), /is not assignable/);

    fs.writeFileSync(brokenFile, "export const broken: number = 1;\n", "utf8");
    api.beginTtscTransformBuild(cache);
    const recovered = await deliver(modules[0]!);
    assert.ok(recovered, "the corrected project must transform");
  } finally {
    api.resetTtscTransformCache(cache);
  }
}
