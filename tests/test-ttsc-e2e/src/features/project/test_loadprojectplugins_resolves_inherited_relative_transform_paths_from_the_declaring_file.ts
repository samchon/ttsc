import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  loadProjectPlugins,
  os,
  path,
} from "../../internal/project";

/**
 * Verifies loadProjectPlugins resolves inherited relative transform paths from
 * the declaring file.
 *
 * When a parent tsconfig declares `plugins: [{transform:
 * "./plugins/base.cjs"}]` and a child tsconfig extends it, the
 * `./plugins/base.cjs` path must be resolved relative to the parent file — not
 * the child file — so the plugin CJS module is found at the correct location on
 * disk.
 *
 * 1. Create a `config/tsconfig.json` that declares a relative plugin path, and a
 *    `project/tsconfig.json` that extends it.
 * 2. Invoke `loadProjectPlugins` against the child tsconfig.
 * 3. Assert that loading throws `must declare source` (the plugin resolves to the
 *    right file, which has an empty `source`, rather than failing with a
 *    module-not-found error).
 *
 * @evidence contracts/testing.md#behavioral-verification The inherited CommonJS descriptor reaches must-declare-source validation instead of a missing-module failure.
 * @evidence contracts/testing.md#independent-expectations Only the parent config directory contains the authored descriptor; its empty source independently fixes the expected validation error.
 * @evidence contracts/testing.md#distinguishing-cases 1. Create a `config/tsconfig.json` that declares a relative plugin path, and a `project/tsconfig.json` that extends it. 2. Invoke `loadProjectPlugins` against the child tsconfig. 3. Assert that loading throws `must declare source` (the plugin resolves to the right file, which has an empty `source`, rather than failing with a module-not-found error).
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution All loads in this named case reuse its private fixture and cache. Descriptor reevaluation is retained only for a distinct format, changed input/proof state or intentionally nonreusable factory; an unchanged proven evaluation uses the same cache. Fake Go fixtures avoid rebuilding a real plugin where this case already supplies them.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The TestProject-owned root separates module selection and descriptor records from other cases. Authored edits and aged records remain within that root; synchronous evaluator/build children finish before assertions, and TestProject registers temporary roots for process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The inherited CommonJS descriptor reaches must-declare-source validation instead of a missing-module failure. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_loadprojectplugins_resolves_inherited_relative_transform_paths_from_the_declaring_file =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const shared = path.join(root, "config");
    const project = path.join(root, "project");
    fs.mkdirSync(path.join(shared, "plugins"), { recursive: true });
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(
      path.join(shared, "plugins", "base.cjs"),
      `module.exports = { name: "base-relative", source: "" };\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(shared, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            plugins: [{ transform: "./plugins/base.cjs" }],
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(project, "tsconfig.json"),
      JSON.stringify({ extends: "../config/tsconfig.json" }, null, 2),
      "utf8",
    );

    assert.throws(
      () =>
        loadProjectPlugins({
          binary: "",
          tsconfig: path.join(project, "tsconfig.json"),
        }),
      /must declare source/,
    );
  };
