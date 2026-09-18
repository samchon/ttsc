import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a relative plugin `config` path is absolutized in the generated
 * tsconfig.
 *
 * The generated tsconfig lives in a temp directory, so a relative `config` left
 * as written would resolve against that directory rather than the project and
 * point at nothing.
 *
 * 1. Write a config file at the project root.
 * 2. Transform with a plugin whose `config` is `./fixture.config.json`.
 * 3. Assert the fixture plugin received the absolute path of that file.
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
