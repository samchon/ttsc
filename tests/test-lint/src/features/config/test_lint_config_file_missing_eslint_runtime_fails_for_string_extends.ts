import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that using a string extends value (e.g. `"eslint/recommended"`)
 * without an installed `eslint` package fails with an explicit error.
 *
 * String-valued `extends` entries are resolved at runtime by the ESLint API and
 * cannot be statically expanded by the Go-side flattener. The engine must
 * therefore require the runtime for any string extends, not just for plugin
 * entries. Silently ignoring the string would leave the user's shared config
 * unapplied.
 *
 * 1. Materialise a fixture with `extends: ["eslint/recommended"]` and no `eslint`
 *    package.
 * 2. Run ttsc; assert non-zero exit and `ESLint runtime is required` in stderr.
 */
export const test_lint_config_file_missing_eslint_runtime_fails_for_string_extends =
  () => {
    const result = runLint({
      name: "config-file-eslint-missing-runtime-string-extends",
      source: SOURCE,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      extraSources: {
        "eslint.config.mjs": `export default [
        {
          extends: ["eslint/recommended"],
          rules: {
            "no-var": "error",
          },
        },
      ];\n`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ESLint runtime is required/);
  };
