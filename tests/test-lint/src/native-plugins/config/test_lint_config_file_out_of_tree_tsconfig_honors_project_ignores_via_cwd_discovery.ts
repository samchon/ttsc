import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { TtscCompiler } from "../../../../../packages/ttsc/lib/index.js";
import {
  TSGO_BINARY,
  TTSX_BIN,
  assert,
  createLintProject,
  lintGoPath,
} from "../../internal/config-file";

/**
 * Verifies that a `TtscCompiler` invocation whose tsconfig lives outside the
 * project tree still discovers the project's lint config from `cwd` and honors
 * its top-level `ignores` — including for extends-inherited rules.
 *
 * This is the `@ttsc/unplugin` invocation shape: the bundler adapter writes a
 * wrapper tsconfig into the system temp dir (extending the real project
 * tsconfig) and compiles with cwd/projectRoot pointing at the project. The
 * wrapper's ancestry holds no lint config, so discovery must fall back to the
 * cwd origin; and the discovered config's `extends` + `ignores` + `rules` shape
 * must exclude the ignored generated files from the inherited base rules, not
 * only from its own rules entry.
 *
 * 1. Materialize a Next.js-shaped project: tsconfig includes `.next/types/**` plus
 *    `next-env.d.ts`, and `lint.config.json` extends a base config (`no-var`,
 *    `typescript/triple-slash-reference`) while ignoring the generated files
 *    and enabling `no-console` locally.
 * 2. Write a wrapper tsconfig into a separate temp dir and compile via
 *    `TtscCompiler` with cwd/projectRoot = the project.
 * 3. Assert the failure diagnostics all point at `src/main.ts` (inherited `no-var`
 *    + local `no-console`) and none reference the ignored files.
 */
export const test_lint_config_file_out_of_tree_tsconfig_honors_project_ignores_via_cwd_discovery =
  () => {
    const source = "var value = 1;\nconsole.log(value);\n";
    const project = createLintProject({
      name: "config-file-out-of-tree-ignores",
      source,
      pluginConfig: {},
      extraSources: {
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "commonjs",
            strict: true,
            noEmit: true,
            plugins: [{ transform: "@ttsc/lint" }],
          },
          include: ["next-env.d.ts", ".next/types/**/*.ts", "src"],
        }),
        "lint.config.json": JSON.stringify({
          extends: "./base.config.json",
          ignores: [".next/**/*.ts", "next-env.d.ts"],
          rules: { "no-console": "error" },
        }),
        "base.config.json": JSON.stringify({
          rules: {
            "no-var": "error",
            "typescript/triple-slash-reference": "error",
          },
        }),
        ".next/types/validator.ts":
          "var generated = 1;\nexport const gen = generated;\n",
        "next-env.d.ts": '/// <reference path="./src/main.ts" />\n',
      },
    });
    const wrapper = TestProject.tmpdir("ttsc-lint-out-of-tree-");
    try {
      const tsconfig = path.join(wrapper, "tsconfig.json");
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
      const leaked = result.diagnostics.filter(
        (d) =>
          d.file !== null &&
          (d.file.includes(".next") || d.file.includes("next-env")),
      );
      assert.deepEqual(
        leaked,
        [],
        `ignored files must not be linted:\n${JSON.stringify(result.diagnostics, null, 2)}`,
      );
      assert.deepEqual(
        result.diagnostics.map((d) => [
          d.file === null ? null : path.basename(d.file),
          d.messageText.slice(0, d.messageText.indexOf("]") + 1),
          d.category,
        ]),
        [
          ["main.ts", "[no-var]", "error"],
          ["main.ts", "[no-console]", "error"],
        ],
        JSON.stringify(result.diagnostics, null, 2),
      );
    } finally {
      fs.rmSync(wrapper, { recursive: true, force: true });
      project.cleanup();
    }
  };
