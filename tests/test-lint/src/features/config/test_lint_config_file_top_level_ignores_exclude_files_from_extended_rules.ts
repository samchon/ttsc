import {
  assert,
  createLintProject,
  runLintProject,
} from "../../internal/config-file";

/**
 * Verifies that a config file's top-level `ignores` (no `files` filter)
 * excludes the matched files from rules inherited through `extends`, not just
 * from the file's own `rules` entry.
 *
 * Pins the global-ignore promotion in `linthost/config.go`
 * (`collectConfigObject`). A config file is a single ITtscLintConfig object, so
 * its top-level `ignores` is the only way to say "never lint these files"; it
 * must silence the whole resolved chain. Before the fix the promotion only ran
 * when the config had no `rules`/`format` of its own, so a Next.js-shaped
 * package whose lint.config extends a shared config, ignores `.next/**` plus
 * `next-env.d.ts`, and adds framework rules still saw the base config's rules
 * (e.g. `typescript/triple-slash-reference`, `no-var`) fire on the ignored
 * generated files.
 *
 * 1. Materialize a fixture whose tsconfig includes a dot-directory
 *    (`.next/types/**`) and a root-level `next-env.d.ts`, mirroring Next.js.
 * 2. `lint.config.json` extends `base.config.json` (enables `no-var` and
 *    `typescript/triple-slash-reference`), ignores the generated files, and
 *    enables `no-console` locally.
 * 3. Run ttsc; assert only `src/main.ts` reports (inherited `no-var` + local
 *    `no-console`) and no diagnostic names an ignored file.
 */
export const test_lint_config_file_top_level_ignores_exclude_files_from_extended_rules =
  () => {
    const source = "var value = 1;\nconsole.log(value);\n";
    const project = createLintProject({
      name: "config-file-top-level-ignores",
      source,
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
    try {
      const result = runLintProject(project.tmpdir);
      assert.notEqual(result.status, 0, result.stderr);
      const leaked = result.diagnostics.filter(
        (d) => d.file.includes(".next") || d.file.includes("next-env"),
      );
      assert.deepEqual(
        leaked,
        [],
        `ignored files must not be linted:\n${result.stderr}`,
      );
      assert.deepEqual(
        result.diagnostics.map((d) => [d.rule, d.severity]),
        [
          ["no-var", "error"],
          ["no-console", "error"],
        ],
        result.stderr,
      );
    } finally {
      project.cleanup();
    }
  };
