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
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory parses `export const live = 1, /** @internal *\/ gone = 2;` and the sorted rows `symbol:target hidden=<tag>` must equal exactly `property:gone hidden=@internal` and `property:live hidden=`.
 * @evidence contracts/testing.md#independent-expectations The expected rows are authored from the withdrawal contract: a withdrawal tag on an inner declarator withdraws only that declarator's identity, not the statement or its public sibling.
 * @evidence contracts/testing.md#distinguishing-cases One tagged and one untagged declarator in one statement: taking the withdrawal from the statement wrapper would hide both or neither, and the exact row list fails in either case.
 * @evidence contracts/testing.md#execution-ownership TestInnerDeclaratorWithdrawsItsOwnIdentity is a Go unit entry in the native test process; parseTypeScriptInventory parses the source with the TypeScript parser and scans its inventory, with no consumer install or product host.
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
