import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies that an empty `extends` value is rejected.
 *
 * Pins the validation on the new `extends` field: an empty string is almost
 * always a templating bug (e.g. `extends: ""` left after a find-and-replace),
 * and the sidecar should call that out loudly instead of silently falling back
 * to lint config discovery and confusing the user about which file actually
 * loaded.
 *
 * 1. Materialize a fixture whose plugin entry sets `extends: ""`.
 * 2. Run ttsc.
 * 3. Assert non-zero exit and stderr says `"extends" must be a non-empty string
 *    path`.
 */
export const test_lint_config_extends_must_be_a_non_empty_string = () => {
  const result = runLint({
    name: "config-extends-empty-string",
    source: "export const ok = 1;\n",
    pluginConfig: {
      extends: "",
    },
  });

  assert.notEqual(result.status, 0, result.stderr);
  assert.match(result.stderr, /"extends" must be a non-empty string/);
};
