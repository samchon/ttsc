import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { STRIP_CONFIG } from "../../internal/transform-utility-plugin-config/STRIP_CONFIG";
import { STRIP_SOURCE } from "../../internal/transform-utility-plugin-config/STRIP_SOURCE";
import { createNestedUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createNestedUtilityPluginProject";

/**
 * Verifies the same rule where the search found nothing at all.
 *
 * `@ttsc/strip` falls back to its built-in defaults when no config exists
 * anywhere up the tree, which is the state a config appearing later changes.
 * The defaults strip `console.log`; the config planted here strips
 * `logger.trace` instead, so each direction of the assertion distinguishes "the
 * new config took effect" from "the defaults kept running".
 */
export async function test_transformttsc_persistent_strip_defaults_yield_to_an_appearing_config(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { middle, root } = createNestedUtilityPluginProject({
    plugin: "strip",
    source: STRIP_SOURCE,
  });
  const file = path.join(root, "src", "main.ts");
  const source = fs.readFileSync(file, "utf8");
  const cache = createTtscTransformCache();
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(first);
  assert.doesNotMatch(first.code, /console\.log\("kept"\)/);
  assert.match(first.code, /logger\.trace\("drop"\)/);

  fs.writeFileSync(
    path.join(middle, "strip.config.json"),
    STRIP_CONFIG,
    "utf8",
  );
  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(second);
  assert.doesNotMatch(second.code, /logger\.trace\("drop"\)/);
  assert.match(second.code, /console\.log\("kept"\)/);
}
