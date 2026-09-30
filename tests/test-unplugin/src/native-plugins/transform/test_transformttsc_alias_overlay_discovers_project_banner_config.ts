import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { aliasFor } from "../../internal/transform-utility-plugin-config/aliasFor";
import { createUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies a bundler alias does not stop `@ttsc/banner` from discovering the
 * project's config.
 *
 * A bundler alias makes the transform compile through a generated tsconfig in a
 * temp directory. `@ttsc/banner` discovers `banner.config.json` from the
 * project, so if discovery followed the generated config, it would fail with
 * "no banner.config found".
 *
 * 1. Create a banner project with a `banner.config.json`.
 * 2. Transform its entry with a bundler alias.
 * 3. Assert the configured banner text is in the output.
 *
 * @evidence contracts/testing.md#behavioral-verification transformTtsc runs the real banner utility with a bundler alias and must return configured Fixture Banner Text in the output, exposing discovery that incorrectly starts from the generated wrapper directory.
 * @evidence contracts/testing.md#independent-expectations The literal banner.config.json text independently specifies the preamble. Matching that literal distinguishes missing/default config discovery; this entry does not assert the original kept declaration survives, which remains an oracle limitation.
 * @evidence contracts/testing.md#distinguishing-cases Discovered project banner config under an alias is this entry's positive case. Explicit nested configFile and hostile temp strip config are separate complementary wrapper-discovery cases.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_alias_overlay_discovers_project_banner_config in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The generated JS tsconfig wrapper and real first-party native utility host must preserve project-based config discovery. Direct config parsing cannot detect the compiler/plugin using the temporary wrapper directory as its discovery root.
 * @evidence contracts/e2e.md#shared-execution createUtilityPluginProject allocates this consumer and seeds the existing first-party plugin; native producer/build preparation is shared through TestUnpluginProject. The aliasFor map changes generated wrapper input while keeping the authored source/config identity fixed; no separate installation is needed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The utility consumer has a unique root and config paths, and this entry leaves shared producer source intact. Uncached transform invocations do not borrow another entry's generation; TestProject owns temporary consumer and wrapper directories through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_alias_overlay_discovers_project_banner_config; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_alias_overlay_discovers_project_banner_config(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: {
      "banner.config.json": JSON.stringify({ text: "Fixture Banner Text" }),
    },
    plugin: "banner",
    source: 'export const value: string = "kept";\n',
  });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    aliasFor(root),
  );

  assert.ok(result);
  assert.match(result.code, /Fixture Banner Text/);
}
