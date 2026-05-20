import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies runner corpus: CommonJS __dirname resolves without configured
 * outDir.
 *
 * When no `outDir` is configured, ttsc emits next to the source files. ttsx
 * must still point `__dirname` at the source directory so relative paths work,
 * and must not leave any `.js` files on disk (the cache lives in the default
 * temp location, not alongside source).
 *
 * 1. Create a project without `outDir`.
 * 2. Run ttsx against the entry.
 * 3. Assert the file-relative read succeeds and no `.js` file was written
 *    alongside the source.
 */
export const test_runner_corpus_commonjs_dirname_resolves_without_configured_outdir =
  () => {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/node.d.ts": `
      declare const __dirname: string;
      declare function require(name: string): { readFileSync(file: string, encoding: string): string };
    `,
      "src/main.ts": `
      const fs = require("node:fs");
      console.log(fs.readFileSync(__dirname + "/../template/data.txt", "utf8"));
    `,
      "template/data.txt": "no-outdir-preserved",
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "no-outdir-preserved");
    assert.equal(fs.existsSync(path.join(root, "src", "main.js")), false);
  };
