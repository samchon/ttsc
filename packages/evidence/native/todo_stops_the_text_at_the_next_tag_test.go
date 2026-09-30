package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a tag's text ends where the next JSDoc tag begins.
 *
 * The block boundary rule the declaration parser follows: continuation lines
 * belong to the tag above, and any other '@'-opening line closes it. Without
 * the boundary the finding would swallow '@param' documentation into the debt.
 *
 *  1. Follow a multi-line '@todo' with a '@param' tag.
 *  2. Run the rule.
 *  3. Assert one finding whose text joins the continuation and excludes the param.
 * @evidence contracts/testing.md#behavioral-verification runTodoRule reads a continued todo followed by param; one joined-debt finding is required and every message must exclude param.
 * @evidence contracts/testing.md#independent-expectations Continuation lines belong to the todo until the next JSDoc marker, whose text must remain separate.
 * @evidence contracts/testing.md#distinguishing-cases Multi-line continuation plus a real following tag challenge premature truncation and overrun across the boundary.
 * @evidence contracts/testing.md#execution-ownership TestTodoStopsTheTextAtTheNextTag is a selectable native Go unit entry. runTodoRule parses its supplied source and invokes todoRule.Check in-process; source strings and reporter messages remain local to this entry.
 */
func TestTodoStopsTheTextAtTheNextTag(t *testing.T) {
  messages := runTodoRule(t, "src/persist.ts", `
/**
 * @todo wire the persistence layer
 * and emit the audit event
 * @param value The value to persist.
 */
export function persist(value: string): string {
  return value;
}
`)
  assertReported(t, messages, "'wire the persistence layer and emit the audit event'")
  for _, message := range messages {
    if strings.Contains(message, "@param") {
      t.Fatalf("the finding swallowed the following tag:\n%s", message)
    }
  }
}
