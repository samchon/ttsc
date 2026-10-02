package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a withdrawal on a class takes its members with it.
 *
 * `@internal` on the class states that nothing below it is API, and the class
 * is now the declaration that carries the statement. The contract is that a
 * withdrawn unit is **kept** and marked, never discarded, so a citation naming
 * one is answered with the tag instead of sending the author after a typo that
 * is not there. Asserting the exact unit set is what pins both halves: dropping
 * the members instead of marking them would satisfy a check that only read
 * `Hidden` on whatever units happened to exist.
 *
 *  1. Withdraw a class with `@internal`, including a parameter property, and
 *     leave a public class beside it.
 *  2. Collect the inventory.
 *  3. Assert every unit is present and carries exactly the expected tag.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert every unit is present and carries exactly the expected tag.
 * @evidence contracts/testing.md#independent-expectations `@internal` on the class states that nothing below it is API, and the class is now the declaration that carries the statement. The contract is that a withdrawn unit is **kept** and marked, never discarded, so a citation naming one is answered with the tag instead of sending the author after a typo that is not there. Asserting the exact unit set is what pins both halves: dropping the members instead of marking them would satisfy a check that only read `Hidden` on whatever units happened to exist. The authored scenario requires this outcome: Assert every unit is present and carries exactly the expected tag.
 * @evidence contracts/testing.md#distinguishing-cases Withdraw a class with `@internal`, including a parameter property, and leave a public class beside it. Collect the inventory. Assert every unit is present and carries exactly the expected tag.
 * @evidence contracts/testing.md#execution-ownership TestWithdrawnClassTakesItsMembersOutOfThePopulation runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestWithdrawnClassTakesItsMembersOutOfThePopulation(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
/**
 * @internal
 */
export class Machinery {
  price: number = 0;
  constructor(public readonly currency: string) {}
  charge(): void {}
}
export class Contract {
  price: number = 0;
}
`)
  tagged := []string{}
  for _, unit := range inventory.Units {
    tagged = append(tagged, unit.Symbol+":"+unit.Target+"="+unit.Hidden)
  }
  sort.Strings(tagged)
  want := []string{
    "function:Machinery.prototype.charge=@internal",
    "property:Contract.prototype.price=",
    "property:Machinery.prototype.currency=@internal",
    "property:Machinery.prototype.price=@internal",
    "type:Contract=",
    "type:Machinery=@internal",
  }
  if strings.Join(tagged, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "withdrawn class units:\n%s\nwant:\n%s",
      strings.Join(tagged, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
