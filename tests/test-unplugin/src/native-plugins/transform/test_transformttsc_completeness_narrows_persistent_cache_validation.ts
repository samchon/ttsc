import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { declareComplete } from "../../internal/transform-complete/declareComplete";
import { cacheEntry } from "../../internal/transform-external/cacheEntry";
import { emitGraphPlugins } from "../../internal/transform-graph/emitGraphPlugins";

/**
 * Verifies a completeness declaration narrows persistent transform validation
 * as well as bundler watch registration. The plugin has transferred ownership
 * of the file's complete dependency set, so an undeclared graph member cannot
 * keep imposing whole-envelope reads on every delivery.
 */
export async function test_transformttsc_completeness_narrows_persistent_cache_validation(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const shared = TestProject.tmpdir("ttsc-unplugin-external-");
  const external = path.join(shared, "types.d.ts");
  fs.writeFileSync(external, "declare const first: string;\n", "utf8");
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const relative = path.relative(root, external).split(path.sep).join("/");
  const options = resolveOptions({
    plugins: [
      ...emitGraphPlugins({ edges: { "src/main.ts": [relative] } }),
      declareComplete(["src/main.ts"]),
    ],
  });
  const cache = createTtscTransformCache();

  const before = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(before);
  const generation = cacheEntry(cache);

  fs.writeFileSync(external, "declare const second: string;\n", "utf8");
  const after = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(after);
  assert.strictEqual(cacheEntry(cache), generation);
}
