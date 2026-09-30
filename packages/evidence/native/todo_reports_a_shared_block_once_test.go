package evidence

import (
  "testing"
)

/**
 * Verifies one shared block on a multi-binding statement reports once per tag.
 *
 * TypeScript cascades a variable statement's leading block onto the statement
 * and each declaration under it, so a walk that read every attachment would
 * state the same debt several times. The dedupe has to key on the physical
 * block, not on the node it was reached through.
 *
 *  1. Put one '@todo' block above a statement declaring two bindings.
 *  2. Run the rule.
 *  3. Assert exactly one finding.
 * @evidence contracts/testing.md#behavioral-verification runTodoRule checks one todo block on a two-binding exported variable statement; assertReported requires one debt finding.
 * @evidence contracts/testing.md#independent-expectations The debt belongs to the physical shared block, so parser attachments to multiple nodes must not duplicate it.
 * @evidence contracts/testing.md#distinguishing-cases Two declarators expose attachment duplication while retaining one authored tag.
 * @evidence contracts/testing.md#execution-ownership TestTodoReportsASharedBlockOnce is a selectable native Go unit entry. runTodoRule parses its supplied source and invokes todoRule.Check in-process; source strings and reporter messages remain local to this entry.
 */
func TestTodoReportsASharedBlockOnce(t *testing.T) {
  messages := runTodoRule(t, "src/limits.ts", `
/** @todo confirm both ceilings with the pricing team */
export const maximumItems = 10,
  maximumCoupons = 2;
`)
  assertReported(t, messages, "Unrealized '@todo': 'confirm both ceilings with the pricing team'")
}
