import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies runner corpus: type-check diagnostics prevent entry execution.
 *
 * This ttsx runner corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
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
  };
