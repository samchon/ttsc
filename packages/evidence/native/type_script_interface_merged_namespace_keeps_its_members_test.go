package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies an interface merged with a same-named namespace is untouched.
 *
 * `IShoppingSale` beside `namespace IShoppingSale` is how a type family spells
 * its variants, and both declarations are symbol `type` under one identity, so
 * they already materialize one unit and nothing competes for the name. The
 * correction must not reach it: dropping the namespace's members here would
 * erase `IShoppingSale.ICreate` from every population that selects types.
 *
 *  1. Merge an interface with a namespace declaring a nested variant.
 *  2. Collect the inventory.
 *  3. Assert the merged name is one unit and every nested member survives.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the merged name is one unit and every nested member survives.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `IShoppingSale` beside `namespace IShoppingSale` is how a type family spells its variants, and both declarations are symbol `type` under one identity, so they already materialize one unit and nothing competes for the name. The correction must not reach it: dropping the namespace's members here would erase `IShoppingSale.ICreate` from every population that selects types. The authored scenario requires this outcome: Assert the merged name is one unit and every nested member survives.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Merge an interface with a namespace declaring a nested variant. Collect the inventory. Assert the merged name is one unit and every nested member survives.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptInterfaceMergedNamespaceKeepsItsMembers runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptInterfaceMergedNamespaceKeepsItsMembers(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export interface IShoppingSale {
  id: string;
}
export namespace IShoppingSale {
  export interface ICreate {
    title: string;
  }
  export const DEFAULT_PAGE = 1;
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:IShoppingSale.DEFAULT_PAGE",
    "property:IShoppingSale.ICreate.title",
    "property:IShoppingSale.id",
    "type:IShoppingSale",
    "type:IShoppingSale.ICreate",
  }
  sort.Strings(want)
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "interface-merged namespace units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
