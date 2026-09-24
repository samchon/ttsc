import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MYTYPE_V2 } from "../../internal/adapter-webpack/MYTYPE_V2";
import { createTypeEdgeProject } from "../../internal/adapter-webpack/createTypeEdgeProject";

const rollup = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("rollup").rollup;

/**
 * Verifies a one-shot Rollup build handed a previous build's cache transforms
 * again a module whose project moved since, and serves it from that cache
 * otherwise (samchon/ttsc#1491).
 *
 * Rollup serves a module from the cache it was handed whenever the module's
 * source is unchanged and no plugin's `shouldTransformCachedModule` asks for
 * it. Rollup's own watcher makes a cached module whose watch file changed run
 * again, but a build handed a cache has no watcher: the consumer reaches the
 * type file only through a type-only import, its source never changed, and it
 * kept the output of the interface before the edit. The adapter answers for the
 * module's project record instead, which the build proves and moves for a
 * project that changed since, the answer every other host's persistent cache
 * gets from the record it holds as the module's dependency.
 *
 * 1. Create the type-edge project and build it, keeping Rollup's cache.
 * 2. Build again from that cache, and assert the output is unchanged and the
 *    module came from the cache, no plugin transforming it.
 * 3. Rewrite the type file with a new interface, build again from the second
 *    build's cache, and assert the output embeds the new interface.
 */
export async function test_rollup_build_given_a_cache_rebuilds_through_a_type_only_edge(): Promise<void> {
  const root = createTypeEdgeProject(true);
  const main = TestUnpluginProject.mainFile(root);
  // Rollup runs no plugin's `transform` for a module it serves from its cache.
  let transforms = 0;
  const counter = {
    name: "count-transforms",
    transform(_code: string, id: string) {
      if (path.resolve(id) === path.resolve(main)) transforms += 1;
      return null;
    },
  };
  const unpluginRollup =
    await TestUnpluginRuntime.loadUnpluginAdapter("rollup");
  const build = async (cache?: unknown) => {
    const bundle = await rollup({
      cache,
      input: main,
      plugins: [unpluginRollup(), counter],
    });
    try {
      const generated = await bundle.generate({ format: "esm" });
      return {
        cache: bundle.cache,
        code: TestUnpluginProject.collectRollupOutputCode(generated.output),
      };
    } finally {
      await bundle.close();
    }
  };

  // 1. The first build.
  const first = await build();
  assert.match(first.code, /ID: STRING/);
  assert.doesNotMatch(first.code, /AGE: NUMBER/);
  assert.ok(first.cache !== undefined, "Rollup keeps a cache");

  // 2. Nothing moved.
  const before = transforms;
  const second = await build(first.cache);
  assert.equal(second.code, first.code);
  assert.equal(transforms, before, "the module comes from Rollup's cache");

  // 3. The type file moved.
  fs.writeFileSync(path.join(root, "src", "mytype.ts"), MYTYPE_V2, "utf8");
  const third = await build(second.cache);
  assert.match(
    third.code,
    /AGE: NUMBER/,
    "a build handed a cache must rebuild the consumer through the type-only edge",
  );
}
