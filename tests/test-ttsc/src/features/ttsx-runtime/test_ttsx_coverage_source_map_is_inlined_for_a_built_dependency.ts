import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  maxFunctionCount,
  runTtsxWithCoverage,
  sourceMapSourcePath,
  tallCommentLibrarySource,
} from "../../internal/ttsx-source-map";

/**
 * Verifies the inlined-map fix also covers the dependency serve lane, which is
 * a separate code path from the entry lane (issue #353).
 *
 * A raw-`.ts` dependency resolved from `node_modules` is built under its own
 * tsconfig by `serveBuiltDependency`, not `serveEntryEmit`; a fix that only
 * touched the entry lane would leave dependency coverage broken. The dependency
 * build forces an external map and the serve path inlines it the same way, so a
 * never-called dependency export is attributed correctly.
 *
 * 1. Install a `built-dep` package (own tsconfig, `sourceMap: true`) whose
 *    `index.ts` has a called and an uncalled export behind a tall comment.
 * 2. Run an entry that calls only the called export under `NODE_V8_COVERAGE`.
 * 3. Assert the dependency script's map `data` is present and real, `unused`
 *    records zero executions, and `used` at least one.
 */
export const test_ttsx_coverage_source_map_is_inlined_for_a_built_dependency =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/built-dep/package.json": JSON.stringify({
        name: "built-dep",
        version: "1.0.0",
        exports: { ".": "./src/index.ts" },
      }),
      "node_modules/built-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          sourceMap: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/built-dep/src/index.ts": tallCommentLibrarySource(),
      "src/main.ts": ['import { used } from "built-dep";', "used();", ""].join(
        "\n",
      ),
    });

    const run = runTtsxWithCoverage(root, "src/main.ts");
    assert.equal(run.status, 0, run.stderr);

    const script = run.scriptEndingWith("index.ts");
    assert.ok(script, "coverage must record the served dependency script");
    assert.ok(
      script.sourceMap !== null,
      "the dependency's source-map-cache.data must be present, not null",
    );

    const mapped = sourceMapSourcePath(script);
    const real = fs.realpathSync(
      path.join(root, "node_modules", "built-dep", "src", "index.ts"),
    );
    assert.ok(mapped, "the inlined map must list a source path");
    assert.equal(
      caseFold(path.normalize(mapped)),
      caseFold(real),
      "the map's source must be the dependency's real absolute index.ts",
    );

    assert.equal(
      maxFunctionCount(script, "unused"),
      0,
      "the never-called dependency export must record zero executions",
    );
    assert.ok(
      maxFunctionCount(script, "used") >= 1,
      "the called dependency export must record at least one execution",
    );
  };

function caseFold(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}
