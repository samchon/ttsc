package evidence

import (
  "strings"
  "testing"
)

/**
 * TestEvidenceSemanticGraphResolvesMergedIdentityFromFirstDeclaration verifies merged identity diagnostics and citations share one canonical host.
 *
 * The original consumer fixture combines a later namespace citation with an
 * uncited TypeScript reference. The rule must count that citation without
 * relocating the identity diagnostic to the namespace declaration.
 *
 * 1. Run both original claims against the interface-first merge and later citation.
 * 2. Require the missing ISale acknowledgement at the literal first line and the nested ICreate obligation.
 * 3. Remove the later citation and require the independently named Markdown obligation.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual runIndexRule graph operation evaluates both original claims, retaining the first-declaration diagnostic and later-declaration citation acceptance; removing the citation changes the actual rule findings.
 * @evidence contracts/testing.md#independent-expectations The authored interface occupies src/ISale.ts line 1 and the literal sale-price heading supplies the expected Markdown target; neither expected address is calculated from the resulting inventory or diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases One deliberately uncited ledger keeps the initial population active while the later namespace citation discharges the document obligation; its removal exposes that obligation and prevents empty-population success.
 * @evidence contracts/testing.md#execution-ownership This named TestEvidenceSemantic source unit is selected by `go test` in the native package, invoking the actual parser and graph rule in process in independent named subcases without an installed compiler or native plugin subprocess.
 */
func TestEvidenceSemanticGraphResolvesMergedIdentityFromFirstDeclaration(t *testing.T) {
  files := map[string]string{
    "docs/spec.md":  "## Sale Price {#sale-price}\n",
    "src/ledger.ts": "export interface ILedger {}\n",
    "src/ISale.ts":  "export interface ISale {\n  price: number;\n}\n/** @evidence docs/spec.md#sale-price The contract mirrors this pricing rule. */\nexport namespace ISale {\n  export interface ICreate {\n    price: number;\n  }\n}\n",
  }
  config := `{"claims":[{"type":"typescript","files":["src/ledger.ts"],"symbol":"type","reference":{"type":"typescript","files":["src/ISale.ts"],"symbol":"type"}},{"type":"typescript","files":["src/**"],"symbol":"type","reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}}]}`
  t.Run("original", func(t *testing.T) {
    messages := runIndexRule(t, files, config)
    if len(messages) != 2 {
      t.Fatalf("the original graph must report its two uncited TypeScript identities: %v", messages)
    }
    assertProblemContains(t, messages, "Missing acknowledgement for 'ISale' (TypeScript type 'ISale' at src/ISale.ts:1)")
    assertProblemContains(t, messages, "Missing acknowledgement for 'ISale.ICreate'")
    if strings.Contains(strings.Join(messages, "\n"), "docs/spec.md#sale-price") {
      t.Fatalf("the later namespace citation must discharge its document obligation: %v", messages)
    }
  })
  files["src/ISale.ts"] = strings.Replace(files["src/ISale.ts"], "/** @evidence docs/spec.md#sale-price The contract mirrors this pricing rule. */\n", "", 1)
  t.Run("citation_removed", func(t *testing.T) {
    missing := runIndexRule(t, files, config)
    assertProblemContains(t, missing, "docs/spec.md#sale-price")
    assertProblemContains(t, missing, "Missing acknowledgement for 'ISale'")
  })

}
