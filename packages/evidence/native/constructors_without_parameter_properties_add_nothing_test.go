package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a constructor with no parameters and a constructor overload run
 * materialize nothing of their own.
 *
 * The constructor is read now rather than skipped, so the shapes that carry no
 * parameter property have to leave the population exactly as they found it. The
 * overload half is a boundary rather than a doubling risk, since units dedupe
 * by identity: what it pins is that walking three constructor nodes instead of
 * one adds nothing and drops nothing.
 *
 *  1. Declare an empty constructor in one class and an overload run in another.
 *  2. Collect the inventory.
 *  3. Assert only the implementation's parameter property materializes.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory parses class `Empty` with `constructor() {}` and class `Overloaded` with two constructor overload signatures and an implementation taking `public readonly price`, and the sorted `symbol:target` list must equal exactly property:Overloaded.prototype.price, type:Empty and type:Overloaded.
 * @evidence contracts/testing.md#independent-expectations The expected set is authored from the materialization contract: only a parameter property creates a unit from a constructor, so an empty constructor adds nothing and the overload signatures neither add nor drop the implementation's one property.
 * @evidence contracts/testing.md#distinguishing-cases An empty constructor and a three-node overload run in separate classes; the exact list fails if either shape materializes an extra unit or if the overload walk loses or duplicates the parameter property.
 * @evidence contracts/testing.md#execution-ownership TestConstructorsWithoutParameterPropertiesAddNothing is a Go unit entry in the native test process; parseTypeScriptInventory parses the source with the TypeScript parser and scans its inventory, with no consumer install or product host.
 */
func TestConstructorsWithoutParameterPropertiesAddNothing(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export class Empty {
  constructor() {}
}
export class Overloaded {
  constructor(price: number);
  constructor(price: string);
  constructor(public readonly price: number | string) {}
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:Overloaded.prototype.price",
    "type:Empty",
    "type:Overloaded",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "constructor units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
