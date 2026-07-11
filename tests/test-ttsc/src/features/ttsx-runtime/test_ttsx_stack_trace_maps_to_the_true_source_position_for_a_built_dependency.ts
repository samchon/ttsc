import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  THROWER_THROW_COLUMN,
  THROWER_THROW_LINE,
  tallCommentThrowerSource,
} from "../../internal/ttsx-source-map";

/**
 * Verifies stack frames map to the true source position for a built dependency,
 * the serve lane separate from the entry project (issue #353).
 *
 * A raw-`.ts` dependency from `node_modules` is served by
 * `serveBuiltDependency`; its emit must also carry an inlined, absolutized map
 * so a frame thrown inside the dependency reports the dependency's real source
 * path and line:col, not the emitted-JS line under a mis-rooted path.
 *
 * 1. Install a `built-dep` package whose `index.ts` throws behind a tall comment.
 * 2. Run an entry that calls the dependency through ttsx.
 * 3. Assert a non-zero exit and a `depBoom (<real index.ts>:12:9)` frame.
 */
export const test_ttsx_stack_trace_maps_to_the_true_source_position_for_a_built_dependency =
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
      "node_modules/built-dep/src/index.ts": tallCommentThrowerSource(
        "depBoom",
        "dependency boom",
      ),
      "src/main.ts": [
        'import { depBoom } from "built-dep";',
        "depBoom();",
        "",
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.notEqual(result.status, 0, "the thrown error must fail the run");
    const real = fs.realpathSync(
      path.join(root, "node_modules", "built-dep", "src", "index.ts"),
    );
    assertMappedFrame(result.stderr, "depBoom", real);
  };

function assertMappedFrame(stderr: string, fn: string, file: string): void {
  const frame = `${fn} (${file}:${THROWER_THROW_LINE}:${THROWER_THROW_COLUMN})`;
  assert.ok(
    fold(stderr).includes(fold(frame)),
    `stderr must contain the mapped frame "${frame}"\n---\n${stderr}`,
  );
}

function fold(value: string): string {
  const slashed = value.replace(/\\/g, "/");
  return process.platform === "win32" ? slashed.toLowerCase() : slashed;
}
