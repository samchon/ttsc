import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  tsgo,
  writeWarningCheckPlugin,
} from "../../../internal/ttsc/internal/compiler";

/**
 * Verifies TtscCompiler.transform preserves warning diagnostics from check
 * plugins.
 *
 * Check-only plugins emit diagnostics without modifying the source tree. When a
 * plugin produces a warning (not an error), `transform()` should still return a
 * `success` result — the transform succeeded, but the warnings must be surfaced
 * in the `diagnostics` array so callers can relay them to the user.
 *
 * 1. Create a project with a check plugin that emits one warning diagnostic.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the result is `success`, `diagnostics` has one `warning`-category
 *    entry, and the typescript source is still returned.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs a native warning-only check plugin during transform and requires successful source return with exactly one warning of code 9001.
 * @evidence contracts/testing.md#independent-expectations The authored Go check fixture emits warning TS9001; warnings preserve success by contract, while the api-ok source literal independently establishes retained source.
 * @evidence contracts/testing.md#distinguishing-cases One warning distinguishes nonfatal plugin diagnostics from dropped diagnostics or mistaken failure; native check failure and TypeScript errors are owned by other entries.
 * @evidence contracts/testing.md#execution-ownership The named API feature is discovered by TestExecutor and builds/runs the actual Go check fixture.
 * @evidence contracts/e2e.md#necessary-boundary Native check stderr must enter structured API diagnostics without suppressing source or changing warning success semantics; direct diagnostic parsing cannot prove execution-stage routing.
 * @evidence contracts/e2e.md#shared-execution One check-plugin preparation and one transform provide every assertion; built packages and keyed cache are shared, but the helper currently writes a private identical warning source per consumer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh registered project owns the descriptor and warning module; synchronous plugin/transform completion precedes checks and registered fixture cleanup runs at suite exit.
 * @evidence contracts/e2e.md#preserved-coverage Success, diagnostic count/category/code and api-ok source assertions remain. Warning message/location and arbitrary check-plugin semantics are not asserted.
 */
export const test_ttsccompiler_transform_preserves_warning_diagnostics_from_check_plugins =
  () => {
    const root = createProject({
      plugins: [{ transform: "./check-plugin.cjs" }],
    });
    writeWarningCheckPlugin(root);
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.equal(result.diagnostics?.length, 1);
    const diagnostic = expectArrayValue(result.diagnostics ?? [], 0);
    assert.equal(diagnostic.category, "warning");
    assert.equal(diagnostic.code, 9001);
    assert.match(expectRecordValue(result.typescript, "src/main.ts"), /api-ok/);
  };
