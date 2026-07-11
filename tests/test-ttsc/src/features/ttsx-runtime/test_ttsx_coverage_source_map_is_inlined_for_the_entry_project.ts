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
 * Verifies ttsx serves the entry project's emit with an inlined, absolutized
 * source map, so Node's V8 coverage remaps it correctly (issue #353).
 *
 * Ttsx runs tsgo-built JavaScript under the original `.ts` URL. With external
 * maps (a library's default `sourceMap: true`) the served text ended with a
 * relative `//# sourceMappingURL` Node could never resolve, so V8 cached the
 * script with `data: null` and c8 misattributed lines — a never-called function
 * reported 100% covered. The serve path now inlines the sibling map and
 * rewrites its `sources` to the real absolute path, so `data` is present and
 * points at the true source; V8's raw counts (used ran, unused did not) then
 * attribute to the right lines.
 *
 * 1. Build an entry project (`sourceMap: true`) whose `lib.ts` has a called and an
 *    uncalled export behind a tall comment; run it under `NODE_V8_COVERAGE`.
 * 2. Assert the `lib.ts` script's `source-map-cache.data` is non-null and its
 *    `sources[0]` is the real absolute `lib.ts`.
 * 3. Assert V8 recorded `unused` with count 0 and `used` with count >= 1.
 */
export const test_ttsx_coverage_source_map_is_inlined_for_the_entry_project =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": JSON.stringify({
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
      "source-map-cache.data must be present, not null (the #353 failure)",
    );

    const mapped = sourceMapSourcePath(script);
    const real = fs.realpathSync(path.join(root, "src", "lib.ts"));
    assert.ok(mapped, "the inlined map must list a source path");
    assert.equal(
      caseFold(path.normalize(mapped)),
      caseFold(real),
      "the map's source must be the real absolute lib.ts, not a mis-rooted path",
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
