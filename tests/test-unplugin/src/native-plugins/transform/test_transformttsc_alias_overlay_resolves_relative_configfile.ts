import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { aliasFor } from "../../internal/transform-utility-plugin-config/aliasFor";
import { createUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createUtilityPluginProject";

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
