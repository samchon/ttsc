import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies runner corpus: CommonJS __dirname resolves from configured outDir.
 *
 * This ttsx runner corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
