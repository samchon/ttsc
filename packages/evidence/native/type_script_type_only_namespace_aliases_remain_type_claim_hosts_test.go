package evidence

import (
  "testing"
)

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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert a type-only claim accepts the host.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The alias changes public resolution, not JSDoc ownership. A source inventory fix that omits the declaration host would leave the new type target one-way. The authored scenario requires this outcome: Assert a type-only claim accepts the host.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Attach evidence to a local namespace. Export it only through a type alias. Assert a type-only claim accepts the host.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptTypeOnlyNamespaceAliasesRemainTypeClaimHosts runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
