import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies runner corpus: ttsx executes the intended entrypoint and side
 * effects.
 *
 * Ttsx must run the entry module in a child process whose `process.argv` and
 * `process.cwd()` match the values a normal Node.js invocation would provide.
 * Arguments after `--` must be forwarded verbatim as the child's argv.
 *
 * 1. Create an entry that writes its argv, cwd, and an execution flag to a marker
 *    file.
 * 2. Run ttsx with extra argv after `--`.
 * 3. Assert the marker file contains the expected argv and cwd values.
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
