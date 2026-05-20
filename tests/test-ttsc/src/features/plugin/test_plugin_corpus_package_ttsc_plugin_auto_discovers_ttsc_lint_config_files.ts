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
      JSON.stringify({ "no-var": "error" }),
    );
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      `var value = "auto-lint";\nconsole.log(value);\n`,
    );

    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-auto-lint-"),
      },
    });
    assert.notEqual(result.status, 0, "expected auto-discovered lint to run");
    assert.match(result.stderr, /\[no-var\]/);
  };
