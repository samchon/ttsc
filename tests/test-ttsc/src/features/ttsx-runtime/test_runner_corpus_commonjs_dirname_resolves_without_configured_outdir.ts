import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies runner corpus: CommonJS __dirname resolves without configured
 * outDir.
 *
 * This ttsx runner corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
