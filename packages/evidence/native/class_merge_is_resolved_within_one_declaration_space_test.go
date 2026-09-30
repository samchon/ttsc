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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the nested interface keeps its own address and the static and instance members stay apart.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Declaration merging happens inside one declaration space, so a class at module scope does not merge with an interface of that name inside a namespace. The index that decides the instance address is built per statement list for that reason, and a shared one would move a nested interface's members onto a `prototype` path nothing declares. The authored scenario requires this outcome: Assert the nested interface keeps its own address and the static and instance members stay apart.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare a class merged with an interface, carrying a static and an instance member of one name. Declare a namespace holding an interface of the class's name. Assert the nested interface keeps its own address and the static and instance members stay apart.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestClassMergeIsResolvedWithinOneDeclarationSpace runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
