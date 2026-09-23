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
