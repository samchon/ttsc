import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { aliasFor } from "../../../internal/transform-utility-plugin-config/aliasFor";
import { createUtilityPluginProject } from "../../../internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies a relative `configFile` on a tsconfig-declared plugin resolves
 * against the project under the alias overlay.
 *
 * Under an alias the compile runs through a generated tsconfig in the temp
 * directory, so a relative `configFile` from the project's own plugin entry
 * would otherwise resolve there and miss.
 *
 * 1. Create a banner project whose plugin entry names
 *    `./config/banner.config.json`.
 * 2. Transform its entry with a bundler alias.
 * 3. Assert the banner text from that file is in the output.
 *
 * @evidence contracts/testing.md#behavioral-verification An aliased real banner transform reads ./config/banner.config.json from a tsconfig-declared entry and returns Relative ConfigFile Banner, catching relative override resolution against the temporary wrapper.
 * @evidence contracts/testing.md#independent-expectations The nested config contains a literal unique preamble independent of path absolutization. Matching it proves that file's selection; this entry does not assert all unchanged source text survives or test a missing override.
 * @evidence contracts/testing.md#distinguishing-cases Explicit nested relative configFile under an alias differs from discovered root banner config and inline compilerOptions override cases.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_alias_overlay_resolves_relative_configfile in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The generated JS tsconfig wrapper and real first-party native utility host must preserve project-based config discovery. Direct config parsing cannot detect the compiler/plugin using the temporary wrapper directory as its discovery root.
 * @evidence contracts/e2e.md#shared-execution createUtilityPluginProject allocates this consumer and seeds the existing first-party plugin; native producer/build preparation is shared through TestUnpluginProject. The aliasFor map changes generated wrapper input while keeping the authored source/config identity fixed; no separate installation is needed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The utility consumer has a unique root and config paths, and this entry leaves shared producer source intact. Uncached transform invocations do not borrow another entry's generation; TestProject owns temporary consumer and wrapper directories through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_alias_overlay_resolves_relative_configfile; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_alias_overlay_resolves_relative_configfile(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: {
      "config/banner.config.json": JSON.stringify({
        text: "Relative ConfigFile Banner",
      }),
    },
    plugin: "banner",
    pluginEntry: { configFile: "./config/banner.config.json" },
    source: 'export const value: string = "kept";\n',
  });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    aliasFor(root),
  );

  assert.ok(result);
  assert.match(result.code, /Relative ConfigFile Banner/);
}
