package evidence

import (
  "testing"
)

/**
 * Verifies a longer tag opening with the same letters is not matched.
 *
 * The boundary negative of TodoMatchesTheTagNameCaseInsensitively: '@todos' is some other tool's tag,
 * and case-insensitive matching must not widen into prefix matching, or the
 * rule reports debts nobody recorded.
 *
 *  1. Write a '@todos' tag.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runTodoRule checks a todos tag and requires silence.
 * @evidence contracts/testing.md#independent-expectations The exact marker boundary prevents another tool's longer name from creating a todo debt.
 * @evidence contracts/testing.md#distinguishing-cases An adjacent plural spelling detects prefix matching despite sharing the entire todo prefix.
 * @evidence contracts/testing.md#execution-ownership TestTodoIgnoresLongerTagNames is a selectable native Go unit entry. runTodoRule parses its supplied source and invokes todoRule.Check in-process; source strings and reporter messages remain local to this entry.
 */
func TestTodoIgnoresLongerTagNames(t *testing.T) {
  assertSilent(t, runTodoRule(t, "src/persist.ts", `
/** @todos are tracked elsewhere */
export function persist(value: string): string {
  return value;
}
`))
}
