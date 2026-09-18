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
