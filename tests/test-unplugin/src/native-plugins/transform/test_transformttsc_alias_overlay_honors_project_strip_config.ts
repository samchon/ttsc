import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { STRIP_CONFIG } from "../../internal/transform-utility-plugin-config/STRIP_CONFIG";
import { STRIP_SOURCE } from "../../internal/transform-utility-plugin-config/STRIP_SOURCE";
import { aliasFor } from "../../internal/transform-utility-plugin-config/aliasFor";
import { createUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies a bundler alias does not detach `@ttsc/strip` from the project's
 * `strip.config.json`.
 *
 * Under an alias the compile runs through a generated tsconfig in a temp
 * directory. If the plugin lost the project's config there, it would silently
 * fall back to its built-in defaults and strip different calls.
 *
 * 1. Create a strip project with a `strip.config.json`.
 * 2. Transform its entry with a bundler alias.
 * 3. Assert the configured call is removed and the default-only call is kept.
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
