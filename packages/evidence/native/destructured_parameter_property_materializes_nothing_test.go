package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a destructured constructor parameter materializes nothing.
 *
 * `constructor(public { a, b }: T)` is `TS1187`, so no unit may come of it. It
 * is pinned because the sibling collector for destructured exports does the
 * opposite and expands every binding leaf: aligning the two later would
 * silently materialize `Sale.prototype.a` from a parameter TypeScript rejects,
 * with nothing to catch it. The plain parameter property beside it is the
 * control that keeps the case honest.
 *
 *  1. Declare a destructured parameter carrying a property modifier.
 *  2. Collect the inventory.
 *  3. Assert only the ordinary parameter property materializes.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory parses `interface IOptions { a; b }` and `class Sale { constructor(public { a, b }: IOptions, public readonly price: number) {} }`, and the sorted units must equal exactly property:IOptions.a, property:IOptions.b, property:Sale.prototype.price, type:IOptions and type:Sale.
 * @evidence contracts/testing.md#independent-expectations The expected set is authored from the materialization contract: a destructured parameter with a property modifier is invalid TypeScript and must create no `Sale.prototype.a` or `Sale.prototype.b` unit, while the ordinary parameter property beside it still does.
 * @evidence contracts/testing.md#distinguishing-cases The destructured parameter (materializes nothing) beside a plain parameter property (control that materializes one unit); the interface members appear in the expected set only as IOptions units, which also pins that they are not re-addressed under the class.
 * @evidence contracts/testing.md#execution-ownership TestDestructuredParameterPropertyMaterializesNothing is a Go unit entry in the native test process; parseTypeScriptInventory parses the source with the TypeScript parser and scans its inventory, with no consumer install or product host.
 */
func TestDestructuredParameterPropertyMaterializesNothing(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export interface IOptions {
  a: number;
  b: number;
}
export class Sale {
  constructor(
    public { a, b }: IOptions,
    public readonly price: number,
  ) {}
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:IOptions.a",
    "property:IOptions.b",
    "property:Sale.prototype.price",
    "type:IOptions",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "destructured parameter units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
