import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../internal/TestLintPlugin";
import { createLintProject } from "../../internal/config-file";

/**
 * Verifies an evaluation that names no reason reports only its exit status.
 *
 * The evaluator streams the child's output and recovers an actionable reason
 * from a well-formed envelope in the result file. This is the negative twin of
 * `test_descriptor_rejects_malformed_cjs_contributors`: a config that ends the
 * process itself runs no catch, so no envelope exists, and the parent must
 * report the status alone rather than attaching whatever the file holds.
 *
 * 1. Declare a config whose top-level code exits with a distinctive status.
 * 2. Resolve the descriptor and capture the thrown error.
 * 3. Assert it is the single-line message carrying that exact status.
 *
 * @evidence contracts/testing.md#behavioral-verification A real CJS config exits its evaluator with status 7; the factory must throw that exact exit status without appending a nonexistent reason or newline.
 * @evidence contracts/testing.md#independent-expectations The fixture explicitly exits 7 before exporting, so no error envelope can be produced; literal status and single-line assertions derive from this input protocol.
 * @evidence contracts/testing.md#distinguishing-cases This unhandled-exit negative differs from a thrown config error with an envelope; source classifier units own synthetic status and malformed-envelope decisions.
 * @evidence contracts/testing.md#execution-ownership The named entry resolves the built factory and lets its real isolated evaluator execute the config; it asserts the thrown error itself.
 * @evidence contracts/e2e.md#necessary-boundary Real process termination must bypass evaluator catch/result-file publication; a direct classifier call cannot prove that connection.
 * @evidence contracts/e2e.md#shared-execution This terminating config requires its own evaluator lifetime because process.exit(7) destroys the process; it performs no Go build or native host launch and reuses the built factory and launcher artifacts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The config lives in a fresh owned project removed in finally; its destructive exit affects only the isolated evaluator, not the suite process or another config result file.
 * @evidence contracts/e2e.md#preserved-coverage Original status-7 matching and absent-newline assertions are retained; failure-envelope stream preservation has its separate real boundary owner.
 */
export function test_descriptor_keeps_the_exit_status_when_the_evaluator_names_no_reason(): void {
    const project = createLintProject({
      name: "descriptor-evaluator-without-reason",
      pluginConfig: { configFile: "./lint.config.cjs" },
      source: "export const value = 1;\n",
    });
    try {
      fs.writeFileSync(
        path.join(project.tmpdir, "lint.config.cjs"),
        ["process.exit(7);", "module.exports = { plugins: {} };", ""].join(
          "\n",
        ),
        "utf8",
      );
      assert.throws(
        () => {
          const factory = TestLintPlugin.loadFactory();
          factory({
            ...TestLintPlugin.factoryContext({
              configFile: "./lint.config.cjs",
              transform: "@ttsc/lint",
            }),
            cwd: project.tmpdir,
            pluginConfigDir: project.tmpdir,
            projectRoot: project.tmpdir,
            tsconfig: path.join(project.tmpdir, "tsconfig.json"),
          });
        },
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /evaluation failed with exit code 7$/);
          assert.equal(
            error.message.includes("\n"),
            false,
            `an unnamed failure attached a reason: ${error.message}`,
          );
          return true;
        },
      );
    } finally {
      project.cleanup();
    }
  }
