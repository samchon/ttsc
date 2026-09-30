package evidence

import (
  "testing"
)

/**
 * Verifies the negative twin: a realized declaration is silent.
 *
 * Without it TodoReportsAnUnrealizedContract is equally satisfied by a rule that reports every
 * documented declaration it sees. The block here holds prose and another tag,
 * so silence also proves the scan keys on the tag name rather than on any '@'.
 *
 *  1. Export a function documented with prose and a '@param' tag, no '@todo'.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runTodoRule checks prose and param documentation with no todo tag; assertSilent requires no finding.
 * @evidence contracts/testing.md#independent-expectations Only todo markers denote unrealized contracts; ordinary documentation is permitted.
 * @evidence contracts/testing.md#distinguishing-cases Another JSDoc tag prevents silence from merely reflecting absence of all tags.
 * @evidence contracts/testing.md#execution-ownership TestTodoAcceptsARealizedDeclaration is a selectable native Go unit entry. runTodoRule parses its supplied source and invokes todoRule.Check in-process; source strings and reporter messages remain local to this entry.
 */
func TestTodoAcceptsARealizedDeclaration(t *testing.T) {
  assertSilent(t, runTodoRule(t, "src/persist.ts", `
/**
 * Persists a normalized value.
 *
 * @param value The value to persist.
 */
export function persist(value: string): string {
  return value;
}
`))
}
