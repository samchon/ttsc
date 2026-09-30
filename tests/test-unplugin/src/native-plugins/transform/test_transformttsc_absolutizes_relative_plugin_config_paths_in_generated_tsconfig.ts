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
 *
 * @evidence contracts/testing.md#behavioral-verification A consumer project reached through a real symlink/junction invokes assert-config-path with ./fixture.config.json; a successful result containing PLUGIN establishes the native fixture accepted the absolute config path under its physical root.
 * @evidence contracts/testing.md#independent-expectations The fixture operation refuses a path whose spelling does not match its own native root. The literal relative input and PLUGIN marker establish forwarding independently of the adapter's absolutization code; the marker alone relies on that documented fixture refusal.
 * @evidence contracts/testing.md#distinguishing-cases A relative legacy config key through a linked project tests lexical-versus-physical root spelling. The configFile entry separately owns its content-proof and invalidation contract; no arbitrary absolute-path variants are asserted here.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_absolutizes_relative_plugin_config_paths_in_generated_tsconfig in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built JS transform API loads the consumer plugin descriptor and forwards its entry through generated configuration into an actual native fixture producer. A unit option parser cannot show the native consumer receives that configuration and returns transformed output.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject.createProject reuses the suite materialized native fixture plugin and build cache while allocating this consumer separately. The built public transform API is loaded once; this scenario needs its own config/source inputs but no independent package installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique consumer/link-parent roots isolate spelling. The link targets the physical root with Windows junction or POSIX directory link, and no global cwd/environment is changed. Temporary consumer/link paths belong to TestProject until runner cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_absolutizes_relative_plugin_config_paths_in_generated_tsconfig; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
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
