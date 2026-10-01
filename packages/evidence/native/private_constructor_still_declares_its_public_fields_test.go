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
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory parses a class with a private constructor taking one public readonly and one private parameter property plus a static create, and its unit list must equal exactly function:Sale.create, property:Sale.prototype.price and type:Sale.
 * @evidence contracts/testing.md#independent-expectations The class source and the three expected symbol:target strings are authored literals; that a constructor's own visibility does not hide the public instance field it declares, and that a private parameter property is no unit, follow from TypeScript semantics rather than from the scanner's output.
 * @evidence contracts/testing.md#distinguishing-cases The public parameter property is the positive case and the private one (ledger) the adjacent negative case within one private constructor; the sorted whole-list comparison also rejects an extra unit. A public constructor and non-parameter fields are owned by other tests.
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
