package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies an interface and an object-shaped type alias classify their members
 * exactly as a class does.
 *
 * One contract in four spellings , a class body field, a constructor parameter
 * property, an interface member, an object-type-alias member , must answer one
 * selector. It did not: an interface answered `property` to `charge: () =>
 * void` while a class answered `function` to the same line, and a method
 * signature answered nothing at all. A `symbol: "function"` claim over a file
 * of interfaces therefore selected no host, deactivated, and passed the build
 * with no coverage, which is the silent shape the graph exists to refuse.
 *
 * The alias row is what keeps this from being "callables are functions". The
 * test is syntactic here for the same reason it is on a class: no type checker
 * runs, so `aliased: Handler` stays a property even though `Handler` is spelled
 * `() => void` two lines above it.
 *
 * The two containers are asserted together because they share one collector,
 * and a case for one would leave the other free to drift.
 *
 *  1. Spell a function-typed member, an alias-typed member, a method signature,
 *     an overload run, and a data member on both containers.
 *  2. Collect the inventory.
 *  3. Assert both answer identically, and that only the alias and the data
 *     member are properties.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert both answer identically, and that only the alias and the data member are properties.
 * @evidence contracts/testing.md#independent-expectations One contract in four spellings , a class body field, a constructor parameter property, an interface member, an object-type-alias member , must answer one selector. It did not: an interface answered `property` to `charge: () => void` while a class answered `function` to the same line, and a method signature answered nothing at all. A `symbol: "function"` claim over a file of interfaces therefore selected no host, deactivated, and passed the build with no coverage, which is the silent shape the graph exists to refuse. The authored scenario requires this outcome: Assert both answer identically, and that only the alias and the data member are properties.
 * @evidence contracts/testing.md#distinguishing-cases Spell a function-typed member, an alias-typed member, a method signature, an overload run, and a data member on both containers. Collect the inventory. Assert both answer identically, and that only the alias and the data member are properties.
 * @evidence contracts/testing.md#execution-ownership TestInterfaceMembersClassifyLikeClassMembers runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestInterfaceMembersClassifyLikeClassMembers(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
type Handler = () => void;
export interface ISale {
  charge: () => void;
  aliased: Handler;
  label: string;
  run(): void;
  overloaded(input: string): void;
  overloaded(input: number): void;
}
export type TSale = {
  charge: () => void;
  aliased: Handler;
  label: string;
  run(): void;
};
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:ISale.charge",
    "function:ISale.overloaded",
    "function:ISale.run",
    "function:TSale.charge",
    "function:TSale.run",
    "property:ISale.aliased",
    "property:ISale.label",
    "property:TSale.aliased",
    "property:TSale.label",
    "type:ISale",
    "type:TSale",
  }
  sort.Strings(want)
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "interface against class classification:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
