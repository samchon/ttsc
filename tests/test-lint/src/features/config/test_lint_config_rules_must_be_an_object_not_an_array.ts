import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a malformed `rules` value (array instead of object map) is
 * rejected with a typed error.
 *
 * Pins the shape check on the new `rules` field. The user-facing contract is
 * "severity map keyed by rule name"; an array would let the user's intent
 * silently drop on the floor as the sidecar iterates entries no rule reaches.
 *
 * 1. Materialize a fixture whose plugin entry sets `rules: ["no-var"]` (an array,
 *    not a map).
 * 2. Run ttsc.
 * 3. Assert non-zero exit and stderr says `"rules" must be a rule severity map`.
 */
export const test_lint_config_rules_must_be_an_object_not_an_array = () => {
  const result = runLint({
    name: "config-rules-not-an-object",
    source: "export const ok = 1;\n",
    pluginConfig: {
      rules: ["no-var"] as unknown as Record<string, string>,
    },
  });

  assert.notEqual(result.status, 0, result.stderr);
  assert.match(result.stderr, /"rules" must be a rule severity map/);
};
