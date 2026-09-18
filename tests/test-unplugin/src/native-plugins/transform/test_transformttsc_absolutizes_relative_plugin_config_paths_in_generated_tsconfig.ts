import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies that `transformTtsc` resolves a relative `config` path on a plugin
 * descriptor to an absolute path before writing the temp tsconfig, verified by
 * the fixture plugin's `assert-config-path` operation.
 */
export async function test_transformttsc_absolutizes_relative_plugin_config_paths_in_generated_tsconfig(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  fs.writeFileSync(
    path.join(root, "fixture.config.json"),
    JSON.stringify({ ok: true }),
    "utf8",
  );
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      compilerOptions: {
        plugins: [
          {
            transform: "./plugin.cjs",
            name: "fixture",
            config: "./fixture.config.json",
            operation: "assert-config-path",
          },
        ],
      },
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}
