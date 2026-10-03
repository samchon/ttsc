import { FixtureFiles } from "../../../internal/FixtureFiles";
import { assert, runLint } from "../../../internal/lint/internal/config-file";

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
 * @evidence contracts/testing.md#execution-ownership The named E2E entry remains the native config error transport owner; the separate untagged Go Test entries call LoadConfigResolver/LoadRuleConfig directly over authored JSON inputs. Root test:go selects packages/lint/...; current selection and runtime survival are not certified by this declaration.
 * @evidence contracts/e2e.md#necessary-boundary The native config resolver must propagate a rejected configuration through the sidecar, launcher exit and rendered stderr. Direct Go calls cannot prove this failure connection.
 * @evidence contracts/e2e.md#shared-execution This empty-extends input makes one TestLint.runProject launcher invocation. The cyclic and array distinctions have separate direct Go owners, not additional inputs executed by this invocation. Workspace tool/cache paths are reused; exact child/Program totals and current unit execution require separate observation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The immutable invalid fixture has no contributor declarations. runLint attempts disposable project cleanup in finally; TestLint.runProject supplies workspace-selected tools and shared cache paths. This returned sync result does not certify arbitrary descendant join, actual cache-hit identity or absence of all cache mutations.
 * @evidence contracts/e2e.md#preserved-coverage The original empty-extends process failure and exact error text remain here. packages/lint/linthost/load_rule_config_rejects_empty_extends_test.go, load_rule_config_rejects_array_rules_test.go and load_rule_config_rejects_extends_cycle_between_two_configs_test.go own respectively empty versus omitted extends, array versus empty rules map and cyclic versus repaired JSON chains through direct resolvers. Their named Test bodies and untagged selection preserve those meanings; actual survivor execution is still required before removal of a meaningful donor or duplicate call.
 */
export function test_lint_config_file_extends_must_be_a_non_empty_string(): void {
  const result = runLint({
    name: "config-file-extends-empty-string",
    source: "export const ok = 1;\n",
    extraSources: FixtureFiles.read("lint/lint_config_file_extends_must_be_a_non_empty_string/inputs-1"),
  });

  assert.notEqual(result.status, 0, result.stderr);
  assert.match(result.stderr, /extends must not be empty/);
}
