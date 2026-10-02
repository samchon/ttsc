package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a class merged with a same-named namespace is untouched.
 *
 * Both halves of `class Service` beside `namespace Service` are `type` under one
 * identity, so they fold into one unit rather than colliding, and the ambiguity
 * this change removes never arose there. A correction keyed on the namespace
 * rather than on its merge partner would have caught it anyway and erased the
 * companion object every such class publishes.
 *
 *  1. Merge a class with a namespace declaring companion members.
 *  2. Collect the inventory.
 *  3. Assert the class callables and every namespace member survive.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the class callables and every namespace member survive.
 * @evidence contracts/testing.md#independent-expectations Both halves of `class Service` beside `namespace Service` are `type` under one identity, so they fold into one unit rather than colliding, and the ambiguity a function-merged namespace carries never arises there. A correction keyed on the namespace rather than on its merge partner would have caught it anyway and erased the companion object every such class publishes. The authored scenario requires this outcome: Assert the class callables and every namespace member survive.
 * @evidence contracts/testing.md#distinguishing-cases Merge a class with a namespace declaring companion members. Collect the inventory. Assert the class callables and every namespace member survive.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptClassMergedNamespaceKeepsItsMembers runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptClassMergedNamespaceKeepsItsMembers(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export class Service {
  static create(): void {}
  send(): void {}
}
export namespace Service {
  export const VERSION = 1;
  export const build = (): void => {};
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:Service.build",
    "function:Service.create",
    "function:Service.prototype.send",
    "property:Service.VERSION",
    "type:Service",
  }
  sort.Strings(want)
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "class-merged namespace units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
