package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies that nothing declared inside a namespace merged with a same-named
 * function materializes as an evidence unit, at any depth and of any kind.
 *
 * Such a namespace is the function's static side rather than an independent
 * container: `get.path` is a property of the `get` function value and
 * `get.Output` is the type its own signature spells. Splitting the exclusion by
 * member kind would leave the same namespace reading as machinery under one
 * symbol selector and as public surface under another, so the population would
 * depend on which reference is looking at it. The ordinary namespace beside it
 * is the negative twin that keeps this from becoming "namespaces select
 * nothing".
 *
 *  1. Declare a function-merged namespace holding every member kind a namespace
 *     can hold, including a nested namespace and a class.
 *  2. Declare an ordinary namespace beside it, itself holding a function-merged
 *     pair, so the rule is exercised at depth and in both directions.
 *  3. Assert the exact public inventory: the merged namespaces contribute their
 *     own identities and nothing beneath them, while every ordinary member
 *     survives.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the exact public inventory: the merged namespaces contribute their own identities and nothing beneath them, while every ordinary member survives.
 * @evidence contracts/testing.md#independent-expectations Such a namespace is the function's static side rather than an independent container: `get.path` is a property of the `get` function value and `get.Output` is the type its own signature spells. Splitting the exclusion by member kind would leave the same namespace reading as machinery under one symbol selector and as public surface under another, so the population would depend on which reference is looking at it. The ordinary namespace beside it is the negative twin that keeps this from becoming "namespaces select nothing". The authored scenario requires this outcome: Assert the exact public inventory: the merged namespaces contribute their own identities and nothing beneath them, while every ordinary member survives.
 * @evidence contracts/testing.md#distinguishing-cases Declare a function-merged namespace holding every member kind a namespace can hold, including a nested namespace and a class. Declare an ordinary namespace beside it, itself holding a function-merged pair, so the rule is exercised at depth and in both directions. Assert the exact public inventory: the merged namespaces contribute their own identities and nothing beneath them, while every ordinary member survives.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptFunctionMergedNamespaceMembersAreNotUnits runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptFunctionMergedNamespaceMembersAreNotUnits(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export function get(connection: string): string {
  return get.simulate(connection);
}
export namespace get {
  export type Output = string;
  export const METADATA = { method: "GET" } as const;
  export const path = () => "/health";
  export interface Query {
    page: number;
  }
  export class Client {
    send(): void {}
  }
  export namespace nested {
    export const inner = (): void => {};
  }
}

export namespace catalog {
  export const size = 1;
  export const list = (): void => {};
  export interface Item {
    id: string;
  }
  export function find(): void {}
  export namespace find {
    export const path = () => "/find";
  }
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:catalog.find",
    "function:catalog.list",
    "function:get",
    "property:catalog.Item.id",
    "property:catalog.size",
    "type:catalog",
    "type:catalog.Item",
    "type:catalog.find",
    "type:get",
  }
  sort.Strings(want)
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "function-merged namespace units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
