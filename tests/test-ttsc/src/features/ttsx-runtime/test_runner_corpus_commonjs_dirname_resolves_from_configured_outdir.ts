import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies runner corpus: CommonJS __dirname resolves from configured outDir.
 *
 * When a project has an explicit `outDir`, ttsx must set `__dirname` for
 * CommonJS modules to the corresponding emitted output path so that relative
 * file reads (e.g. `__dirname + "/../../data.txt"`) resolve against the same
 * directory layout they would target in a normal `tsc` build.
 *
 * 1. Create a project with `outDir: "bin"` and source under `src/`.
 * 2. Run ttsx against the entry.
 * 3. Assert the program successfully reads a file relative to the emitted path and
 *    the expected content is printed.
 */
export const test_runner_corpus_commonjs_dirname_resolves_from_configured_outdir =
  () => {
    const root = TestProject.createProject({
      "app/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "bin",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "app/src/node.d.ts": `
      declare const __dirname: string;
      declare function require(name: string): { readFileSync(file: string, encoding: string): string };
    `,
      "app/src/TestGlobal.ts": `
      export class TestGlobal {
        public static readonly ROOT: string = __dirname + "/..";
      }
    `,
      "app/src/main.ts": `
      import { TestGlobal } from "./TestGlobal";

      const fs = require("node:fs");
      console.log(fs.readFileSync(TestGlobal.ROOT + "/../template/data.txt", "utf8"));
    `,
      "template/data.txt": "dirname-preserved",
    });
    const cwd = path.join(root, "app");

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", cwd, "src/main.ts"],
      { cwd },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "dirname-preserved");
  };
