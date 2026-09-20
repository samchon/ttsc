import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a relative plugin `config` path is absolutized in the generated
 * tsconfig, against the project as the compiler spells it.
 *
 * The generated tsconfig lives in a temp directory, so a relative `config` left
 * as written would resolve against that directory rather than the project and
 * point at nothing. The compiler resolves the project to its physical directory
 * before it hands a plugin its root, so a project reached through a link, the
 * macOS temporary directory among them, must hand the plugin the path spelled
 * under that physical directory, the one it compares its root against
 * (samchon/ttsc#1456).
 *
 * 1. Write a config file at the project root, and link the project elsewhere.
 * 2. Transform through the link with a plugin whose `config` is
 *    `./fixture.config.json`.
 * 3. Assert the fixture plugin received the path of that file under its own,
 *    physical, root.
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
  const linked = path.join(TestProject.tmpdir("ttsc-link-"), "project");
  fs.symlinkSync(
    fs.realpathSync.native(root),
    linked,
    process.platform === "win32" ? "junction" : "dir",
  );
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(linked),
    TestUnpluginProject.mainSource(linked),
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
      project: path.join(linked, "tsconfig.json"),
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}
