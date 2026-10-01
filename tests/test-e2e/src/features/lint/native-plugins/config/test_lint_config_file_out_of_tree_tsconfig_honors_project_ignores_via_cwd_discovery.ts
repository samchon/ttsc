import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { TtscCompiler } from "../../../../../../../packages/ttsc/lib/index.js";
import {
  TSGO_BINARY,
  TTSX_BIN,
  assert,
  createLintProject,
  lintGoPath,
} from "../../../../internal/lint/internal/config-file";

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
 *
 *    - Local `no-console`) and none reference the ignored files.
 *
 * @evidence contracts/testing.md#behavioral-verification A real TtscCompiler compiles through an out-of-tree wrapper with no lint config; it must discover the cwd config and produce exactly main.ts no-var/no-console errors while inherited generated-file findings stay absent.
 * @evidence contracts/testing.md#independent-expectations Authored main and generated sources plus explicit base/local rules and global ignores define two allowed findings; exact basename, rule prefix and category tuples and an empty generated-file list are asserted independently of discovery code.
 * @evidence contracts/testing.md#distinguishing-cases The wrapper lies outside the project and has no config, requiring cwd fallback. Included dot-directory and declaration sources test global ignores; the complementary wrapper-config case owns wrapper precedence.
 * @evidence contracts/testing.md#execution-ownership This named entry invokes the built compiler API and actual native host; TestLoadRuleConfigResolvesLinearExtendsChain and TestLoadRuleConfigExtendsWithIgnoresAndRulesIgnoresGlobally own exact config-fold semantics in the Go unit batch.
 * @evidence contracts/e2e.md#necessary-boundary The built compiler's generated wrapper context must reach native discovery with the original project/cwd and ignored-file selection intact; direct Go config calls cannot establish that wrapper-to-native connection.
 * @evidence contracts/e2e.md#shared-execution One compiler invocation verifies wrapper fallback, inherited rules and ignores together. The builtin producer uses sharedPluginCache and sharedGoBuildCache rather than another rule-specific native compilation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh project and a distinct config-less wrapper are removed in finally; the compile result belongs to this wrapper/context, while immutable builtin compiler/plugin source identity can reuse cached artifacts.
 * @evidence contracts/e2e.md#preserved-coverage Original failure type, no ignored findings and exact main.ts rule/category tuples remain executable; direct Go owners retain the original JSON/source distinctions and add valid and unignored controls.
 */
export function test_lint_config_file_out_of_tree_tsconfig_honors_project_ignores_via_cwd_discovery() {
    const source = "var value = 1;\nconsole.log(value);\n";
    const project = createLintProject({
      name: "config-file-out-of-tree-ignores",
      source,
      pluginConfig: {},
      extraSources: FixtureFiles.read("lint/lint_config_file_out_of_tree_tsconfig_honors_project_ignores_via_cwd_discovery/inputs-1"),
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
        cacheDir: TestProject.sharedPluginCache(),
        cwd: project.tmpdir,
        env: {
          PATH: lintGoPath(),
          TTSC_GO_CACHE_DIR: TestProject.sharedGoBuildCache(),
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
  }
