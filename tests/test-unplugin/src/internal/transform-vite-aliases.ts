import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Asserts that a bundler alias map passed as the fourth argument to
 * `transformTtsc` is forwarded to the ttsc transform as
 * `compilerOptions.paths`, verified by the fixture plugin's `assert-paths`
 * operation.
 */
async function assertTransformPassesBundlerAliases() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: [
        {
          transform: "./plugin.cjs",
          config: {
            operation: "assert-paths",
            key: "@lib",
            target: "src/modules",
          },
          name: "fixture",
        },
      ],
    }),
    { "@lib": path.join(root, "src", "modules") },
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}

export { assertTransformPassesBundlerAliases };
