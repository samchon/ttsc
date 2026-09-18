import assert from "node:assert/strict";
import path from "node:path";

import { cachedGeneration } from "../../internal/transform-terminal-verdict/cachedGeneration";
import { startFailingCompile } from "../../internal/transform-terminal-verdict/startFailingCompile";

/**
 * Verifies a failed compile costs one compile per pass, not one per delivered
 * module (samchon/ttsc#1303).
 *
 * A pass settles every delivery against the state it started from, so an
 * attempt the pass already made is part of that state. Evicting it instead made
 * each remaining module repeat the whole-project transform only to reach the
 * identical answer. A failing compile never reaches the fixture's run log, so
 * generation identity is the evidence: the cached promise staying the same
 * object proves no second compilation started. A host that opens one pass for
 * its whole process, Bun's runtime plugin or a watcherless dev server, gets
 * this verdict for its lifetime, which is deliberate since both publish their
 * session as immutable.
 *
 * 1. Open a pass over a project that fails to compile, and deliver its first
 *    module.
 * 2. Deliver every remaining module.
 * 3. Assert each rejects with the same diagnostic and replays the same cached
 *    generation.
 */
export async function test_real_native_envelope_failed_compile_costs_one_compile_per_pass(): Promise<void> {
  const { api, cache, deliver, modules } = await startFailingCompile();
  api.beginTtscTransformBuild(cache);
  try {
    await assert.rejects(() => deliver(modules[0]!), /is not assignable/);
    const verdict = cachedGeneration(cache);

    for (const file of modules.slice(1)) {
      await assert.rejects(() => deliver(file), /is not assignable/);
      assert.equal(
        cachedGeneration(cache),
        verdict,
        `delivering ${path.basename(file)} must replay the pass verdict rather than start a second compile`,
      );
    }
  } finally {
    api.resetTtscTransformCache(cache);
  }
}
