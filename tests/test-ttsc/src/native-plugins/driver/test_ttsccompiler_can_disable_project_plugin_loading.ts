import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  tsgo,
} from "../../internal/compiler";

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
 */
export const test_ttsccompiler_can_disable_project_plugin_loading = () => {
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
};
