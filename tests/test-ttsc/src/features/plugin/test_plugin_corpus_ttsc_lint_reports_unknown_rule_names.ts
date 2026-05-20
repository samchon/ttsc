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
 * Verifies plugin corpus: @ttsc/lint reports unknown rule names.
 *
 * When the user configures a rule name that the lint binary does not recognise,
 * the binary should warn in stderr and continue rather than aborting. This
 * keeps the build non-fatal so a future rule enabled in CI does not break
 * developers on an older binary version that lacks it.
 *
 * 1. Configure a project with the nonexistent rule `made-up-rule: error`.
 * 2. Run ttsc with `--noEmit`.
 * 3. Assert zero exit and `ignoring unknown rule "made-up-rule"` in stderr.
 */
export const test_plugin_corpus_ttsc_lint_reports_unknown_rule_names = () => {
  const root = setupLintProject("lint-violations");
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        plugins: [
          {
            transform: "@ttsc/lint",
            config: {
              "made-up-rule": "error",
            },
          },
        ],
      },
      include: ["src"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    `export const value: string = "ok";\n`,
  );
  const cacheDir = TestProject.tmpdir("ttsc-lint-unknown-");
  const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
    cwd: root,
    env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /ignoring unknown rule "made-up-rule"/);
};
