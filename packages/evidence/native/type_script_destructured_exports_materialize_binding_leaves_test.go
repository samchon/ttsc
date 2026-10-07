package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies destructured exports: every public binding leaf materializes under
 * its local or aliased export name as a property.
 *
 * Object and array binding patterns have no declaration-level identifier.
 * Recursing through their leaves must preserve renamed, nested, rest, namespace,
 * and later export-list bindings without guessing callable values.
 *
 *  1. Export representative object and array binding patterns.
 *  2. Add namespace, alias, and private negative twins.
 *  3. Assert the exact public property inventory.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the exact public property inventory.
 * @evidence contracts/testing.md#independent-expectations Object and array binding patterns have no declaration-level identifier. Recursing through their leaves must preserve renamed, nested, rest, namespace, and later export-list bindings without guessing callable values. The authored scenario requires this outcome: Assert the exact public property inventory.
 * @evidence contracts/testing.md#distinguishing-cases Export representative object and array binding patterns. Add namespace, alias, and private negative twins. Assert the exact public property inventory.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptDestructuredExportsMaterializeBindingLeaves runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptDestructuredExportsMaterializeBindingLeaves(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
const source = {
  state: "ready",
  count: 1,
  nested: { enabled: true },
  extra: "rest",
};
const values = [1, 2, 3];

export const {
  state,
  count: publicCount,
  nested: { enabled = false },
  ...remaining,
} = source;
export const [first, , ...tail] = values;

const { extra: local } = source;
export { local as publicLocal };

const { state: hidden } = source;

export namespace Api {
  const source = { status: "ok", hidden: false };
  export const { status: current } = source;
  const { hidden } = source;
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:Api.current",
    "property:enabled",
    "property:first",
    "property:publicCount",
    "property:publicLocal",
    "property:remaining",
    "property:state",
    "property:tail",
    "type:Api",
  }
  sort.Strings(want)
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "destructured export units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
