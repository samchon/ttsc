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
 * @evidence contracts/testing.md#execution-ownership The named feature calls checkout built TtscCompiler through the shared subclass and selected native compiler, running the authored Go check fixture. It observes actual check routing, not packed installation or independent executable image/build provenance.
 * @evidence contracts/e2e.md#necessary-boundary Native check stderr must enter structured API diagnostics without suppressing source or changing warning success semantics; direct diagnostic parsing cannot prove execution-stage routing.
 * @evidence contracts/e2e.md#shared-execution One transform invocation provides every original warning/source assertion while descriptor preparation, built API and keyed cache may share work. The helper writes private identical Go source per consumer; exact new-build/cache-hit/process/Program totals are not inferred from this one result.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh registered project owns the descriptor and warning module; the direct synchronous result precedes checks and normal tracked fixture cleanup. This is not arbitrary descendant closure or forced-interruption cleanup certification.
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
