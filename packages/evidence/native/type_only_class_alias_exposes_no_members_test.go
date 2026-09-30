package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a type-only alias exposes the class type without its members.
 *
 * A class name is type-space, so `export type { Sale }` exposes it exactly as
 * it exposes an interface. `Sale.prototype.price` and `Sale.currency` are paths
 * through the class *value*, which the alias exposes nothing to walk them from.
 * The value-side twin in the same file is what makes the split falsifiable.
 *
 *  1. Export one class by value and another by a type-only alias.
 *  2. Collect the inventory.
 *  3. Assert only the value export contributes members.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert only the value export contributes members.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A class name is type-space, so `export type { Sale }` exposes it exactly as it exposes an interface. `Sale.prototype.price` and `Sale.currency` are paths through the class *value*, which the alias exposes nothing to walk them from. The value-side twin in the same file is what makes the split falsifiable. The authored scenario requires this outcome: Assert only the value export contributes members.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Export one class by value and another by a type-only alias. Collect the inventory. Assert only the value export contributes members.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeOnlyClassAliasExposesNoMembers runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeOnlyClassAliasExposesNoMembers(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export class Value {
  price: number = 0;
}
class Local {
  price: number = 0;
}
export type { Local as Shape };
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:Value.prototype.price",
    "type:Shape",
    "type:Value",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "type-only class alias units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
