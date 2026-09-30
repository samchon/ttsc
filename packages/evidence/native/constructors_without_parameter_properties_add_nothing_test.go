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
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert only the implementation's parameter property materializes.
 * @evidence contracts/testing.md#independent-expectations The constructor is read now rather than skipped, so the shapes that carry no parameter property have to leave the population exactly as they found it. The overload half is a boundary rather than a doubling risk, since units dedupe by identity: what it pins is that walking three constructor nodes instead of one adds nothing and drops nothing. The authored scenario requires this outcome: Assert only the implementation's parameter property materializes.
 * @evidence contracts/testing.md#distinguishing-cases Declare an empty constructor in one class and an overload run in another. Collect the inventory. Assert only the implementation's parameter property materializes.
 * @evidence contracts/testing.md#execution-ownership TestConstructorsWithoutParameterPropertiesAddNothing runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
