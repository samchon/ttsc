package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies an interface merged with a class declares that class's instance
 * members.
 *
 * The merge is the ordinary way a project adds declarations to a class, and it
 * describes the instance side, so `interface Sale { charge(): void }` beside
 * `class Sale` declares the member the class body would. Addressing those
 * members from the bare name published `Sale.charge` for something reached as
 * `Sale.prototype.charge`, which cost three separate wrong answers: a path no
 * consumer can walk, a second unit for a method the class already declares, and
 * an obligation that stayed owed however the real member was cited.
 *
 * A plain interface beside them keeps its own addresses, so the case cannot
 * pass by sending every interface member through `prototype`, and the data
 * member crosses the merge axis with the syntactic one.
 *
 *  1. Merge an interface into a class, declaring one member the class also
 *     declares and two it does not, beside an unmerged interface.
 *  2. Collect the inventory.
 *  3. Assert the shared member is one unit and every merged member takes the
 *     instance address, while the unmerged interface is untouched.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the shared member is one unit and every merged member takes the instance address, while the unmerged interface is untouched.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The merge is the ordinary way a project adds declarations to a class, and it describes the instance side, so `interface Sale { charge(): void }` beside `class Sale` declares the member the class body would. Addressing those members from the bare name published `Sale.charge` for something reached as `Sale.prototype.charge`, which cost three separate wrong answers: a path no consumer can walk, a second unit for a method the class already declares, and an obligation that stayed owed however the real member was cited. The authored scenario requires this outcome: Assert the shared member is one unit and every merged member takes the instance address, while the unmerged interface is untouched.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Merge an interface into a class, declaring one member the class also declares and two it does not, beside an unmerged interface. Collect the inventory. Assert the shared member is one unit and every merged member takes the instance address, while the unmerged interface is untouched.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestInterfaceMergedWithAClassDeclaresItsInstanceMembers runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestInterfaceMergedWithAClassDeclaresItsInstanceMembers(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export class Sale {
  charge(): void {}
}
export interface Sale {
  charge(): void;
  extra(): void;
  rate: number;
}
export interface IPlain {
  run(): void;
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:IPlain.run",
    "function:Sale.prototype.charge",
    "function:Sale.prototype.extra",
    "property:Sale.prototype.rate",
    "type:IPlain",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "class and interface merge units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
