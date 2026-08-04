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
 */
export const test_descriptor_keeps_the_exit_status_when_the_evaluator_names_no_reason =
  (): void => {
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
  };
