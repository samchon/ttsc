import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: package ttsc.plugin auto-discovers @ttsc/lint config
 * files.
 *
 * When `@ttsc/lint` appears in package.json's `devDependencies`, the
 * auto-plugin loader must pick up `lint.config.json` from the project root and
 * apply it as the lint rule set — without requiring an explicit `transform`
 * entry in tsconfig. This validates the zero-config integration path for lint
 * consumers.
 *
 * 1. Set up a project with `@ttsc/lint` in `devDependencies`, a `lint.config.json`
 *    enabling the `no-var` rule, and a source file that uses `var`.
 * 2. Run ttsc with `--noEmit` (no explicit lint plugin in tsconfig).
 * 3. Assert non-zero exit and `[no-var]` in stderr.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc --noEmit discovers lint from devDependencies and returns a no-var diagnostic with failure.
 * @evidence contracts/testing.md#independent-expectations The handwritten config enables no-var and the source deliberately declares var.
 * @evidence contracts/testing.md#distinguishing-cases No compilerOptions.plugins entry is present; the missing-config case owns rejection when discovery has no config.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_package_ttsc_plugin_auto_discovers_ttsc_lint_config_files entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The CLI discovers the workspace-linked lint package from devDependencies, finds its config and delivers no-var output from the native lint host. The rule semantic unit cannot prove package metadata activates the host without an explicit tsconfig plugin.
 * @evidence contracts/e2e.md#shared-execution This consumer links the existing workspace lint package and selects the shared producer cache. Its separate --noEmit invocation carries package discovery without compilerOptions.plugins; no actual cache-hit, total build or minimum-preparation count is observed. Workspace linking does not certify packed installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the consumer while the shared cache remains separately suite-owned. Consumer-only source/config changes do not rewrite the linked workspace producer. Binary reuse requires equivalent source, host and toolchain inputs. Child-specific environment leaves ambient state unchanged; returned direct command does not certify arbitrary descendants or loaded-image equality.
 * @evidence contracts/e2e.md#preserved-coverage ttsc --noEmit discovers lint from devDependencies and returns a no-var diagnostic with failure. These assertions stay in test_plugin_corpus_package_ttsc_plugin_auto_discovers_ttsc_lint_config_files with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_package_ttsc_plugin_auto_discovers_ttsc_lint_config_files =
  () => {
    const root = setupLintProject("lint-violations");
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ devDependencies: { "@ttsc/lint": "*" } }),
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
    );
    fs.writeFileSync(
      path.join(root, "lint.config.json"),
      JSON.stringify({ rules: { "no-var": "error" } }),
    );
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      `var value = "auto-lint";\nconsole.log(value);\n`,
    );

    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(typeof result.status, "number");
    assert.notEqual(result.status, 0, "expected auto-discovered lint to run");
    assert.match(result.stderr, /\[no-var\]/);
  };
