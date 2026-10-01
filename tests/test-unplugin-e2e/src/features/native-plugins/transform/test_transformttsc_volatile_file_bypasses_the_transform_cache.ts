import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { emitVolatilePlugins } from "../../../internal/transform-volatile/emitVolatilePlugins";

/**
 * Verifies a file declared volatile bypasses the transform cache on every
 * request.
 *
 * A volatile output depends on something no file snapshot can represent, so
 * replaying the cache would serve stale output. Two transforms of an unchanged
 * project must compile twice, which the fixture's per-run timestamp makes
 * visible, and signal `markVolatile` each time.
 *
 * 1. Transform with a plugin that declares `src/main.ts` volatile, counting
 *    `markVolatile` calls.
 * 2. Transform again without changing anything.
 * 3. Assert the outputs differ and `markVolatile` was called for both.
 *
 * @evidence contracts/testing.md#behavioral-verification Two actual unchanged-project transforms must return timestamp-bearing plugin text with different values and invoke markVolatile twice, detecting improper replay of a volatile output.
 * @evidence contracts/testing.md#independent-expectations Literal PLUGIN timestamp syntax, output inequality and two expected signals specify the producer/delivery contract without deriving the oracle from cache state.
 * @evidence contracts/testing.md#distinguishing-cases The second delivery repeats identical source and options yet must recompile because the producer declared the file volatile; complete-plus-volatile dependency derivation has a separate direct source unit.
 * @evidence contracts/testing.md#execution-ownership The named native entry runs the built public adapter against the real Go fixture with a shared transform cache; timestamp nondeterminism and native volatility metadata remain real E2E behavior.
 * @evidence contracts/e2e.md#necessary-boundary Native volatile metadata must reach both adapter cache bypass and markVolatile callbacks; a handwritten consumer envelope cannot prove that producer-to-adapter connection.
 * @evidence contracts/e2e.md#shared-execution One project, plugin artifact, options object and cache serve both requests. Two transforms are necessary because independently produced timestamps and bypass of the first result are the assertion, not redundant setup.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The root and cache are local to the case and source/options stay unchanged across deliveries. A finally block resets the local cache and disposes retained generation watchers after successful assertions or failure.
 * @evidence contracts/e2e.md#preserved-coverage Both success checks, both native timestamp syntax checks, changed output and signal count remain unchanged. The source unit test_transformttsc_ignores_completeness_for_a_volatile_file owns the exact conservative watch union when completeness conflicts with volatility.
 */
export async function test_transformttsc_volatile_file_bypasses_the_transform_cache(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc, resetTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const options = resolveOptions({
    plugins: emitVolatilePlugins(["src/main.ts"]),
  });
  const cache = createTtscTransformCache();

  try {
    let volatileSignals = 0;
    const hooks = {
      markVolatile: () => {
        volatileSignals += 1;
      },
    };
    const first = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      options,
      undefined,
      cache,
      hooks,
    );
    const second = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      options,
      undefined,
      cache,
      hooks,
    );

    assert.ok(first);
    assert.ok(second);
    assert.match(first.code, /"PLUGIN:\d+"/);
    assert.match(second.code, /"PLUGIN:\d+"/);
    assert.notEqual(
      first.code,
      second.code,
      "a volatile file must re-run the transform instead of replaying the cache",
    );
    assert.equal(volatileSignals, 2);
  } finally {
    resetTtscTransformCache(cache);
  }
}
