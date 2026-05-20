import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that flat-config `files` and `ignores` patterns are applied per
 * source file so rules correctly scope to matched files only.
 *
 * Pins the per-file config-matching branch in the Go-side flattener. A rule
 * enabled only for `*.test.ts` files must not fire on `main.ts`; a file listed
 * in `ignores` must receive no diagnostics at all even though it is in the
 * project. Getting this wrong would either over-report on non-test files or
 * silently skip lint on test files.
 *
 * 1. Materialize a fixture with three sources: `src/main.ts`,
 *    `src/example.test.ts`, and `src/generated.ts` (ignored).
 * 2. Config disables `no-console` for `*.test.ts` and ignores `generated.ts`.
 * 3. Assert diagnostics cover only the expected file/rule combinations.
 */
export const test_lint_config_file_eslint_files_and_ignores_are_resolved_per_source_file =
  () => {
    const result = runLint({
      name: "config-file-eslint-files-ignores",
      source: SOURCE,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      extraSources: {
        "src/example.test.ts": SOURCE,
        "src/generated.ts": SOURCE,
        "eslint.config.mjs": `export default [
        {
          rules: {
            "no-var": "error",
            "no-console": "error",
          },
        },
        {
          files: ["src/**/*.test.ts"],
          rules: {
            "no-console": "off",
          },
        },
        {
          ignores: ["src/generated.ts"],
        },
      ];\n`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.file, d.rule, d.severity]).sort(),
      [
        ["src/example.test.ts", "no-var", "error"],
        ["src/main.ts", "no-console", "error"],
        ["src/main.ts", "no-var", "error"],
      ],
      result.stderr,
    );
  };
