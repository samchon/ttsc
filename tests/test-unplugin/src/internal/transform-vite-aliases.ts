import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Asserts that a bundler alias map passed as the fourth argument to
 * `transformTtsc` is forwarded to the ttsc transform as
 * `compilerOptions.paths`, verified by the fixture plugin's `assert-paths`
 * operation. The expected target is the absolute alias replacement: the
 * generated tsconfig lives in a temp directory where TypeScript-Go rejects bare
 * relative targets (TS5090), so the overlay writes absolute ones.
 *
 * Plugin options sit at the entry top level — the protocol forwards the whole
 * `compilerOptions.plugins[i]` entry as the plugin's config object, so a nested
 * `config: {...}` object would make the fixture fall back to its default
 * operation and the assertion would never run.
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
          name: "fixture",
          operation: "assert-paths",
          key: "@lib",
          target: path.join(root, "src", "modules").replace(/\\/g, "/"),
        },
      ],
    }),
    { "@lib": path.join(root, "src", "modules") },
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}

export { assertTransformPassesBundlerAliases };
