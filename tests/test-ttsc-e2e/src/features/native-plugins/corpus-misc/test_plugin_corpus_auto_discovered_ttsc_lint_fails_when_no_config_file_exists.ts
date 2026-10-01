import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: auto-discovered @ttsc/lint fails when no config file
 * exists.
 *
 * When `@ttsc/lint` is present in `package.json` dependencies but no
 * `ttsc-lint.config.*` file exists, ttsc must reject the project with a clear
 * message rather than silently running with no rules or producing a cryptic Go
 * build error from the lint sidecar.
 *
 * 1. Materialize a project that lists `@ttsc/lint` as a dependency and remove the
 *    fixture's `lint.config.json` so no lint config file remains.
 * 2. Run ttsc with `--noEmit`.
 * 3. Assert non-zero exit and a stderr message naming the missing `lint.config` /
 *    `ttsc-lint.config` files.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc --noEmit rejects package-discovered lint without configuration; nonzero status and config discovery text detect silently disabled lint.
 * @evidence contracts/testing.md#independent-expectations The fixture deliberately removes its config and the lint package requires a discovered config.
 * @evidence contracts/testing.md#distinguishing-cases Missing config is the negative discovery branch; the auto-discovers config case owns successful discovery.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_auto_discovered_ttsc_lint_fails_when_no_config_file_exists entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The CLI discovers the linked lint package from consumer metadata and invokes its descriptor config discovery. Its missing-config reason must survive launcher error handling before any native lint host is available; direct lint rule tests do not establish this package/launcher connection.
 * @evidence contracts/e2e.md#shared-execution One temporary consumer and one invocation of the already built CLI suffice for this descriptor/discovery rejection. No native build is required or claimed; sharing the built launcher does not share mutable package exports, contributor modules or config absence across consumers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage ttsc --noEmit rejects package-discovered lint without configuration; nonzero status and config discovery text detect silently disabled lint. These assertions stay in test_plugin_corpus_auto_discovered_ttsc_lint_fails_when_no_config_file_exists with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_auto_discovered_ttsc_lint_fails_when_no_config_file_exists =
  () => {
    const root = setupLintProject("lint-violations");
    fs.rmSync(path.join(root, "lint.config.json"), { force: true });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { "@ttsc/lint": "*" } }),
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
      path.join(root, "src", "main.ts"),
      `export const value = "no-config";\n`,
    );

    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });
    assert.notEqual(result.status, 0, "expected missing lint config to fail");
    assert.match(result.stderr, /config.*ttsc-lint\.config/s);
  };
