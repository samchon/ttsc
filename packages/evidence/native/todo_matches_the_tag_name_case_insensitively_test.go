package evidence

import (
  "testing"
)

/**
 * Verifies the tag name matches case-insensitively.
 *
 * '@TODO' is the same promise shouted, and a case-sensitive scan would teach
 * authors that capitalizing a debt hides it from the build.
 *
 *  1. Write the tag as '@TODO'.
 *  2. Run the rule.
 *  3. Assert the finding carries the text.
 *
 * @evidence contracts/testing.md#behavioral-verification runTodoRule checks uppercase TODO and requires exactly one finding with the normalized todo label and original debt text.
 * @evidence contracts/testing.md#independent-expectations Tag-name matching is case-insensitive; uppercase does not change the recorded promise.
 * @evidence contracts/testing.md#distinguishing-cases This uppercase firing case complements ordinary lowercase and longer-name refusal without asserting all mixed-case variants.
 * @evidence contracts/testing.md#execution-ownership TestTodoMatchesTheTagNameCaseInsensitively is a selectable native Go unit entry. runTodoRule parses its supplied source and invokes todoRule.Check in-process; source strings and reporter messages remain local to this entry.
 */
func TestTodoMatchesTheTagNameCaseInsensitively(t *testing.T) {
  messages := runTodoRule(t, "src/persist.ts", `
/** @TODO wire the persistence layer */
export function persist(value: string): string {
  return value;
}
`)
  assertReported(t, messages, "Unrealized '@todo': 'wire the persistence layer'")
}
