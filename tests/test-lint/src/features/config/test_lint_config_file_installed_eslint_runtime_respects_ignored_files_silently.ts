import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies that files matched by a flat-config `ignores` pattern are silently
 * skipped by the ESLint runtime (no diagnostic, no warning).
 *
 * Pins the ignored-file handling path for the runtime bridge. ESLint emits a
 * `ENOENT`-style warning when `warnIgnored` is set; the ttsc host must pass
 * `warnIgnored: false` and `ignore: true` so ignored files are silently
 * excluded. A misconfigured invocation would either warn about the ignored file
 * or still lint it.
 *
 * 1. Materialise a project with two sources: `src/main.ts` (to be linted) and
 *    `src/generated.ts` (listed in `ignores`).
 * 2. Run ttsc; assert only `src/main.ts` produces a diagnostic.
 */
export const test_lint_config_file_installed_eslint_runtime_respects_ignored_files_silently =
  () => {
    const result = runLint({
      name: "config-file-eslint-runtime-ignored-files",
      source: `export const value: any = 1;\n`,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
      extraSources: {
        "src/generated.ts": `export const generated: any = 1;\n`,
        "eslint.config.mjs": `import tseslint from "typescript-eslint";

      export default tseslint.config(
        {
          ignores: ["src/generated.ts"],
        },
        {
          files: ["src/**/*.ts"],
          languageOptions: {
            parser: tseslint.parser,
          },
          plugins: {
            "@typescript-eslint": tseslint.plugin,
          },
          rules: {
            "@typescript-eslint/no-explicit-any": "error",
          },
        },
      );\n`,
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.file, d.rule, d.severity]),
      [["src/main.ts", "@typescript-eslint/no-explicit-any", "error"]],
      result.stderr,
    );
  };
