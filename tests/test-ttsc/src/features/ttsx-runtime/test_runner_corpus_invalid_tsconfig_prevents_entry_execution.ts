import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies runner corpus: invalid tsconfig prevents entry execution.
 *
 * Ttsx must parse the tsconfig before compiling or running the entry. If the
 * tsconfig JSON is malformed, the process must exit with a non-zero status and
 * must not execute the entry script — even though the entry itself would
 * compile fine in isolation.
 *
 * 1. Create a project with a truncated (invalid JSON) tsconfig.
 * 2. Run ttsx; assert non-zero exit and a JSON parse error in stderr.
 * 3. Assert the entry was never executed (no marker file written).
 */
export const test_runner_corpus_invalid_tsconfig_prevents_entry_execution =
  () => {
    const root = TestProject.createProject({
      "tsconfig.json": `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,`,
      "src/main.ts": `
      declare const process: { env: { TTSX_MARKER?: string } };
      declare function require(name: string): {
        writeFileSync(file: string, text: string): void;
      };

      const fs = require("node:fs");
      const marker = process.env.TTSX_MARKER;
      if (!marker) throw new Error("missing marker path");
      fs.writeFileSync(marker, "executed");
      console.log("invalid-config-should-not-run");
    `,
    });
    const marker = path.join(root, "invalid-config-marker.txt");

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
    assert.match(result.stderr, /Unexpected end of JSON input|Expected/);
    assert.doesNotMatch(result.stdout, /invalid-config-should-not-run/);
    assert.equal(fs.existsSync(marker), false);
  };
