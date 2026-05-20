import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Asserts that three chained fixture plugins supplied via the `plugins` option
 * are applied in the declared order: prefix (`"A:"`), upper-case, suffix
 * (`":Z"`), producing `"A:PLUGIN:Z"` in the output.
 */
async function assertTransformAppliesOrderedPluginOverrides() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: [
        { transform: "./plugin.cjs", name: "prefix", prefix: "A:" },
        { transform: "./plugin.cjs", name: "upper" },
        { transform: "./plugin.cjs", name: "suffix", suffix: ":Z" },
      ],
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"A:PLUGIN:Z"/);
}

export { assertTransformAppliesOrderedPluginOverrides };
