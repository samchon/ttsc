package evidence

import (
  "testing"
)

/**
 * Verifies the rule refuses options through the host's marker interface.
 *
 * `AcceptsTtscLintOptions() false` is the whole runtime contract: the engine
 * validates options at construction, reports a configured object as
 * `invalid options for rule "evidence/todo": rule does not accept options`,
 * and skips the rule, so Check never runs against options. An unimplemented
 * marker silently defaults to accepting — a rule that means to have no
 * configuration surface would then take one without checking it — which is why
 * the declaration is pinned rather than assumed.
 *
 *  1. Read the rule's `AcceptsTtscLintOptions` declaration.
 *  2. Assert it refuses.
 * @evidence contracts/testing.md#behavioral-verification todoRule.AcceptsTtscLintOptions must return false.
 * @evidence contracts/testing.md#independent-expectations The todo rule has no configuration payload and its contributor marker must explicitly refuse one.
 * @evidence contracts/testing.md#distinguishing-cases This unit entry checks the marker; the runtime host's diagnostic and skipped Check are consequences not executed by this body.
 * @evidence contracts/testing.md#execution-ownership TestTodoRefusesOptions is a selectable native Go unit entry exercising the owning operations named in its behavioral answer in-process. Its direct fixture values and local comparisons require no installed artifact or product process.
 */
func TestTodoRefusesOptions(t *testing.T) {
  if (todoRule{}).AcceptsTtscLintOptions() {
    t.Fatal("evidence/todo must refuse options; the host only reports a configured object for a rule that declares AcceptsTtscLintOptions() false")
  }
}
