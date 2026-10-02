package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a withdrawal on the constructor reaches the fields it declares.
 *
 * A constructor declares units without being one, so it is the only container
 * whose withdrawal tag could be dropped on the way to its descendants. The
 * class-level and field-level tags both already cascade, and an `@internal`
 * constructor that left its fields in the population would be the one hole in
 * that rule, silently keeping a field the author withdrew as a claim host.
 *
 *  1. Withdraw a constructor with `@internal` beside an ordinary field.
 *  2. Collect the inventory.
 *  3. Assert its parameter property carries the tag and the field does not.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert its parameter property carries the tag and the field does not.
 * @evidence contracts/testing.md#independent-expectations A constructor declares units without being one, so it is the only container whose withdrawal tag could be dropped on the way to its descendants. The class-level and field-level tags both already cascade, and an `@internal` constructor that left its fields in the population would be the one hole in that rule, silently keeping a field the author withdrew as a claim host. The authored scenario requires this outcome: Assert its parameter property carries the tag and the field does not.
 * @evidence contracts/testing.md#distinguishing-cases Withdraw a constructor with `@internal` beside an ordinary field. Collect the inventory. Assert its parameter property carries the tag and the field does not.
 * @evidence contracts/testing.md#execution-ownership TestWithdrawnConstructorWithdrawsItsParameterProperties runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestWithdrawnConstructorWithdrawsItsParameterProperties(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export class Sale {
  readonly declared: number = 0;
  /**
   * @internal
   */
  private constructor(public readonly price: number) {}
}
`)
  tagged := []string{}
  for _, unit := range inventory.Units {
    tagged = append(tagged, unit.Symbol+":"+unit.Target+"="+unit.Hidden)
  }
  sort.Strings(tagged)
  want := []string{
    "property:Sale.prototype.declared=",
    "property:Sale.prototype.price=@internal",
    "type:Sale=",
  }
  if strings.Join(tagged, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "withdrawn constructor units:\n%s\nwant:\n%s",
      strings.Join(tagged, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
