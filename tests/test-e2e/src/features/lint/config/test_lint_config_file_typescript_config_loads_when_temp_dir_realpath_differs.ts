import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import {
  assert,
  createLintProject,
  runLintProject,
} from "../../../internal/lint/internal/config-file";

/**
 * Verifies that a `.ts` lint config loads when the loader temp dir realpaths
 * differently from the path returned by the OS temp API.
 *
 * Reproduces the macOS `/var -> /private/var` shape with a test-local symlink:
 * the config project lives beside the symlink, while `TMPDIR` points through
 * it. Before the loader realpathed its temp dir, ttsx compiled `lint.config.ts`
 * imports to `lint.config.js`, Node resolved them from the real loader path,
 * and the import drifted to a non-existent sibling.
 *
 * 1. Create `var -> private/var` and a project under `Users/project` in the same
 *    synthetic root.
 * 2. Run real ttsc with `TMPDIR`, `TMP`, and `TEMP` pointing at the symlinked temp
 *    root.
 * 3. Assert the TypeScript lint config is evaluated and its `no-var` rule fires
 *    instead of failing with `ERR_MODULE_NOT_FOUND`.
 *
 * @evidence contracts/testing.md#behavioral-verification The real typed-config evaluator runs with all temp environment roots pointing through a symlink or junction whose physical path differs; no-var must report exactly once and module-not-found must not occur.
 * @evidence contracts/testing.md#independent-expectations A fixed var source and no-var-only TS config define the exact finding, while the independently constructed link reproduces logical/physical temp path disagreement rather than assuming an OS-specific directory spelling.
 * @evidence contracts/testing.md#distinguishing-cases Project and linked temp tree are sibling paths under a synthetic root, and realpath changes the temp path; this distinguishes wrong generated import anchoring from ordinary same-path TS loading.
 * @evidence contracts/testing.md#execution-ownership This named entry constructs a real filesystem link and launches actual ttsc/ttsx under the changed temp environment, with no platform skip or fabricated filesystem capability.
 * @evidence contracts/e2e.md#necessary-boundary Real temporary-file materialization, Node module realpath resolution and ttsx generated imports must agree; direct path helpers or synthetic resolver records cannot establish that process/filesystem connection.
 * @evidence contracts/e2e.md#shared-execution One linked-temp launcher call verifies the whole loader connection. It reuses unchanged builtin native artifact identity, but its deliberately changed TMPDIR/TMP/TEMP cannot be replaced by a normal-env language result.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The link and project occupy an owned TestProject temporary root, and only the child receives the temp environment overrides; project cleanup runs in finally and TestProject owns the remaining root lifetime.
 * @evidence contracts/e2e.md#preserved-coverage Original successful config evaluation, exact one no-var/error finding and absence of ERR_MODULE_NOT_FOUND remain executable under actual symlink/junction resolution.
 */
export function test_lint_config_file_typescript_config_loads_when_temp_dir_realpath_differs() {
    const base = TestProject.tmpdir("ttsc-lint-realpath-base-");
    const realTemp = path.join(base, "private", "var");
    const linkTemp = path.join(base, "var");
    const projectRoot = path.join(base, "Users", "project");

    fs.mkdirSync(realTemp, { recursive: true });
    fs.symlinkSync(
      realTemp,
      linkTemp,
      process.platform === "win32" ? "junction" : "dir",
    );

    const project = createLintProject({
      name: "config-file-ts-realpath-temp",
      projectRoot,
      source: "var value = 1;\n",
      pluginConfig: {
        configFile: "./lint.config.ts",
      },
      extraSources: FixtureFiles.read("lint/lint_config_file_typescript_config_loads_when_temp_dir_realpath_differs/inputs-1"),
    });
    try {
      const result = runLintProject(project.tmpdir, [], {
        TMPDIR: linkTemp,
        TMP: linkTemp,
        TEMP: linkTemp,
      });

      assert.notEqual(result.status, 0);
      assert.deepEqual(
        result.diagnostics.map((d) => [d.rule, d.severity]),
        [["no-var", "error"]],
        result.stderr,
      );
      assert(!result.stderr.includes("ERR_MODULE_NOT_FOUND"), result.stderr);
    } finally {
      project.cleanup();
    }
  }
