import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { STRIP_CONFIG } from "../../internal/transform-utility-plugin-config/STRIP_CONFIG";
import { STRIP_SOURCE } from "../../internal/transform-utility-plugin-config/STRIP_SOURCE";
import { aliasFor } from "../../internal/transform-utility-plugin-config/aliasFor";
import { createUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies that a bundler alias does not detach `@ttsc/strip` from the
 * project's `strip.config.json`: the configured call list is honored and the
 * built-in defaults are NOT applied.
 */
export async function test_transformttsc_alias_overlay_honors_project_strip_config(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: { "strip.config.json": STRIP_CONFIG },
    plugin: "strip",
    source: STRIP_SOURCE,
  });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    aliasFor(root),
  );

  assert.ok(result);
  assert.doesNotMatch(result.code, /logger\.trace\("drop"\)/);
  // The defaults strip console.log; the project config must win instead.
  assert.match(result.code, /console\.log\("kept"\)/);
}
