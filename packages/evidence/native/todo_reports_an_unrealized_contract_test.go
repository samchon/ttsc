package evidence

import (
  "testing"
)

/**
 * Verifies the rule fires on a '@todo' tag and carries the tag's text.
 *
 * The anchor case. The text is what makes the finding a realize ledger rather
 * than a style nag: without it the author learns that something is owed but not
 * what, and the diagnostic has to say why the tag matters — a contract the
 * declaration has not realized yet — or a reader treats it as comment policing
 * and disables it.
 *
 *  1. Export one function whose JSDoc carries a single '@todo' with text.
 *  2. Run the rule.
 *  3. Assert one finding carrying the text and the repair.
 *
 * @evidence contracts/testing.md#behavioral-verification runTodoRule invokes todoRule.Check on a function's todo tag; assertReported requires one finding containing the debt and the realization repair.
 * @evidence contracts/testing.md#independent-expectations A todo records an unrealized contract and its authored text identifies the required work.
 * @evidence contracts/testing.md#distinguishing-cases One named debt supplies the firing arm; prose-only silence is owned by TodoAcceptsARealizedDeclaration.
 * @evidence contracts/testing.md#execution-ownership TestTodoReportsAnUnrealizedContract is a selectable native Go unit entry. runTodoRule parses its supplied source and invokes todoRule.Check in-process; source strings and reporter messages remain local to this entry.
 */
func TestTodoReportsAnUnrealizedContract(t *testing.T) {
  messages := runTodoRule(t, "src/persist.ts", `
/** @todo wire the persistence layer */
export function persist(value: string): string {
  return value;
}
`)
  assertReported(t, messages, "Unrealized '@todo': 'wire the persistence layer'")
  assertReported(t, messages, "Realize the declaration and remove the tag")
}
