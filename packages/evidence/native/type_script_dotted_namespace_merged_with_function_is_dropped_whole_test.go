package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies the dotted namespace form is dropped whole when its head merges.
 *
 * `namespace get.inner {}` is not one declaration with a dotted name , it is
 * nested module declarations, collected on a different branch than an ordinary
 * namespace body. So the merge has to be judged on the head, `get`, and take
 * the whole chain with it; judging the tail would materialize `get.inner`
 * beside the accessor and put the aggregate scope straight back.
 *
 *  1. Merge a function with a dotted namespace and declare an unmerged dotted
 *     twin beside it.
 *  2. Collect the inventory.
 *  3. Assert the merged chain is gone entirely and the twin is intact.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the merged chain is gone entirely and the twin is intact.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `namespace get.inner {}` is not one declaration with a dotted name , it is nested module declarations, collected on a different branch than an ordinary namespace body. So the merge has to be judged on the head, `get`, and take the whole chain with it; judging the tail would materialize `get.inner` beside the accessor and put the aggregate scope straight back. The authored scenario requires this outcome: Assert the merged chain is gone entirely and the twin is intact.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Merge a function with a dotted namespace and declare an unmerged dotted twin beside it. Collect the inventory. Assert the merged chain is gone entirely and the twin is intact.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptDottedNamespaceMergedWithFunctionIsDroppedWhole runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptDottedNamespaceMergedWithFunctionIsDroppedWhole(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export function get(): void {}
export namespace get.inner {
  export const path = () => "/get";
}

export function keep(): void {}
export namespace other.inner {
  export const path = () => "/other";
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:get",
    "function:keep",
    "function:other.inner.path",
    "type:get",
    "type:other",
    "type:other.inner",
  }
  sort.Strings(want)
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "dotted merged namespace units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
