import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import {
  assert,
  createLintProject,
  runLintProject,
} from "../../internal/config-file";

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
 */
export const test_lint_config_file_typescript_config_loads_when_temp_dir_realpath_differs =
  () => {
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
      extraSources: {
        "lint.config.ts": `export default {
  rules: {
    "no-var": "error",
  },
};\n`,
      },
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
  };
