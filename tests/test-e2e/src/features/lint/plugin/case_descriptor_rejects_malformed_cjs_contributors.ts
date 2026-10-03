import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../../internal/lint/internal/TestLintPlugin";
import { createLintProject } from "../../../internal/lint/internal/config-file";

/**
 * Verifies isolated CJS evaluation preserves contributor validation failures.
 *
 * 1. Reject a scalar contributor instead of silently omitting its namespace.
 * 2. Reject an object without a source path at the declaring config.
 * 3. Reject a string specifier whose loaded module has no plugin source.
 *
 * @evidence contracts/testing.md#behavioral-verification The built descriptor evaluates real CJS configs and rejects scalar, source-less object and source-less required module entries with the declaring demo contributor named in the error.
 * @evidence contracts/testing.md#independent-expectations Contributor registration requires a source path; the three authored invalid values deliberately omit that requirement and the literal contributor/source error pattern is independent of validation code.
 * @evidence contracts/testing.md#distinguishing-cases Scalar 42, empty object and a relative string loading an empty module exercise distinct CJS evaluator registration paths. All three named rows are attempted and failures identify their row; direct namespace normalization does not own these malformed evaluator inputs.
 * @evidence contracts/testing.md#execution-ownership This named entry calls the emitted factory with the exact subdirectory configFile and original declaring project context, then asserts each actual failure.
 * @evidence contracts/e2e.md#necessary-boundary CJS isolated evaluation and relative module loading must return actionable contributor errors through the real result protocol; direct normalization tests do not establish this connection.
 * @evidence contracts/e2e.md#shared-execution The three invalid config inputs reuse the workspace-built factory and selected evaluator/compiler artifacts, never compiling contributors or running a native lint rule host. Three parent factory calls do not certify inner child, cache or Program counts; each fresh config/module population keeps require state separate.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each row owns a fresh project and config subdirectory, with its malformed relative module created only there. Observation and cleanup errors are independently retained before advancing to the next row. Artifact paths are not loaded-image or descendant-join witnesses; no cached successful descriptor substitutes for the error assertion.
 * @evidence contracts/e2e.md#preserved-coverage All three original invalid shapes, the relative module, explicit subdirectory config and contributor/source error pattern remain and each named row is attempted. No generic collision result replaces them; consolidated registration, actual evaluator observations and survivor execution remain unverified.
 */
export function test_descriptor_rejects_malformed_cjs_contributors(): void {
  const failures: unknown[] = [];
  for (const [name, pluginValue, moduleBody] of [
    ["scalar", "42", undefined],
    ["missing-source", "{}", undefined],
    ["malformed-module", '"../bad-contributor.cjs"', "module.exports = {};"],
  ] as const) {
    let project: ReturnType<typeof createLintProject> | undefined;
    try {
      project = createLintProject({
        name: `malformed-cjs-contributor-${name}`,
        source: "export const value = 1;\n",
        pluginConfig: { configFile: "./configs/lint.config.cjs" },
      });
      fs.mkdirSync(path.join(project.tmpdir, "configs"), { recursive: true });
      fs.writeFileSync(
        path.join(project.tmpdir, "configs", "lint.config.cjs"),
        `module.exports = { plugins: { demo: ${pluginValue} } };\n`,
        "utf8",
      );
      if (moduleBody !== undefined) {
        fs.writeFileSync(
          path.join(project.tmpdir, "bad-contributor.cjs"),
          `${moduleBody}\n`,
          "utf8",
        );
      }
      const projectRoot = project.tmpdir;
      assert.throws(
        () => loadContributors(projectRoot),
        /contributor "demo".*source/i,
      );
    } catch (error) {
      failures.push(new AggregateError([error], `Malformed CJS contributor ${name} observation failed`));
    } finally {
      try {
        project?.cleanup();
      } catch (error) {
        failures.push(new AggregateError([error], `Malformed CJS contributor ${name} owned cleanup failed`));
      }
    }
  }
  if (failures.length !== 0) {
    throw new AggregateError(failures, "Malformed CJS contributor observations or owned cleanup failed");
  }
}

function loadContributors(projectRoot: string): void {
  const factory = TestLintPlugin.loadFactory();
  factory({
    // The fixture declares its config through the tsconfig plugin entry, so a
    // hand-built context has to carry the same entry. Without it discovery
    // walks upward from the project root and never sees a config that lives
    // in a subdirectory, and the descriptor reports no contributors at all.
    ...TestLintPlugin.factoryContext({
      configFile: "./configs/lint.config.cjs",
      transform: "@ttsc/lint",
    }),
    cwd: projectRoot,
    pluginConfigDir: projectRoot,
    projectRoot,
    tsconfig: path.join(projectRoot, "tsconfig.json"),
  });
}
