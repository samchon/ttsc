import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a config file whose `rules` is an array, not a severity map,
 * is rejected with a typed error.
 *
 * `rules` is the central field of the `lint.config.*` model; its contract is
 * a severity map keyed by rule name. An array would let the user's intent
 * drop silently as the sidecar iterates entries no rule name reaches, so the
 * loader rejects the wrong shape loudly. This restores the coverage of an
 * equivalent test that exercised the now-withdrawn inline-config model.
 *
 * 1. Materialize a fixture with a discovered `lint.config.json` whose `rules`
 *    is `["no-var"]` — an array instead of a map.
 * 2. Run ttsc.
 * 3. Assert non-zero exit and stderr says the rules value must be a severity map.
 */
export const test_lint_config_file_rules_must_be_an_object_not_an_array =
  () => {
    const result = runLint({
      name: "config-file-rules-not-an-object",
      source: "export const ok = 1;\n",
      extraSources: {
        "lint.config.json": JSON.stringify({ rules: ["no-var"] }),
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.match(result.stderr, /must be a rule severity map/);
  };
