import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { STRIP_CONFIG } from "../../internal/transform-utility-plugin-config/STRIP_CONFIG";
import { STRIP_SOURCE } from "../../internal/transform-utility-plugin-config/STRIP_SOURCE";
import { aliasFor } from "../../internal/transform-utility-plugin-config/aliasFor";
import { createUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies the positive twin: with and without the alias, the strip output is
 * byte-identical, so the generated-tsconfig lane and the passthrough lane agree
 * on the project's strip config.
 */
export async function test_transformttsc_alias_overlay_matches_no_alias_strip_output(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: { "strip.config.json": STRIP_CONFIG },
    plugin: "strip",
    source: STRIP_SOURCE,
  });
  const withAlias = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    aliasFor(root),
  );
  const withoutAlias = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
  );

  assert.ok(withAlias);
  assert.ok(withoutAlias);
  assert.doesNotMatch(withoutAlias.code, /logger\.trace\("drop"\)/);
  assert.equal(withAlias.code, withoutAlias.code);
}
