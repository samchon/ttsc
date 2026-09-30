package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a private constructor still declares its public fields.
 *
 * The constructor's own visibility closes construction from outside; it says
 * nothing about the instance fields the object then exposes. Gating the
 * parameters on the constructor's modifiers would drop every field of a class
 * built through a static factory, which is a shape this exclusion would hit
 * squarely.
 *
 *  1. Declare a public parameter property on a private constructor.
 *  2. Collect the inventory.
 *  3. Assert the field materializes and the non-public parameter does not.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the field materializes and the non-public parameter does not.
 * @evidence contracts/testing.md#independent-expectations The constructor's own visibility closes construction from outside; it says nothing about the instance fields the object then exposes. Gating the parameters on the constructor's modifiers would drop every field of a class built through a static factory, which is a shape this exclusion would hit squarely. The authored scenario requires this outcome: Assert the field materializes and the non-public parameter does not.
 * @evidence contracts/testing.md#distinguishing-cases Declare a public parameter property on a private constructor. Collect the inventory. Assert the field materializes and the non-public parameter does not.
 * @evidence contracts/testing.md#execution-ownership TestPrivateConstructorStillDeclaresItsPublicFields runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestPrivateConstructorStillDeclaresItsPublicFields(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export class Sale {
  private constructor(
    public readonly price: number,
    private ledger: number,
  ) {}
  static create(price: number): Sale {
    return new Sale(price, 0);
  }
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:Sale.create",
    "property:Sale.prototype.price",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "private constructor units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
