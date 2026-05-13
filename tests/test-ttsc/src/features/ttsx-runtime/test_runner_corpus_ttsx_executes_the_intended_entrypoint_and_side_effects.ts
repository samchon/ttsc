import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies runner corpus: ttsx executes the intended entrypoint and side
 * effects.
 *
 * This ttsx runner corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_runner_corpus_ttsx_executes_the_intended_entrypoint_and_side_effects =
  () => {
    const root = TestProject.commonJsProject({
      "src/main.ts": `
      declare const process: {
        argv: string[];
        cwd(): string;
        env: { TTSX_MARKER?: string };
      };
      declare function require(name: string): {
        writeFileSync(file: string, text: string): void;
      };

      const fs = require("node:fs");
      const marker = process.env.TTSX_MARKER;
      if (!marker) throw new Error("missing marker path");
      fs.writeFileSync(marker, JSON.stringify({
        argv: process.argv.slice(2),
        cwd: process.cwd(),
        executed: true,
      }));
      console.log("ttsx-intended-execution");
    `,
    });
    const marker = path.join(root, "runner-marker.json");

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts", "--", "--mode", "probe"],
      {
        cwd: root,
        env: {
          TTSX_MARKER: marker,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "ttsx-intended-execution");
    assert.deepEqual(JSON.parse(fs.readFileSync(marker, "utf8")), {
      argv: ["--mode", "probe"],
      cwd: root,
      executed: true,
    });
  };
