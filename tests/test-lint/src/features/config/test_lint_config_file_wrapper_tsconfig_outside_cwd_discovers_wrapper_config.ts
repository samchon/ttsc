import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
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
 * Verifies that when the tsconfig passed to `TtscCompiler` lives outside the
 * project CWD, the lint config is discovered relative to the wrapper tsconfig's
 * directory rather than the CWD.
 *
 * Pins the wrapper-tsconfig config-discovery path. A monorepo root may extend a
 * package tsconfig while providing its own `lint.config.json`; the engine must
 * resolve the lint config from the wrapper tsconfig's directory, not from the
 * inner project's root. Without this, the wrapper's rules would never be seen
 * and the outer project's lint setup would be silently ignored.
 *
 * 1. Materialise a project with a `lint.config.json` in its root.
 * 2. Create a separate wrapper directory with its own `lint.config.json` and a
 *    tsconfig that extends the project's tsconfig.
 * 3. Compile via `TtscCompiler` using the wrapper tsconfig; assert the wrapper's
 *    `no-var` rule fires (not the project's `no-console` rule).
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
    const wrapper = TestProject.tmpdir("ttsc-lint-wrapper-");
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
            "[no-var] Unexpected var, use let or const instead.\n  ~~~",
            "error",
          ],
        ],
      );
    } finally {
      fs.rmSync(wrapper, { recursive: true, force: true });
      project.cleanup();
    }
  };
