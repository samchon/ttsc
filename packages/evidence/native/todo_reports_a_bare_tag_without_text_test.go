package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a bare tag with no text still fires, without an empty quote.
 *
 * A stub can carry '@todo' alone, and the debt is no less real for being
 * unnamed. The message drops the text clause rather than quoting an empty
 * string, because ": ''" names nothing and reads like a rendering bug.
 *
 *  1. Write a '@todo' with no remainder.
 *  2. Run the rule.
 *  3. Assert the finding fires and carries no empty quote.
 * @evidence contracts/testing.md#behavioral-verification runTodoRule checks a bare todo; exactly one generic finding must fire and no message may contain empty quotes.
 * @evidence contracts/testing.md#independent-expectations An unnamed todo remains debt, but diagnostic prose must not render a nonexistent text value as an empty quotation.
 * @evidence contracts/testing.md#distinguishing-cases The empty remainder is distinguished from absence of a todo marker and from a named debt.
 * @evidence contracts/testing.md#execution-ownership TestTodoReportsABareTagWithoutText is a selectable native Go unit entry. runTodoRule parses its supplied source and invokes todoRule.Check in-process; source strings and reporter messages remain local to this entry.
 */
func TestTodoReportsABareTagWithoutText(t *testing.T) {
  messages := runTodoRule(t, "src/persist.ts", `
/** @todo */
export function persist(value: string): string {
  return value;
}
`)
  assertReported(t, messages, "Unrealized '@todo'. ")
  for _, message := range messages {
    if strings.Contains(message, "''") {
      t.Fatalf("a bare tag rendered an empty quote:\n%s", message)
    }
  }
}
