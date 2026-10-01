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
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory parses `class Sale { charge() }` merged with `interface Sale { charge(); extra(); rate }` beside an unmerged `interface IPlain { run() }`, and the sorted units must equal exactly function:IPlain.run, function:Sale.prototype.charge, function:Sale.prototype.extra, property:Sale.prototype.rate, type:IPlain and type:Sale.
 * @evidence contracts/testing.md#independent-expectations The expected addresses are authored from the merge contract: an interface merged into a class describes the instance side, so its members take the `prototype` address and the member the class also declares is one unit, while an unmerged interface keeps its plain addresses.
 * @evidence contracts/testing.md#distinguishing-cases A shared member, two interface-only members (one method, one data member) and an unmerged interface as control; sending every interface member through `prototype` or duplicating `charge` would change the exact list.
 * @evidence contracts/testing.md#execution-ownership TestInterfaceMergedWithAClassDeclaresItsInstanceMembers is a Go unit entry in the native test process; parseTypeScriptInventory parses the source with the TypeScript parser and scans its inventory, with no consumer install or product host.
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
