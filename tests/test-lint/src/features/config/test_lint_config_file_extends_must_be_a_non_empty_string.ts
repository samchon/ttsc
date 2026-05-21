import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a config file whose `extends` is an empty string is rejected.
 *
 * Pins the validation on the config-file `extends` field: an empty string is
 * almost always a templating bug (e.g. `extends: ""` left after a
 * find-and-replace), and the sidecar should call that out loudly instead of
 * silently treating the file as having no base config.
 *
 * 1. Materialize a fixture with a discovered `lint.config.json` whose only key is
 *    `extends: ""`.
 * 2. Run ttsc.
 * 3. Assert non-zero exit and stderr says `extends must not be empty`.
 */
export const test_lint_config_file_extends_must_be_a_non_empty_string = () => {
  const result = runLint({
    name: "config-file-extends-empty-string",
    source: "export const ok = 1;\n",
    extraSources: {
      "lint.config.json": JSON.stringify({ extends: "" }),
    },
  });

  assert.notEqual(result.status, 0, result.stderr);
  assert.match(result.stderr, /extends must not be empty/);
};
