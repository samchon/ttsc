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
 * Verifies ttsx forces a map on a dependency build whose own tsconfig emits
 * none (`sourceMap: false`), so dependency coverage works regardless (issue
 * #353).
 *
 * The dependency build has its own `runBuild` call site (`buildDependency`),
 * distinct from the entry build, so its forced-map override must be pinned
 * separately from the entry's. A source-shipping dependency that publishes
 * without maps must still yield resolvable coverage when run through ttsx.
 *
 * 1. Install a `built-dep` package whose tsconfig sets `sourceMap: false`.
 * 2. Run an entry that calls only its called export under `NODE_V8_COVERAGE`.
 * 3. Assert the dependency script's map `data` is present and real, `unused`
 *    records zero executions, and `used` at least one.
 */
export const test_ttsx_coverage_source_map_is_inlined_for_a_built_dependency_without_maps =
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
          sourceMap: false,
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
      "a forced dependency map must make source-map-cache.data present",
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
