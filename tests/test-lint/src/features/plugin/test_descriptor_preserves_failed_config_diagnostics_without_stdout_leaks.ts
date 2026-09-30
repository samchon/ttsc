import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../internal/TestLintPlugin";
import { createLintProject } from "../../internal/config-file";

/**
 * Verifies a failed isolated config evaluation preserves its human diagnostics
 * exactly once without writing any byte to the machine-output stream.
 *
 * 1. Create a TypeScript config that logs to both streams and then throws.
 * 2. Resolve the descriptor in a child process with the real ttsx/tsgo pair.
 * 3. Assert failure leaves stdout empty and forwards both logs plus the cause.
 * 4. Assert forwarding does not duplicate the evaluator's captured streams.
 *
 * @evidence contracts/testing.md#behavioral-verification A typed config logs to both streams and throws through the real evaluator; the outer process must fail, leave stdout empty, preserve the cause and forward each original log exactly once.
 * @evidence contracts/testing.md#independent-expectations Fixture literal logs and the intentional thrown reason define exact independent occurrence counts and the machine-output stream must remain empty on failure.
 * @evidence contracts/testing.md#distinguishing-cases Both stdout and stderr logs precede a thrown error; duplicate-forwarding and stdout-leak defects remain distinguishable from the successful descriptor-JSON boundary and envelope-less exit boundary.
 * @evidence contracts/testing.md#execution-ownership The named entry runs the built descriptor inside an actual child process with the real launcher/compiler environment and asserts its exit and complete captured streams.
 * @evidence contracts/e2e.md#necessary-boundary Config log redirection, isolated evaluator failure and parent stream forwarding form a process connection not established by direct error-classifier units.
 * @evidence contracts/e2e.md#shared-execution One outer process and one typed-config evaluator preserve all failure-stream assertions together; neither Go compilation nor native host preparation occurs. The failing outcome cannot share the successful JSON-producing outer process lifetime.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The temporary project is removed in finally; subprocess capture owns its streams and cannot contaminate another entry's machine output. Shared built launcher/compiler bytes are immutable inputs.
 * @evidence contracts/e2e.md#preserved-coverage Original nonzero status, empty stdout, cause text, failure-status text and both exact-one log occurrence assertions remain unchanged.
 */
export function test_descriptor_preserves_failed_config_diagnostics_without_stdout_leaks(): void {
    const project = createLintProject({
      name: "descriptor-failed-config-diagnostics",
      pluginConfig: { configFile: "./lint.config.ts" },
      source: "export const value = 1;\n",
    });
    try {
      fs.writeFileSync(
        path.join(project.tmpdir, "lint.config.ts"),
        [
          'console.log("failed config stdout");',
          'console.error("failed config stderr");',
          'throw new Error("intentional config failure");',
          "",
        ].join("\n"),
        "utf8",
      );
      const context = {
        ...TestLintPlugin.factoryContext({
          configFile: "./lint.config.ts",
          transform: "@ttsc/lint",
        }),
        cwd: project.tmpdir,
        pluginConfigDir: project.tmpdir,
        projectRoot: project.tmpdir,
        tsconfig: path.join(project.tmpdir, "tsconfig.json"),
      };
      const script = `
const mod = require(${JSON.stringify(TestLintPlugin.DESCRIPTOR_PATH)});
const factory = mod.createTtscPlugin ?? mod.default ?? mod;
factory(${JSON.stringify(context)});
`;
      const result = spawnSync(process.execPath, ["-e", script], {
        encoding: "utf8",
        env: {
          ...process.env,
          TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
          TTSC_TTSX_BINARY: TestProject.TTSX_BIN,
        },
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      });
      assert.notEqual(result.status, 0);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /intentional config failure/);
      assert.match(result.stderr, /evaluation failed with exit code/);
      assert.equal(countOccurrences(result.stderr, "failed config stdout"), 1);
      assert.equal(countOccurrences(result.stderr, "failed config stderr"), 1);
    } finally {
      project.cleanup();
    }
  }

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}
