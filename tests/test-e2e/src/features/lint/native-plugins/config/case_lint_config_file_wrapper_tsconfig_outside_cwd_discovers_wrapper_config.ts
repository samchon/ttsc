import { LintWorkspace } from "../../../../internal/lint/LintWorkspace";
import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { TtscCompiler } from "../../../../../../../packages/ttsc/lib/index.js";
import {
  SOURCE,
  TSGO_BINARY,
  TTSX_BIN,
  assert,
  createLintProject,
  lintGoPath,
} from "../../../../internal/lint/internal/config-file";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Real TtscCompiler compiles from a separate wrapper containing no-var config while the cwd project contains competing no-console config; exactly the wrapper's rendered no-var error must result.
 * @evidence contracts/testing.md#independent-expectations The authored source triggers both potential rules, but independent competing configs enable one each; the literal full no-var message/category list proves wrapper selection and rejects the cwd decoy finding.
 * @evidence contracts/testing.md#distinguishing-cases Both search origins hold eligible configs, so accidental cwd-only selection cannot pass; the paired config-less wrapper case covers fallback rather than precedence.
 * @evidence contracts/testing.md#execution-ownership This named entry invokes the emitted compiler API with wrapper tsconfig and project cwd; packages/lint/linthost/find_lint_config_file_uses_tsconfig_directory_when_outside_cwd_test.go::TestFindLintConfigFileUsesTsconfigDirectoryWhenOutsideCwd owns the direct wrapper-versus-cwd path decision with restored empty explicit-origin channel. Its untagged root Go selection does not certify this compiler-to-host transfer or current runtime survival.
 * @evidence contracts/e2e.md#necessary-boundary The compiler must convey a wrapper-root configuration selection through real plugin/native compilation to its public diagnostic result; direct resolver inputs do not prove that context is preserved by the compiler adapter.
 * @evidence contracts/e2e.md#shared-execution One wrapper compile covers both winning no-var and losing no-console origins. The invocation supplies sharedPluginCache and sharedGoBuildCache paths without certifying an actual cache hit, loaded artifact image or total native Program construction.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The temporary wrapper and consumer have independent cleanup attempts in finally, with original operation and cleanup failures aggregated; LintWorkspace owns their parent through preparation failure. Fixed inputs reuse no fallback result. The compiler preserves absent pluginConfigDir and clears undeclared inherited origin through BuildExecution; the sync compile return does not certify arbitrary descendant join.
 * @evidence contracts/e2e.md#preserved-coverage Original failure type and exact rendered no-var message/category list remain executable, including absence of the competing cwd no-console finding.
 */
export function test_lint_config_file_wrapper_tsconfig_outside_cwd_discovers_wrapper_config() {
    const project = createLintProject({
      name: "config-file-wrapper-outside-cwd",
      source: SOURCE,
      pluginConfig: {},
      extraSources: FixtureFiles.read("lint/lint_config_file_wrapper_tsconfig_outside_cwd_discovers_wrapper_config/inputs-1"),
    });
    const wrapper = LintWorkspace.caseRoot("ttsc-lint-wrapper-", true);
    const failures: unknown[] = [];
    try {
      const tsconfig = path.join(wrapper, "tsconfig.json");
      fs.writeFileSync(
        path.join(wrapper, "lint.config.json"),
        JSON.stringify({ rules: { "no-var": "error" } }),
        "utf8",
      );
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
      assert.deepEqual(
        result.diagnostics.map((d) => [d.messageText, d.category]),
        [
          [
            "[no-var] Unexpected var, use let or const instead.\n  ~~~",
            "error",
          ],
        ],
      );
    } catch (error) {
      failures.push(error);
    } finally {
      try {
        fs.rmSync(wrapper, { recursive: true, force: true });
      } catch (error) {
        failures.push(error);
      }
      try {
        project.cleanup();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) throw new AggregateError(failures, "Wrapper lint configuration or owned cleanup failed");
  }
