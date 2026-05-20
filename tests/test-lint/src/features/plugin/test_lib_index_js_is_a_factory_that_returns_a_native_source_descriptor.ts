import assert from "node:assert/strict";

import { TestLintPlugin } from "../../internal/TestLintPlugin";

/**
 * Verifies that `lib/index.js` exports a factory function that returns a valid
 * native `PluginSource` descriptor.
 *
 * The `@ttsc/lint` package's JS entry must be a callable factory (not a plain
 * config object), and the returned descriptor must carry the plugin name
 * `"@ttsc/lint"` and the `"check"` stage so the ttsc host knows when to invoke
 * it. A wrong name or stage would silently route lint diagnostics to the wrong
 * pipeline slot.
 *
 * 1. Load the factory from the built `lib/index.js`.
 * 2. Call it with a minimal context supplying `transform: "@ttsc/lint"`.
 * 3. Assert `typeof factory === "function"`, `descriptor.name === "@ttsc/lint"`,
 *    and `descriptor.stage === "check"`.
 */
export const test_lib_index_js_is_a_factory_that_returns_a_native_source_descriptor =
  () => {
    const factory = TestLintPlugin.loadFactory();
    assert.equal(typeof factory, "function");
    const descriptor = factory(
      TestLintPlugin.factoryContext({ transform: "@ttsc/lint" }),
    );
    assert.equal(descriptor.name, "@ttsc/lint");
    assert.equal(descriptor.stage, "check");
  };
