import assert from "node:assert/strict";

import { TestLintPlugin } from "../../internal/TestLintPlugin";

/**
 * Verifies that `lib/index.js` exports a factory function that returns a valid
 * native `PluginSource` descriptor.
 *
 * The `@ttsc/lint` package's JS entry must be a callable factory (not a plain
 * config object), and the returned descriptor must carry the plugin name
 * `"@ttsc/lint"`, the `"check"` stage, and the TypeScript-diagnostics
 * capability so the ttsc host knows when to invoke it and avoid redundant `tsgo
 * --noEmit` guards. It also opts into the project-input snapshot consumed by
 * watch and LSP hosts. A wrong name or stage would silently route lint
 * diagnostics to the wrong pipeline slot.
 *
 * 1. Load the factory from the built `lib/index.js`.
 * 2. Call it with a minimal context supplying `transform: "@ttsc/lint"`.
 * 3. Assert `typeof factory === "function"`, `descriptor.name === "@ttsc/lint"`,
 *    `descriptor.stage === "check"`, and both host capabilities are set.
 *
 * @evidence contracts/testing.md#behavioral-verification The built package entry is required and called; exact name, stage, TypeScript diagnostic ownership and project-input capability are asserted on the returned descriptor.
 * @evidence contracts/testing.md#independent-expectations The public plugin descriptor contract requires a callable check-stage @ttsc/lint factory with the two stated host capabilities; these literal expectations are not read from its implementation.
 * @evidence contracts/testing.md#distinguishing-cases The installed-entry positive detects an object export, wrong pipeline stage, missing diagnostic ownership or missing project-input capability; authored-source units own entry variation and source computation.
 * @evidence contracts/testing.md#execution-ownership This named boundary entry loads the emitted package through TestLintPlugin; source units do not substitute for this emitted-entry check.
 * @evidence contracts/e2e.md#necessary-boundary Requiring the built package checks JS package assembly and factory export interoperation, which authored TypeScript factory calls cannot establish.
 * @evidence contracts/e2e.md#shared-execution The existing test process requires the shared emitted entry once through Node module caching; there is no consumer install, Go build or child host in this case.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The minimal context has no executable config or contributor and descriptor creation does not mutate the loaded entry; package bytes stay unchanged within the suite.
 * @evidence contracts/e2e.md#preserved-coverage All original callable/name/stage/diagnostic/project-input assertions remain executable against the built entry.
 */
export function test_lib_index_js_is_a_factory_that_returns_a_native_source_descriptor() {
    const factory = TestLintPlugin.loadFactory();
    assert.equal(typeof factory, "function");
    const descriptor = factory(
      TestLintPlugin.factoryContext({ transform: "@ttsc/lint" }),
    );
    assert.equal(descriptor.name, "@ttsc/lint");
    assert.equal(descriptor.stage, "check");
    assert.equal(descriptor.reportsTypeScriptDiagnostics, true);
    assert.equal(descriptor.capabilities?.projectInputs, true);
  }
