import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Asserts that a ttsc run that declares no `pluginConfigDir` scrubs an
 * inherited `TTSC_PLUGIN_CONFIG_DIR` from its plugin spawns.
 *
 * The anchor is per-invocation state owned by the launching host. A nested ttsc
 * run (a config loader's ttsx child, a plugin shelling back into ttsc) inherits
 * the ancestor's environment, so without the scrub its plugins would mis-anchor
 * config discovery at the OUTER project. The fixture plugin's
 * `assert-no-plugin-config-dir` operation fails the compile when the variable
 * reaches it, and both the source-to-source lane (`transform()`) and the build
 * lane (`compile()`) are exercised because each owns its own env builder.
 */
async function assertUndeclaredRunScrubsInheritedPluginConfigDir() {
  const requireFromTest = createRequire(
    path.join(process.cwd(), "package.json"),
  );
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

export { assertUndeclaredRunScrubsInheritedPluginConfigDir };
