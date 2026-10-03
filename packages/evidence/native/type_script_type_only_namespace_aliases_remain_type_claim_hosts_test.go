package evidence

import (
  "strings"
  "testing"
)

/**
 * TestTypeScriptTypeOnlyNamespaceAliasesRemainTypeClaimHosts verifies type-only namespace claim hosts: the locally declared namespace can
 * carry type evidence when its only public identity is a type export alias.
 *
 * The alias changes public resolution, not JSDoc ownership. A source inventory
 * fix that omits the declaration host would leave the new type target one-way.
 *
 *  1. Attach evidence to a local namespace.
 *  2. Export it only through a type alias.
 *  3. Assert a type-only claim accepts the host and an imported Public ancestor covers the original type/property population.
 *  4. Require the original uncited interface alone, then remove only the import and require unimported Public evidence and its uncovered obligations.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule accepts the local namespace host and the original imported Public ancestor citation. Appending BoundaryNamespaceUncited produces exactly its missing acknowledgement without unresolved targets; removing only the Public import produces the unimported Public diagnostic and exactly the five original type/property obligations.
 * @evidence contracts/testing.md#independent-expectations The alias changes public resolution, not JSDoc ownership. A source inventory fix that omits the declaration host would leave the new type target one-way. The local Markdown heading and imported Public declarations prescribe coverage independently. BoundaryNamespaceUncited is deliberately outside that ancestor; the missing-import contrast must refuse Public rather than infer an unrelated global target.
 * @evidence contracts/testing.md#distinguishing-cases The original local host and imported contracts/claim/use modules preserve type-only namespace resolution. An uncited interface activates one independent obligation; the missing-import twin keeps the declarations but removes the claimant's resolution authority.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptTypeOnlyNamespaceAliasesRemainTypeClaimHosts runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, and independent named subcases survive another subcase failure without installing a consumer or launching a product host.
 */
func TestTypeScriptTypeOnlyNamespaceAliasesRemainTypeClaimHosts(t *testing.T) {
  t.Run("local_namespace_host", func(t *testing.T) {
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
  })
  files := map[string]string{
    "src/contracts.ts": "namespace Local {\n  export interface Input { id: string; }\n  export type Options = { enabled: boolean };\n  export function execute(): void {}\n  export const state = 1;\n}\nexport type { Local as Public };\n",
    "src/claim.ts":     "import type { Public } from \"./contracts.js\";\n\n/** @evidence {@link Public} Documents the complete imported type namespace. */\nexport interface IClaim {}\n",
    "src/use.ts":       "import type { Public } from \"./contracts.js\";\n\nexport const input: Public.Input = { id: \"member\" };\nexport const options: Public.Options = { enabled: true };\n",
  }
  config := `{"claims":[{"type":"typescript","files":["src/claim.ts"],"symbol":"type","reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":["type","property"]}}]}`
  t.Run("imported_ancestor", func(t *testing.T) {
    assertNoProblems(t, runIndexRule(t, files, config))
  })
  originalContracts := files["src/contracts.ts"]
  files["src/contracts.ts"] += "\nexport interface BoundaryNamespaceUncited {}\n"
  t.Run("uncited_control", func(t *testing.T) {
    control := runIndexRule(t, files, config)
    if len(control) != 1 || !strings.Contains(control[0], "Missing acknowledgement for 'BoundaryNamespaceUncited'") {
      t.Fatalf("the original uncited namespace control must be the only finding: %v", control)
    }
    if strings.Contains(strings.Join(control, "\n"), "Unresolved evidence target") {
      t.Fatalf("the imported Public ancestor must remain resolved: %v", control)
    }
  })
  files["src/contracts.ts"] = originalContracts
  files["src/claim.ts"] = strings.Replace(files["src/claim.ts"], "import type { Public } from \"./contracts.js\";\n", "", 1)
  t.Run("missing_import", func(t *testing.T) {
    missingImport := runIndexRule(t, files, config)
    if len(missingImport) != 6 {
      t.Fatalf("the missing import must leave five obligations and its own diagnostic: %v", missingImport)
    }
    assertProblemContains(t, missingImport, "Unimported evidence target '{@link Public}'")
    assertProblemContains(t, missingImport, "'import type' is enough")
    for _, target := range []string{"Public", "Public.Input", "Public.Input.id", "Public.Options", "Public.Options.enabled"} {
      assertProblemContains(t, missingImport, "Missing acknowledgement for '"+target+"'")
    }
    if strings.Contains(strings.Join(missingImport, "\n"), "Unresolved evidence target") {
      t.Fatalf("the reference population exists; the claimant lacks its import: %v", missingImport)
    }
  })

}
