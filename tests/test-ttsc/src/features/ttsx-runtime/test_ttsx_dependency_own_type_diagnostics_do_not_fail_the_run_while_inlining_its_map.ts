import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  runTtsxWithCoverage,
  sourceMapSourcePath,
} from "../../internal/ttsx-source-map";

/**
 * Verifies a dependency's OWN type diagnostics never fail a ttsx run, even
 * while ttsx builds that dependency to obtain a source map to inline (issue
 * #353).
 *
 * A source-shipping dependency is built under its own (possibly stricter)
 * tsconfig for type-aware emit, but its diagnostics belong to that package, not
 * the user's program — the dependency build runs emit-only
 * (`skipDiagnosticsCheck`). This pins that a dependency whose config would trip
 * `noUnusedLocals`/`noUnusedParameters` still emits, runs, and yields an
 * inlined map, so the map work added for #353 cannot start gating on foreign
 * diagnostics.
 *
 * 1. Install a `built-dep` whose tsconfig sets `noUnusedLocals` /
 *    `noUnusedParameters` and whose source carries an unused local and
 *    parameter (a real TS6133 under that config).
 * 2. Run an entry that imports and calls it under `NODE_V8_COVERAGE`.
 * 3. Assert exit 0, the dependency executed, and its map `data` inlined with the
 *    real source path.
 */
export const test_ttsx_dependency_own_type_diagnostics_do_not_fail_the_run_while_inlining_its_map =
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
          noUnusedLocals: true,
          noUnusedParameters: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      // Under the dependency's own `noUnusedLocals`/`noUnusedParameters` this is
      // a real TS6133 pair — invisible to the user, and it must not fail the run.
      "node_modules/built-dep/src/index.ts": [
        "export function greet(unusedParam: number): string {",
        "  const unusedLocal: number = 1;",
        '  return "greet ran";',
        "}",
        "",
      ].join("\n"),
      "src/main.ts": [
        'import { greet } from "built-dep";',
        "greet(1);",
        "",
      ].join("\n"),
    });

    const run = runTtsxWithCoverage(root, "src/main.ts");
    assert.equal(
      run.status,
      0,
      `a dependency's own type diagnostics must not fail the run\n${run.stderr}`,
    );

    const script = run.scriptEndingWith("index.ts");
    assert.ok(script, "coverage must record the served dependency script");
    assert.ok(
      script.sourceMap !== null,
      "the dependency's map must still inline (data present)",
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
  };

function caseFold(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}
