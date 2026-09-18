import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { aliasFor } from "../../internal/transform-utility-plugin-config/aliasFor";
import { createUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies that a relative `configFile` on a tsconfig-declared plugin entry
 * resolves against the project even when the compile runs through the generated
 * alias tsconfig in the temp directory.
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
