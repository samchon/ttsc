package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies an inner declarator's own withdrawal tag withdraws its identity
 * alone.
 *
 * A variable statement's withdrawal used to be taken from the statement
 * wrapper and applied to every declarator it holds, so `@internal` written on
 * one of them withdrew nothing at all. The public sibling is the negative twin
 * that keeps this from reading as "the statement withdrew", which is the answer
 * the old code would have given for a tag one line higher.
 *
 *  1. Withdraw one declarator of a two-declarator statement.
 *  2. Collect the inventory.
 *  3. Assert only that identity carries the tag.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert only that identity carries the tag.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A variable statement's withdrawal used to be taken from the statement wrapper and applied to every declarator it holds, so `@internal` written on one of them withdrew nothing at all. The public sibling is the negative twin that keeps this from reading as "the statement withdrew", which is the answer the old code would have given for a tag one line higher. The authored scenario requires this outcome: Assert only that identity carries the tag.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Withdraw one declarator of a two-declarator statement. Collect the inventory. Assert only that identity carries the tag.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestInnerDeclaratorWithdrawsItsOwnIdentity runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestInnerDeclaratorWithdrawsItsOwnIdentity(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export const live = 1,
  /**
   * @internal
   */
  gone = 2;
`)
  rows := []string{}
  for _, unit := range inventory.Units {
    rows = append(rows, unit.Symbol+":"+unit.Target+" hidden="+unit.Hidden)
  }
  sort.Strings(rows)
  want := []string{
    "property:gone hidden=@internal",
    "property:live hidden=",
  }
  if strings.Join(rows, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "declarator withdrawal:\n%s\nwant:\n%s",
      strings.Join(rows, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
