import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies that typed `typescript-eslint` rules (those requiring
 * `parserOptions.project`) execute correctly through ttsc's ESLint runtime.
 *
 * Typed rules call `getTypeChecker()` inside the ESLint runtime; they require
 * `parserOptions.project` and `tsconfigRootDir` to be forwarded to
 * `tseslint.parser`. If either is missing, the parser falls back to a non-typed
 * run and the type-aware rule silently produces no output.
 *
 * 1. Materialise a project with `eslint` and `typescript-eslint` symlinked and
 *    `parserOptions.project` pointing at `tsconfig.json`.
 * 2. Run ttsc on `Promise.resolve(1);` (a floating promise).
 * 3. Assert `@typescript-eslint/no-floating-promises` fires with a message
 *    matching `Promises must be awaited`.
 */
export const test_lint_config_file_installed_eslint_runtime_executes_typed_typescript_eslint_rules =
  () => {
    const result = runLint({
      name: "config-file-eslint-runtime-real-typescript-eslint-typed",
      source: `Promise.resolve(1);\n`,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
      extraSources: {
        "eslint.config.mjs": `import tseslint from "typescript-eslint";

      export default tseslint.config({
        files: ["src/**/*.ts"],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: {
            project: "./tsconfig.json",
            tsconfigRootDir: import.meta.dirname,
          },
        },
        plugins: {
          "@typescript-eslint": tseslint.plugin,
        },
        rules: {
          "@typescript-eslint/no-floating-promises": "error",
        },
      });\n`,
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["@typescript-eslint/no-floating-promises", "error"]],
      result.stderr,
    );
    const diagnostic = result.diagnostics[0];
    assert.ok(diagnostic);
    assert.match(diagnostic.message, /Promises must be awaited/);
  };
