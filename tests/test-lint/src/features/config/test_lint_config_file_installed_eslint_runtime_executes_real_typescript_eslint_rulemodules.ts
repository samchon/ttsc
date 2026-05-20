import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies that the ESLint runtime executes the actual `typescript-eslint` rule
 * package when it is symlinked into the project's `node_modules`.
 *
 * Complements the fake-runtime test by using the real package. The real
 * `@typescript-eslint/no-explicit-any` rule must fire on `const value: any` and
 * produce the expected message string. This ensures the host's module
 * resolution and ESLint API invocation work with real npm packages, not only
 * with hermetic stubs.
 *
 * 1. Materialise a project with `eslint` and `typescript-eslint` symlinked.
 * 2. Run ttsc; assert the real `@typescript-eslint/no-explicit-any` rule fires
 *    with no `"ignoring unknown rule"` warning.
 */
export const test_lint_config_file_installed_eslint_runtime_executes_real_typescript_eslint_rulemodules =
  () => {
    const result = runLint({
      name: "config-file-eslint-runtime-real-typescript-eslint",
      source: `const value: any = 1;\nconsole.log(value);\n`,
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
        },
        plugins: {
          "@typescript-eslint": tseslint.plugin,
        },
        rules: {
          "@typescript-eslint/no-explicit-any": "error",
          "no-console": "off",
        },
      });\n`,
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.equal(
      result.stderr.includes("@ttsc/lint: ignoring unknown rule"),
      false,
      result.stderr,
    );
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity, d.message]),
      [
        [
          "@typescript-eslint/no-explicit-any",
          "error",
          "Unexpected any. Specify a different type.",
        ],
      ],
      result.stderr,
    );
  };
