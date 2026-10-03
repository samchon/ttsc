import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  loadProjectPlugins,
  os,
  path,
} from "../../../internal/ttsc/internal/project";

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
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner calls workspace loadProjectPlugins with the inherited parent/child configuration and actual isolated descriptor validation return. This case supplies no factory counter or Go publication and does not certify a packed consumer.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution One load observes inherited parent-relative descriptor validation with owner default cwd/env/cache authority. No Go publication or fake executable is supplied by this case, and no repeated-load/cache-hit/process total is asserted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked root is retained before preparation, directly or by the existing counted-project helper. Call-local environment changes do not mutate ambient state; actual synchronous result/throw does not establish arbitrary descendant join before reset. Default authority alone is not measured cold-cache proof.
 * @evidence contracts/e2e.md#preserved-coverage Original three parent/child config and descriptor files plus must-declare-source throw remain. No separate module-not-found negative assertion or exact selected-process identity is invented. Actual runtime/manifest/survival unverified and donor retained.
 */
export const test_loadprojectplugins_resolves_inherited_relative_transform_paths_from_the_declaring_file =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    TestProject.retainTemporaryDirectory(root, "Inherited descriptor descendants are not joined");
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
