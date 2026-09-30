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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the class and that field are the whole set.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A computed name has no target an author could write, even when its expression is a literal, and the rule is the same one that excludes a private identifier. It is separated from the complementary case because the exclusion here comes from the name rather than from a modifier, and a repair to one filter must not silently open the other. The authored scenario requires this outcome: Assert the class and that field are the whole set.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare a class whose members carry computed names beside one ordinary field. Collect the inventory. Assert the class and that field are the whole set.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestClassComputedMemberNamesMaterializeNothing runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
