package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies TypeScript namespace and variable materialization: public namespaces
 * are types, and exported non-function const or mutable variables are properties.
 *
 * Module-level data and namespace state are public contract units just as type
 * properties are. Callable const variables retain the existing function kind
 * so one target never materializes as two selected kinds.
 *
 *  1. Declare public and private namespaces, variables, and callable variables.
 *  2. Collect every materialized target with its kind.
 *  3. Assert the exact public semantic inventory.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the exact public semantic inventory.
 * @evidence contracts/testing.md#independent-expectations Module-level data and namespace state are public contract units just as type properties are. Callable const variables retain the existing function kind so one target never materializes as two selected kinds. The authored scenario requires this outcome: Assert the exact public semantic inventory.
 * @evidence contracts/testing.md#distinguishing-cases Declare public and private namespaces, variables, and callable variables. Collect every materialized target with its kind. Assert the exact public semantic inventory.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptMaterializesNamespacesAndDataVariables runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptMaterializesNamespacesAndDataVariables(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export namespace Orders {
  export const count = 1;
  export let state = "open";
  export var legacy = false;
  export const run = (): void => {};
  const hidden = 0;

  export interface Input {
    id: string;
  }

  export namespace Retry {
    export const enabled = true;
  }
}

export namespace Outer.Inner {
  export let value = 1;
}

export const version = 1;
export declare const declaredCallback: () => void;
export let mutableCallback = (): void => {};
export const execute = (): void => {};
const local = 1;

namespace Private {
  export const member = 1;
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:Orders.run",
    "function:execute",
    "property:Orders.Input.id",
    "property:Orders.Retry.enabled",
    "property:Orders.count",
    "property:Orders.legacy",
    "property:Orders.state",
    "property:Outer.Inner.value",
    "property:declaredCallback",
    "property:mutableCallback",
    "property:version",
    "type:Orders",
    "type:Orders.Input",
    "type:Orders.Retry",
    "type:Outer",
    "type:Outer.Inner",
  }
  sort.Strings(want)
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf("TypeScript namespace/data units:\n%s\nwant:\n%s", strings.Join(units, "\n"), strings.Join(want, "\n"))
  }
}
