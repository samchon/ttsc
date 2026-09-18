import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createUtilityPluginProject";

/** Assert a persistent generation reloads an implicitly discovered config. */
export async function test_transformttsc_persistent_banner_config_edit_invalidates_transform(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: {
      "banner.config.json": JSON.stringify({ text: "OLD BANNER" }),
    },
    plugin: "banner",
    source: 'export const value: string = "kept";\n',
  });
  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const cache = createTtscTransformCache();
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(first);
  assert.match(first.code, /OLD BANNER/);

  fs.writeFileSync(
    path.join(root, "banner.config.json"),
    JSON.stringify({ text: "NEW BANNER" }),
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
  assert.match(second.code, /NEW BANNER/);
  assert.doesNotMatch(second.code, /OLD BANNER/);
}
