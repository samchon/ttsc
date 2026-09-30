import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Verifies a ttsc run that declares no plugin config directory scrubs an
 * inherited `TTSC_PLUGIN_CONFIG_DIR` from its plugin spawns.
 *
 * The anchor is per-invocation state owned by the launching host. A nested ttsc
 * run, such as a config loader's ttsx child or a plugin shelling back into
 * ttsc, inherits the ancestor's environment, so without the scrub its plugins
 * would anchor config discovery at the outer project. Both the source-to-source
 * lane and the build lane own their own environment builder, so both are
 * exercised.
 *
 * 1. Set `TTSC_PLUGIN_CONFIG_DIR` in the environment.
 * 2. Run `transform()` and `compile()` with a plugin that fails when the variable
 *    reaches it.
 * 3. Assert both succeed, then restore the environment.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscCompiler transform and compile both succeed while fixture plugin rejects any inherited TTSC_PLUGIN_CONFIG_DIR; transform output contains PLUGIN.
 * @evidence contracts/testing.md#independent-expectations Explicit poisoned environment and plugin assertion independently establish launch environment scrub in two compiler lanes.
 * @evidence contracts/testing.md#distinguishing-cases Source-to-source transform and emitted build with undeclared inherited config anchor.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_undeclared_run_scrubs_inherited_plugin_config_dir is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts. Its body owns the assertions above; the path-identity case also retains direct portable helper assertions here.
 * @evidence contracts/e2e.md#necessary-boundary TtscCompiler transform and compile launch real plugin processes; direct environment-builder calls cannot prove the inherited variable is scrubbed at each actual spawn.
 * @evidence contracts/e2e.md#shared-execution One compiler instance/project and native contributor artifact serve both public lanes. Separate native invocations are necessary to verify their independent spawn environment builders.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project and cache identities separate mutable inputs; tracked roots are removed on process exit. Inherited TTSC_PLUGIN_CONFIG_DIR is saved and restored in finally. Compiler processes complete before success assertions; abrupt cancellation is not tested.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: TtscCompiler transform and compile both succeed while fixture plugin rejects any inherited TTSC_PLUGIN_CONFIG_DIR; transform output contains PLUGIN. No assertion is transferred or removed by these tags; mixed portable helpers and cleanup limits remain explicitly disclosed.
 */
export async function test_ttsc_undeclared_run_scrubs_inherited_plugin_config_dir(): Promise<void> {
  const requireFromTest = createRequire(import.meta.url);
  const { TtscCompiler } = requireFromTest("ttsc");
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "assert-no-plugin-config-dir",
      },
    ],
  });
  const previous = process.env.TTSC_PLUGIN_CONFIG_DIR;
  process.env.TTSC_PLUGIN_CONFIG_DIR = path.join(root, "elsewhere");
  try {
    const compiler = new TtscCompiler({ cwd: root });
    const transformed = compiler.transform();
    assert.equal(
      transformed.type,
      "success",
      JSON.stringify(transformed, null, 2),
    );
    assert.match(transformed.typescript["src/main.ts"] ?? "", /"PLUGIN"/);
    const compiled = compiler.compile();
    assert.equal(compiled.type, "success", JSON.stringify(compiled, null, 2));
  } finally {
    if (previous === undefined) delete process.env.TTSC_PLUGIN_CONFIG_DIR;
    else process.env.TTSC_PLUGIN_CONFIG_DIR = previous;
  }
}
