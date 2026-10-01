import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies a transform without a `volatile` declaration never calls
 * `markVolatile` and keeps serving from the cache.
 *
 * `markVolatile` makes a host exclude a module from caching. Signaling it
 * without a declaration would disable caching for every module, so an ordinary
 * transform must never call it.
 *
 * 1. Transform the entry twice through one cache with a plain plugin and a
 *    `markVolatile` counter.
 * 2. Assert both outputs are identical.
 * 3. Assert `markVolatile` was never called.
 *
 * @evidence contracts/testing.md#behavioral-verification Two plain native transforms return matching PLUGIN output with no remaining goUpper and never call markVolatile.
 * @evidence contracts/testing.md#independent-expectations Literal go-uppercase fixture semantics establish changed output; independent hook counter requires zero volatility signals.
 * @evidence contracts/testing.md#distinguishing-cases No volatility declaration is the ordinary negative twin of explicitly volatile producers; equality alone is supplemented by transformation assertions.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_never_signals_volatility_without_a_declaration in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Two plain native transforms return matching PLUGIN output with no remaining goUpper and never call markVolatile. These assertions remain in test_transformttsc_never_signals_volatility_without_a_declaration, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_never_signals_volatility_without_a_declaration(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const options = resolveOptions({
    plugins: [
      { transform: "./plugin.cjs", name: "fixture", operation: "go-uppercase" },
    ],
  });
  const cache = createTtscTransformCache();

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
  for (const result of [first, second]) {
    assert.match(result.code, /PLUGIN/);
    assert.doesNotMatch(result.code, /goUpper/);
  }
  assert.equal(first.code, second.code);
  assert.equal(volatileSignals, 0);
}
