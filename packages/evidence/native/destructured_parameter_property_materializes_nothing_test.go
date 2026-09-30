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
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert only the ordinary parameter property materializes.
 * @evidence contracts/testing.md#independent-expectations `constructor(public { a, b }: T)` is `TS1187`, so no unit may come of it. It is pinned because the sibling collector for destructured exports does the opposite and expands every binding leaf: aligning the two later would silently materialize `Sale.prototype.a` from a parameter TypeScript rejects, with nothing to catch it. The plain parameter property beside it is the control that keeps the case honest. The authored scenario requires this outcome: Assert only the ordinary parameter property materializes.
 * @evidence contracts/testing.md#distinguishing-cases Declare a destructured parameter carrying a property modifier. Collect the inventory. Assert only the ordinary parameter property materializes.
 * @evidence contracts/testing.md#execution-ownership TestDestructuredParameterPropertyMaterializesNothing runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
