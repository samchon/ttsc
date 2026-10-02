package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies the class an interface merges with is looked up in its own scope.
 *
 * Declaration merging happens inside one declaration space, so a class at
 * module scope does not merge with an interface of that name inside a
 * namespace. The index that decides the instance address is built per statement
 * list for that reason, and a shared one would move a nested interface's
 * members onto a `prototype` path nothing declares.
 *
 * A static member of the outer class beside a merged member of the same name is
 * the boundary the address move could most plausibly have broken: the two are
 * different members and must keep two addresses rather than collapsing.
 *
 *  1. Declare a class merged with an interface, carrying a static and an
 *     instance member of one name.
 *  2. Declare a namespace holding an interface of the class's name.
 *  3. Assert the nested interface keeps its own address and the static and
 *     instance members stay apart.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory parses a module-scope class `Sale` (static `rate`) merged with `interface Sale { rate }` and a `namespace Outer` holding its own `interface Sale { rate }`, and the sorted `symbol:target` list must equal exactly property:Outer.Sale.rate, property:Sale.prototype.rate, property:Sale.rate, type:Outer, type:Outer.Sale and type:Sale.
 * @evidence contracts/testing.md#independent-expectations The expected addresses are authored from the declaration-merging rule: merging happens inside one declaration space, so the nested interface does not merge with the module-scope class and keeps `Outer.Sale.rate` with no prototype segment, while the module-scope merged instance member gets `Sale.prototype.rate`.
 * @evidence contracts/testing.md#distinguishing-cases A static and an instance member of the same name stay as two addresses (`Sale.rate` and `Sale.prototype.rate`), and the same type name inside a namespace stays separate; the exact set also fails if a shared index moved the nested members onto a prototype path.
 * @evidence contracts/testing.md#execution-ownership TestClassMergeIsResolvedWithinOneDeclarationSpace is a Go unit entry in the native test process; parseTypeScriptInventory parses the source with the TypeScript parser and scans its inventory, with no consumer install or product host.
 */
func TestClassMergeIsResolvedWithinOneDeclarationSpace(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export class Sale {
  static rate: number = 0;
}
export interface Sale {
  rate: number;
}
export namespace Outer {
  export interface Sale {
    rate: number;
  }
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:Outer.Sale.rate",
    "property:Sale.prototype.rate",
    "property:Sale.rate",
    "type:Outer",
    "type:Outer.Sale",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "scoped class merge units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
