package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies ambient namespace visibility: declaration-space members are
 * implicitly public while ordinary namespace members still require exports.
 *
 * TypeScript makes every member of an ambient namespace visible without an
 * `export` keyword. Applying that rule at file scope would overexpose global
 * declarations, so the positive and negative namespaces pin the traversal
 * boundary rather than only one missing member.
 *
 *  1. Parse declaration-file and `export declare namespace` members.
 *  2. Parse adjacent ordinary and unexported declaration-file namespaces.
 *  3. Assert the exact public type, property, and function inventory.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the exact public type, property, and function inventory.
 * @evidence contracts/testing.md#independent-expectations TypeScript makes every member of an ambient namespace visible without an `export` keyword. Applying that rule at file scope would overexpose global declarations, so the positive and negative namespaces pin the traversal boundary rather than only one missing member. The authored scenario requires this outcome: Assert the exact public type, property, and function inventory.
 * @evidence contracts/testing.md#distinguishing-cases Parse declaration-file and `export declare namespace` members. Parse adjacent ordinary and unexported declaration-file namespaces. Assert the exact public type, property, and function inventory.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptAmbientNamespacesImplicitlyExportMembers runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptAmbientNamespacesImplicitlyExportMembers(t *testing.T) {
  declaration := parseTypeScriptInventory(t, "src/contracts.d.ts", `
export namespace Ambient {
  interface Input {
    id: string;
    method(): void;
  }
  type Options = {
    enabled: boolean;
  };
  function execute(): void;
  const state: string;
  namespace Nested {
    function work(): void;
    const active: boolean;
  }
  class Service {
    run(): void;
    static create(): void;
    callback: () => void;
    protected hidden(): void;
  }
}

declare namespace GlobalOnly {
  function hidden(): void;
}
`)
  declared := parseTypeScriptInventory(t, "src/declared.ts", `
export declare namespace Declared {
  interface Input { id: string; }
  function run(): void;
  const state: string;
}

export namespace Ordinary {
  interface Hidden {}
  function hidden(): void;
  const hiddenState = 0;
  export interface Visible {}
  export function visible(): void;
  export const state = 1;
}
`)
  units := []string{}
  for _, inventory := range []*artifactInventory{declaration, declared} {
    for _, unit := range inventory.Units {
      units = append(units, unit.Symbol+":"+unit.Target)
    }
  }
  sort.Strings(units)
  want := []string{
    "function:Ambient.Input.method",
    "function:Ambient.Nested.work",
    "function:Ambient.Service.create",
    "function:Ambient.Service.prototype.callback",
    "function:Ambient.Service.prototype.run",
    "function:Ambient.execute",
    "function:Declared.run",
    "function:Ordinary.visible",
    "property:Ambient.Input.id",
    "property:Ambient.Nested.active",
    "property:Ambient.Options.enabled",
    "property:Ambient.state",
    "property:Declared.Input.id",
    "property:Declared.state",
    "property:Ordinary.state",
    "type:Ambient",
    "type:Ambient.Input",
    "type:Ambient.Nested",
    "type:Ambient.Options",
    "type:Ambient.Service",
    "type:Declared",
    "type:Declared.Input",
    "type:Ordinary",
    "type:Ordinary.Visible",
  }
  sort.Strings(want)
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "ambient namespace units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
