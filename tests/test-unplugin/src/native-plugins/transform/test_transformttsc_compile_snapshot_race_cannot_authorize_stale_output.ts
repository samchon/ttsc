import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";

/**
 * Verifies a project edit between native compilation and snapshot publication
 * cannot become an authoritative stale generation.
 */
export async function test_transformttsc_compile_snapshot_race_cannot_authorize_stale_output(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 2, graphFanout: 2 });
  const options = resolveOptions();
  const main = path.join(project.root, "src", "mod0.ts");
  const lazy = path.join(project.root, "src", "mod1.ts");
  let raced = false;
  const cache = createTtscTransformCache({
    readdir: (location: string) => {
      if (
        !raced &&
        fs.existsSync(project.runLog) &&
        path.resolve(location) === path.dirname(lazy)
      ) {
        raced = true;
        fs.writeFileSync(
          lazy,
          'export const value1: string = "PROBE-AFTER";\n',
          "utf8",
        );
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  assert.equal(raced, true);
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "the first delivery must stabilize the raced project before resolving",
  );
  const stableGeneration = [...cache.values()][0];

  const result = await transformTtsc(
    lazy,
    fs.readFileSync(lazy, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(result);
  assert.match(result.code, /AFTER/);
  assert.equal([...cache.values()][0], stableGeneration);
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "the sibling must reuse the generation stabilized by the first delivery",
  );
}
