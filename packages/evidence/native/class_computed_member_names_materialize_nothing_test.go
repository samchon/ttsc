package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a computed member name materializes nothing.
 *
 * A computed name has no target an author could write, even when its expression
 * is a literal, and the rule is the same one that excludes a private
 * identifier. It is separated from the complementary case because the exclusion here
 * comes from the name rather than from a modifier, and a repair to one filter
 * must not silently open the other.
 *
 * The ordinary field beside them is the control. Without it the expected set
 * would be the class alone, which is also what a collector that had stopped
 * materializing class members entirely produces, and the case would pass while
 * proving nothing about computed names.
 *
 *  1. Declare a class whose members carry computed names beside one ordinary
 *     field.
 *  2. Collect the inventory.
 *  3. Assert the class and that field are the whole set.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory parses a class `Sale` with members named `["literal"]`, `[key]` and `[Symbol.iterator]` beside an ordinary `named` field, and the sorted `symbol:target` list must equal exactly `property:Sale.prototype.named` and `type:Sale`.
 * @evidence contracts/testing.md#independent-expectations The expected set is authored from the contract that a computed member name has no target an author could write, even when it is a literal, so those members must not materialize while the ordinary field and the class do.
 * @evidence contracts/testing.md#distinguishing-cases Three computed-name shapes (literal, variable, well-known symbol) beside one ordinary field; the ordinary field distinguishes a correct filter from a collector that materialized no class members at all.
 * @evidence contracts/testing.md#execution-ownership TestClassComputedMemberNamesMaterializeNothing is a Go unit entry in the native test process; parseTypeScriptInventory parses the source with the TypeScript parser and scans its inventory, with no consumer install or product host.
 */
func TestClassComputedMemberNamesMaterializeNothing(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
const key = "dynamic";
export class Sale {
  ["literal"]: number = 0;
  [key]: number = 0;
  [Symbol.iterator](): void {}
  named: number = 0;
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:Sale.prototype.named",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "computed member units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
