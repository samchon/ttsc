package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies type-only namespace aliases: type declarations and their properties
 * project under the alias without leaking value-space descendants.
 *
 * A namespace spans TypeScript's type and value spaces. Treating a type-only
 * export as fully public creates false function/property obligations, while
 * dropping it loses valid imported type paths.
 *
 * A nested class is the sharp case. Its name is type-space and projects, while
 * `Service.prototype.send` and `Service.make` are paths through the class
 * value, which a type-only alias exposes nothing to walk them from.
 *
 * An interface method signature is the case that reads like the class one and
 * is not. `Input.check` is a `function` unit and it projects, because an
 * interface declares nothing in value space, so there is no value for the alias
 * to withhold. The fixture carried no such member while three surfaces said a
 * type-only alias exposes no callables, which is how that sentence stayed
 * wrong. `Options.run` is the same member on an object-shaped type alias, and
 * it is here because the two containers share one collector: the argument that
 * nothing can break one without the other is worth stating, and worth being
 * able to fail.
 *
 *  1. Export one namespace through full and both type-only alias syntaxes.
 *  2. Include nested type and value declarations, an interface callable, an
 *     object-shaped type alias callable, and a class with its members.
 *  3. Assert the exact full and type-only projections.
 */
func TestTypeScriptTypeOnlyNamespaceAliasesProjectOnlyTypeSpace(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
namespace Local {
  export interface Input { id: string; check(): void; }
  export type Options = { enabled: boolean; run(): void };
  export namespace Nested {
    export interface Request { value: string; }
    export const retries = 1;
    export function run(): void {}
  }
  export const count = 1;
  export function execute(): void {}
  export class Service {
    send(): void {}
    static make(): void {}
  }
}

export { Local as Full };
export type { Local as Types };
export { type Local as SpecTypes };
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:Full.Input.check",
    "function:Full.Options.run",
    "function:SpecTypes.Options.run",
    "function:Types.Options.run",
    "function:Full.Nested.run",
    "function:Full.Service.make",
    "function:Full.Service.prototype.send",
    "function:Full.execute",
    "property:Full.Input.id",
    "property:Full.Nested.Request.value",
    "property:Full.Nested.retries",
    "property:Full.Options.enabled",
    "property:Full.count",
    "function:SpecTypes.Input.check",
    "function:Types.Input.check",
    "property:SpecTypes.Input.id",
    "property:SpecTypes.Nested.Request.value",
    "property:SpecTypes.Options.enabled",
    "property:Types.Input.id",
    "property:Types.Nested.Request.value",
    "property:Types.Options.enabled",
    "type:Full",
    "type:Full.Input",
    "type:Full.Nested",
    "type:Full.Nested.Request",
    "type:Full.Options",
    "type:Full.Service",
    "type:SpecTypes",
    "type:SpecTypes.Input",
    "type:SpecTypes.Nested",
    "type:SpecTypes.Nested.Request",
    "type:SpecTypes.Options",
    "type:SpecTypes.Service",
    "type:Types",
    "type:Types.Input",
    "type:Types.Nested",
    "type:Types.Nested.Request",
    "type:Types.Options",
    "type:Types.Service",
  }
  sort.Strings(want)
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "namespace alias projections:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }

  byTarget := map[string]*evidenceUnit{}
  for _, unit := range inventory.Units {
    byTarget[unit.Target] = unit
  }
  if byTarget["Types.Input"].ParentID != byTarget["Types"].ID ||
    byTarget["Types.Input.id"].ParentID != byTarget["Types.Input"].ID ||
    byTarget["Types.Nested.Request"].ParentID != byTarget["Types.Nested"].ID {
    t.Fatal("type-only alias projection lost its namespace hierarchy")
  }
}

/**
 * Verifies type-only namespace claim hosts: the locally declared namespace can
 * carry type evidence when its only public identity is a type export alias.
 *
 * The alias changes public resolution, not JSDoc ownership. A source inventory
 * fix that omits the declaration host would leave the new type target one-way.
 *
 *  1. Attach evidence to a local namespace.
 *  2. Export it only through a type alias.
 *  3. Assert a type-only claim accepts the host.
 */
func TestTypeScriptTypeOnlyNamespaceAliasesRemainTypeClaimHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/contracts.ts": `
/** @evidence docs/spec.md#contract This namespace defines the imported contract. */
namespace Local {
  export interface Input { id: string; }
}
export type { Local as Public };
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/contracts.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}
