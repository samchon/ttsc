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
 *
 * @evidence contracts/testing.md#behavioral-verification The real ttsc launcher loads the invalid extends JSON through the native lint config loader, requiring failure exit and its original extends must not be empty text on stderr.
 * @evidence contracts/testing.md#independent-expectations The supported extends schema requires a nonempty string; the literal failure message and nonzero process result are the documented config-rejection behavior.
 * @evidence contracts/testing.md#distinguishing-cases This case preserves the original empty string through the actual error wire. Direct Go units own omitted-extends acceptance, exact cyclic-chain rejection/recovery and array-rules rejection/empty-object acceptance.
 * @evidence contracts/testing.md#execution-ownership The named E2E entry remains the native config error transport owner; pure JSON shape and graph decisions execute in the separately enrolled Go unit population.
 * @evidence contracts/e2e.md#necessary-boundary The native config resolver must propagate a rejected configuration through the sidecar, launcher exit and rendered stderr. Direct Go calls cannot prove this failure connection.
 * @evidence contracts/e2e.md#shared-execution One real invalid consumer invocation remains for three config-failure decision scenarios, using the existing shared content-keyed builtin lint producer. Cyclic and array inputs now run inside the same Go semantic-unit process.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The immutable invalid fixture has no contributors or source-cache mutations, so the canonical builtin lint producer shares its actual build key with other unchanged builtin cases. TestLint.run removes its disposable project in finally and retained plugin cache lifetime belongs to TestProject.
 * @evidence contracts/e2e.md#preserved-coverage The original empty-extends process failure and exact error text remain here. TestLoadRuleConfigRejectsEmptyExtends, TestLoadRuleConfigRejectsArrayRules and TestLoadRuleConfigRejectsExtendsCycleBetweenTwoConfigs preserve the original JSON/error distinctions and add valid controls before the two redundant CLI invocations are removed.
 */
export function test_lint_config_file_extends_must_be_a_non_empty_string(): void {
  const result = runLint({
    name: "config-file-extends-empty-string",
    source: "export const ok = 1;\n",
    extraSources: {
      "lint.config.json": JSON.stringify({ extends: "" }),
    },
  });

  assert.notEqual(result.status, 0, result.stderr);
  assert.match(result.stderr, /extends must not be empty/);
}
