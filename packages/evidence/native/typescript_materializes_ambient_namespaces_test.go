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
  const callback: () => void;
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
    "function:Ambient.Nested.work",
    "function:Ambient.Service.create",
    "function:Ambient.Service.prototype.callback",
    "function:Ambient.Service.prototype.run",
    "function:Ambient.execute",
    "function:Declared.run",
    "function:Ordinary.visible",
    "property:Ambient.Input.id",
    "property:Ambient.callback",
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

/**
 * Verifies ambient claim hosts: an implicitly exported namespace function can
 * carry a function-scoped evidence declaration.
 *
 * Unit visibility and JSDoc host eligibility share the same public boundary.
 * Fixing only inventory materialization leaves the function visible as
 * evidence but unable to claim its own evidence.
 *
 *  1. Attach an evidence tag to one implicit ambient function.
 *  2. Select function hosts and one Markdown heading.
 *  3. Assert the complete graph accepts the declaration.
 */
func TestTypeScriptAmbientNamespaceMembersAreClaimHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/contracts.d.ts": `
export namespace Ambient {
  /** @evidence docs/spec.md#contract This ambient API implements the contract. */
  function run(): void;
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/contracts.d.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}

/**
 * Verifies ambient extension coverage: every declaration-file extension
 * supported by the TypeScript artifact receives implicit namespace exports.
 *
 * The parser derives ambient context from the physical file name. Testing only
 * `.d.ts` would leave the module-specific `.d.mts` and `.d.cts` paths able to
 * regress independently.
 *
 *  1. Parse the same namespace under all declaration-file extensions.
 *  2. Collect its implicit function member.
 *  3. Assert each extension materializes the member.
 */
func TestTypeScriptDeclarationFileExtensionsUseAmbientNamespaceVisibility(t *testing.T) {
  for _, path := range []string{
    "src/contracts.d.ts",
    "src/contracts.d.mts",
    "src/contracts.d.cts",
  } {
    t.Run(path, func(t *testing.T) {
      inventory := parseTypeScriptInventory(t, path, `
export namespace Ambient {
  function run(): void;
}
`)
      found := false
      for _, unit := range inventory.Units {
        if unit.Symbol == "function" && unit.Target == "Ambient.run" {
          found = true
        }
      }
      if !found {
        t.Fatalf("%s did not materialize Ambient.run", path)
      }
    })
  }
}
