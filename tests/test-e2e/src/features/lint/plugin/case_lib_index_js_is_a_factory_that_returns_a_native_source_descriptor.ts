import assert from "node:assert/strict";

import { TestLintPlugin } from "../../../internal/lint/internal/TestLintPlugin";

/**
 * Verifies the workspace-built `lib/index.js` factory's selected descriptor fields.
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
 * @evidence contracts/testing.md#distinguishing-cases This built-entry positive detects an object export, wrong check stage or either missing capability. Typed/CJS descriptor siblings own their evaluator inputs; this entry does not assert a source path, all descriptor fields or packed consumer installation.
 * @evidence contracts/testing.md#execution-ownership This named boundary entry loads the emitted package through TestLintPlugin; source units do not substitute for this emitted-entry check.
 * @evidence contracts/e2e.md#necessary-boundary Requiring the built package checks JS package assembly and factory export interoperation, which authored TypeScript factory calls cannot establish.
 * @evidence contracts/e2e.md#shared-execution The test process requires the shared workspace-built entry through Node caching, without a consumer install or contributor Go build. Its factoryContext carries the current cwd and package tsconfig; implicit config discovery may use the selected evaluator/compiler route, so this parent call does not prove zero children or count Programs/cache hits.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The entry supplies no explicit config selector or contributor but retains the original cwd/package tsconfig context, including implicit discovery. This positive does not independently isolate inherited config selection, observe package-byte immutability or certify loaded-image equality/descendant joins; process module retention is shared with descriptor siblings.
 * @evidence contracts/e2e.md#preserved-coverage Original callable/name/check/diagnostic/project-input assertions remain against the workspace-built entry. They do not establish full descriptor validity or actual host consumption; installed-family registration, survivor execution and implicit-selection isolation remain separate unverified obligations.
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
