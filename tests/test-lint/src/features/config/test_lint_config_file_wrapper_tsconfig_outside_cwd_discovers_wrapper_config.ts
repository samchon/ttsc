import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TtscCompiler } from "../../../../../packages/ttsc/lib/index.js";
import {
  SOURCE,
  TSGO_BINARY,
  TTSX_BIN,
  assert,
  createLintProject,
  lintGoPath,
} from "../../internal/config-file";

/**
 * Verifies lint config file: wrapper tsconfig outside cwd discovers wrapper
 * config.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_wrapper_tsconfig_outside_cwd_discovers_wrapper_config =
  () => {
    const project = createLintProject({
      name: "config-file-wrapper-outside-cwd",
      source: SOURCE,
      pluginConfig: {},
      extraSources: {
        "lint.config.json": JSON.stringify({
          "no-console": "error",
        }),
      },
    });
    const wrapper = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-lint-wrapper-"),
    );
    try {
      const tsconfig = path.join(wrapper, "tsconfig.json");
      fs.writeFileSync(
        path.join(wrapper, "lint.config.json"),
        JSON.stringify({ "no-var": "error" }),
        "utf8",
      );
      fs.writeFileSync(
        tsconfig,
        JSON.stringify({ extends: path.join(project.tmpdir, "tsconfig.json") }),
        "utf8",
      );
      const compiler = new TtscCompiler({
        cacheDir: path.join(project.tmpdir, ".cache", "ttsc"),
        cwd: project.tmpdir,
        env: {
          PATH: lintGoPath(),
          TTSC_TSGO_BINARY: TSGO_BINARY,
          TTSC_TTSX_BINARY: TTSX_BIN,
        },
        projectRoot: project.tmpdir,
        tsconfig,
      });
      const result = compiler.compile();

      assert.equal(result.type, "failure");
      assert.deepEqual(
        result.diagnostics.map((d) => [d.messageText, d.category]),
        [
          [
            "[no-var] Unexpected var, use let or const instead.\n  ~~~~~~~~~~~~~~",
            "error",
          ],
        ],
      );
    } finally {
      fs.rmSync(wrapper, { recursive: true, force: true });
      project.cleanup();
    }
  };
