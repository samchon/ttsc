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
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
