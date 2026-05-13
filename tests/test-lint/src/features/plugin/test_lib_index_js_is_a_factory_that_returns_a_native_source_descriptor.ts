import assert from "node:assert/strict";

import { TestLintPlugin } from "../../internal/TestLintPlugin";

/**
 * Verifies lib/index.js is a factory that returns a native source descriptor.
 *
 * This lint plugin descriptor scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
