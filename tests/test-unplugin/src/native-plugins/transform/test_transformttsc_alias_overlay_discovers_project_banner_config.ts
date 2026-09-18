import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { aliasFor } from "../../internal/transform-utility-plugin-config/aliasFor";
import { createUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies that a bundler alias does not make `@ttsc/banner` fail with "no
 * banner.config found": the project's config file is discovered and its banner
 * text lands in the transformed source.
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
