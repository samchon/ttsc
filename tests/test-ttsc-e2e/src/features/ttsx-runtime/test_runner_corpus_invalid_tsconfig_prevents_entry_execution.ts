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
 *
 * @evidence contracts/testing.md#behavioral-verification Actual launcher receives truncated tsconfig, must fail with the compiler reader location diagnostic, print no entry marker and create no side-effect marker file.
 * @evidence contracts/testing.md#independent-expectations The literal truncated object requires a closing brace; the authored marker file and stdout string would appear only if the entry executed, independently of configuration parsing.
 * @evidence contracts/testing.md#distinguishing-cases Malformed configuration must stop a valid executable entry before its effects. Direct readProjectConfig tests own parsing decisions; this case owns public rejection transport and effects gating.
 * @evidence contracts/testing.md#execution-ownership This named E2E export starts the real public launcher; its entry file is input and marker absence is checked by the test owner.
 * @evidence contracts/e2e.md#necessary-boundary The launcher must connect reader failure to nonzero stderr and prevent Node entry effects. A reader throw alone cannot prove the launch path respects that gate.
 * @evidence contracts/e2e.md#shared-execution One minimal rejection invocation needs no consumer installation or separate contributor build. No compiler success or runtime preparation is asserted for this rejected configuration.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The marker path starts absent inside the private fixture. Synchronous launcher completion precedes both absence observations and TestProject cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All original nonzero status, closing-brace/location diagnostic, absent stdout marker and absent filesystem effect remain in this rejection case.
 */
export function test_runner_corpus_invalid_tsconfig_prevents_entry_execution() {
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
    // The reader reports a truncated config with the compiler's own TS1005
    // wording, at the line and column where the text ended.
    assert.match(result.stderr, /'\}' expected \(line 1 column \d+\)/);
    assert.doesNotMatch(result.stdout, /invalid-config-should-not-run/);
    assert.equal(fs.existsSync(marker), false);
  }
