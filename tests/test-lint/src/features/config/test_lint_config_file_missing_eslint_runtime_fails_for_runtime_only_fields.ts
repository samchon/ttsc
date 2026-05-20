import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies that referencing a `plugins` entry in a flat config without an
 * installed `eslint` package fails with an explicit error rather than silently
 * skipping the plugin rules.
 *
 * Pins the hard-fail path for runtime-only fields. When the config uses a
 * `plugins` key the Go-side flattener cannot execute plugin rule modules
 * natively; it requires the ESLint runtime subprocess. Without the runtime the
 * engine must surface "ESLint runtime is required" so the user knows exactly
 * what to install.
 *
 * 1. Materialise a fixture with a `plugins` entry and no `eslint` package.
 * 2. Run ttsc; assert non-zero exit and `ESLint runtime is required` in stderr.
 */
export const test_lint_config_file_missing_eslint_runtime_fails_for_runtime_only_fields =
  () => {
    const result = runLint({
      name: "config-file-eslint-missing-runtime-plugin-required",
      source: `const promise = Promise.resolve(1);\nvoid promise;\n`,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      extraSources: {
        "eslint.config.mjs": `export default [
        {
          plugins: {
            "@typescript-eslint": {},
          },
          rules: {
            "@typescript-eslint/no-floating-promises": "error",
          },
        },
      ];\n`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ESLint runtime is required/);
  };
