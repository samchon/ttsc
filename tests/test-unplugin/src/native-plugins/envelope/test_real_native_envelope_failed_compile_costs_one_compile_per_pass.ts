import assert from "node:assert/strict";
import path from "node:path";

import { cachedGeneration } from "../../internal/transform-terminal-verdict/cachedGeneration";
import { startFailingCompile } from "../../internal/transform-terminal-verdict/startFailingCompile";

/**
 * Verifies samchon/ttsc#1303: a failed compile costs one compile per pass, not
 * one per delivered module.
 *
 * A pass settles every delivery against the state it started from, so an
 * attempt the pass already made is part of that state. Evicting it instead made
 * each remaining module repeat the whole-project transform only to reach the
 * identical answer, which on a real project turns one broken save into a build
 * measured in hours.
 *
 * Generation identity is the observation rather than a compile counter on
 * purpose: a compile that fails never reaches the fixture's `ApplyProgram`, so
 * its run log cannot count it. The cached promise staying the same object is
 * the direct evidence that no second compilation was started.
 *
 * This also pins the limit of the retention. A host that opens exactly one pass
 * for its whole process, which Bun's runtime plugin and a dev server with
 * `server.watch: null` both do, never reaches the boundary that drops a
 * verdict, so what this scenario measures across four deliveries is what such a
 * session gets for its lifetime. That is deliberate: both hosts publish their
 * session as immutable, and the alternative is the whole-project compile per
 * module that this replaces.
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
