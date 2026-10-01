import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  tsgo,
} from "../../../../internal/ttsc/internal/compiler";

/**
 * Verifies TtscCompiler can disable project plugin loading.
 *
 * Pins the `plugins: false` escape hatch that lets an embedded host skip all
 * plugin discovery without removing the `plugins` array from tsconfig. Without
 * this path a missing-plugin entry would fail compilation even when the caller
 * knows plugins are irrelevant for its use-case (e.g. a formatter-only pass).
 *
 * 1. Create a project whose tsconfig references a plugin that does not exist.
 * 2. Construct a TtscCompiler with `plugins: false`.
 * 3. Call `compile()` and assert the result is success despite the missing plugin.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual public TtscCompiler compile succeeds despite a nonexistent descriptor when the caller supplies plugins:false.
 * @evidence contracts/testing.md#independent-expectations The authored missing plugin path would fail discovery if enabled, and the literal success discriminant is independently expected for disabled discovery.
 * @evidence contracts/testing.md#distinguishing-cases Owns the public API disable-discovery connection, distinct from CLI argument parser decisions.
 * @evidence contracts/testing.md#execution-ownership The matching named driver export invokes the actual public compiler API and native compiler in the shared Linux boundary population.
 * @evidence contracts/e2e.md#necessary-boundary The API must carry plugins:false into compilation before descriptor discovery; a CLI parser unit does not execute that API assembly.
 * @evidence contracts/e2e.md#shared-execution No Go plugin is prepared because loading is explicitly disabled; the existing native compiler is reused and only this API call runs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh project config retains the missing descriptor and no descriptor or plugin cache entry is inserted to make success artificial.
 * @evidence contracts/e2e.md#preserved-coverage Keeps the original actual compile result success assertion with the same absent descriptor and API option.
 */
export function test_ttsccompiler_can_disable_project_plugin_loading(): void {
  const root = createProject({
    plugins: [{ transform: "./missing-plugin.cjs" }],
  });
  const compiler = new TtscCompiler({
    binary: tsgo,
    cwd: root,
    plugins: false,
  });

  const result = compiler.compile();

  assert.equal(result.type, "success");
}
