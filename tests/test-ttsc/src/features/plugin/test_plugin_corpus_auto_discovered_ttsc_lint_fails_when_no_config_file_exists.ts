import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  goPath,
  os,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

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
 * 3. Assert non-zero exit and stderr that references `config.*ttsc-lint.config`.
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
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-auto-lint-missing-config-"),
      },
    });
    assert.notEqual(result.status, 0, "expected missing lint config to fail");
    assert.match(result.stderr, /config.*ttsc-lint\.config/s);
  };
