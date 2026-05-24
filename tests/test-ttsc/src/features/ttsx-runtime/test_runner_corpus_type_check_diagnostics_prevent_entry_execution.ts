import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies runner corpus: type-check diagnostics prevent entry execution.
 *
 * Ttsx runs a real type-check before executing the entry. If the project has
 * type errors, the process must exit with a non-zero status and must not
 * execute the entry — even though `tsgo --noEmit` would still emit JS for files
 * with errors in `--isolatedModules` mode.
 *
 * 1. Create a project with a deliberate type error (`string = 123`).
 * 2. Run ttsx with an explicit cache dir; assert non-zero exit and the type-error
 *    diagnostic in stderr.
 * 3. Assert the entry was never executed and the runtime project output was
 *    cleaned after the failed preparation.
 */
export const test_runner_corpus_type_check_diagnostics_prevent_entry_execution =
  () => {
    const root = TestProject.commonJsProject({
      "src/main.ts": `
      declare const process: { env: { TTSX_MARKER?: string } };
      declare function require(name: string): {
        writeFileSync(file: string, text: string): void;
      };

      const fs = require("node:fs");
      const marker = process.env.TTSX_MARKER;
      if (!marker) throw new Error("missing marker path");
      fs.writeFileSync(marker, "executed");
      const message: string = 123;
      console.log("should-not-run", message);
    `,
    });
    const marker = path.join(root, "type-error-marker.txt");
    const cacheDir = path.join(root, ".ttsx-cache");

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "--cache-dir", cacheDir, "src/main.ts"],
      {
        cwd: root,
        env: {
          TTSX_MARKER: marker,
        },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /project check failed/);
    assert.match(
      result.stderr,
      /Type 'number' is not assignable to type 'string'/,
    );
    assert.doesNotMatch(result.stdout, /should-not-run/);
    assert.equal(fs.existsSync(marker), false);
    const projectCache = path.join(cacheDir, "project");
    assert.equal(fs.existsSync(projectCache), true);
    assert.deepEqual(fs.readdirSync(projectCache), []);
  };
