import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { cachedGeneration } from "../../../internal/transform-terminal-verdict/cachedGeneration";
import { startFailingCompile } from "../../../internal/transform-terminal-verdict/startFailingCompile";

/**
 * Verifies native diagnostic verdicts across persistent and delivery-pass lifetimes.
 *
 * One linked native contributor and broken program distinguish no-pass eviction,
 * same-pass replay, next-pass retry and corrected-project recovery. Repeating
 * the initial failing capture in three independent projects added no boundary;
 * the already retained verdict supplies the next positive scenario's baseline.
 *
 * 1. Deliver two modules without a pass and assert failure is evicted each time.
 * 2. Open a pass and assert every remaining module replays its one verdict.
 * 3. Open another pass and assert a new verdict then replay across modules.
 * 4. Fix the type error, open a new pass and assert actual transformed output.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual built public adapter and linked native compiler diagnose the broken program, evict without a pass, replay one exact Promise within a pass, replace it on a new pass and transform after a real source correction.
 * @evidence contracts/testing.md#independent-expectations Literal number-versus-string source and assignability diagnostic, zero cache sizes and exact same/different Promise identities specify the independent lifetime oracle; corrected numeric source must actually return transformed output.
 * @evidence contracts/testing.md#distinguishing-cases Persistent no-pass eviction contrasts with per-pass retention; sibling modules repeat the same verdict, a new pass repeats capture with a different Promise, and changed source recovers on the next pass.
 * @evidence contracts/testing.md#execution-ownership One named E2E batch owns all four former terminal-verdict entries and their original assertions; each phase records its failure identity and later independent phases still execute. The real Go contributor and compiler are retained because their diagnostic envelope is the boundary under test.
 * @evidence contracts/e2e.md#necessary-boundary A native linked contributor shares the compiler's actual program and returns structured diagnostic failure; the executable sidecar fixture cannot stand in because it does not type-check. Real successful recovery confirms the changed source reaches that same connection.
 * @evidence contracts/e2e.md#shared-execution One fixture root, linked contributor artifact, options, cache and module corpus serve all phases. The no-pass negative requires two actual attempts, two failed pass captures establish different verdicts, and one corrected capture establishes recovery; repeated initial seeds are replaced by actual retained verdicts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The broken source and options remain fixed until the recovery phase; reset after the no-pass phase clears any failed residual state before opening a pass. Positive phases intentionally share the exact retained verdict; only explicit new-pass boundaries request another capture, and finally releases the cache after success or failure.
 * @evidence contracts/e2e.md#preserved-coverage Every original rejection, cache-empty, exact cached-Promise replay/replacement and recovered-result assertion remains in its corresponding phase. No-pass behavior stays actual E2E, and phase errors are aggregated rather than allowing the first assertion failure to hide later independent cases.
 */
export async function test_real_native_envelope_terminal_verdict_batch(): Promise<void> {
  const { api, brokenFile, cache, deliver, modules } = await startFailingCompile();
  const failures: Error[] = [];
  const phase = async (label: string, run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (error) {
      failures.push(new Error(label, { cause: error }));
    }
  };
  try {
    await phase("no-pass eviction", async () => {
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
    });
    await phase("same-pass replay", async () => {
      api.beginTtscTransformBuild(cache);
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
    });
    await phase("next-pass replacement", async () => {
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
    });
    await phase("corrected next-pass recovery", async () => {
      await assert.rejects(() => deliver(modules[0]!), /is not assignable/);

      fs.writeFileSync(brokenFile, "export const broken: number = 1;\n", "utf8");
      api.beginTtscTransformBuild(cache);
      const recovered = await deliver(modules[0]!);
      assert.ok(recovered, "the corrected project must transform");
    });
    if (failures.length !== 0) {
      throw new AggregateError(failures, "Native terminal verdict batch failed");
    }
  } finally {
    api.resetTtscTransformCache(cache);
  }
}
