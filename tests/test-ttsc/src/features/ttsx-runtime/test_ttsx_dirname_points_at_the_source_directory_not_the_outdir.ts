import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs the entry from source, so `__dirname` is the source
 * directory rather than the configured `outDir`.
 *
 * ttsx is a ts-node-style runner: it type-checks and builds the project, then
 * executes the entry _at its source path_ with the build served under that URL.
 * A file that exists only in the source tree (never emitted) must therefore be
 * readable relative to `__dirname`. This pins the run-from-source contract that
 * lets `DynamicExecutor`-style harnesses discover sibling `.ts` files by
 * `__dirname`.
 *
 * 1. Create a CommonJS project with `outDir: "dist"` and a `marker.txt` that
 *    lives only under `src/`.
 * 2. Run ttsx against the entry, which reads `__dirname + "/marker.txt"`.
 * 3. Assert the source-only file was found and printed.
 */
export const test_ttsx_dirname_points_at_the_source_directory_not_the_outdir =
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
      "src/marker.txt": "source-relative-dirname",
      "src/main.ts": [
        `declare const __dirname: string;`,
        `declare function require(name: string): {`,
        `  readFileSync(file: string, encoding: string): string;`,
        `};`,
        `const fs = require("node:fs");`,
        `console.log(fs.readFileSync(__dirname + "/marker.txt", "utf8"));`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "source-relative-dirname");
  };
