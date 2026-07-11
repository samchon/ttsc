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
 * Verifies ttsx makes coverage work even when the entry tsconfig emits no map
 * (`sourceMap: false`), by forcing a map on the transient runtime build.
 *
 * A consumer that publishes without maps must not lose ttsx coverage fidelity,
 * and forcing inline maps into everyone's `lib/` is not an acceptable
 * workaround. ttsx therefore forces an external source map on its own private,
 * PID-isolated emit (never the consumer's `outDir`) and inlines it at serve
 * time, so `source-map-cache.data` is present regardless of the owning
 * tsconfig. This pins the forced-map path in `prepareExecution`.
 *
 * 1. Build an entry project with `sourceMap: false`; run it under
 *    `NODE_V8_COVERAGE`.
 * 2. Assert the `lib.ts` script's `source-map-cache.data` is non-null and points
 *    at the real absolute source.
 * 3. Assert `unused` records zero executions and `used` at least one.
 */
export const test_ttsx_coverage_source_map_is_inlined_when_the_entry_project_emits_no_map =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": JSON.stringify({
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
      "src/lib.ts": tallCommentLibrarySource(),
      "src/main.ts": ['import { used } from "./lib";', "used();", ""].join(
        "\n",
      ),
    });

    const run = runTtsxWithCoverage(root, "src/main.ts");
    assert.equal(run.status, 0, run.stderr);

    const script = run.scriptEndingWith("lib.ts");
    assert.ok(script, "coverage must record the served lib.ts script");
    assert.ok(
      script.sourceMap !== null,
      "a forced runtime map must make source-map-cache.data present",
    );

    const mapped = sourceMapSourcePath(script);
    const real = fs.realpathSync(path.join(root, "src", "lib.ts"));
    assert.ok(mapped, "the inlined map must list a source path");
    assert.equal(
      caseFold(path.normalize(mapped)),
      caseFold(real),
      "the map's source must be the real absolute lib.ts",
    );

    assert.equal(
      maxFunctionCount(script, "unused"),
      0,
      "the never-called export must record zero executions",
    );
    assert.ok(
      maxFunctionCount(script, "used") >= 1,
      "the called export must record at least one execution (negative twin)",
    );
  };

function caseFold(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}
