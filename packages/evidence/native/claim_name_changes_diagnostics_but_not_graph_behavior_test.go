package evidence

import (
  "testing"
)

/**
 * Verifies diagnostic-only names: adding a claim name improves messages but
 * does not enter target identity or graph matching.
 *
 * A label accidentally used as an identity would make the same declaration
 * resolve in an unnamed graph and dangle in a named one. The green pair below
 * pins semantic equality, and the failing case pins diagnostic visibility.
 *
 *  1. Resolve the same target with and without a claim name.
 *  2. Assert both complete graphs are green.
 *  3. Remove the citation and assert the missing finding names the claim label and target.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule accepts the same citation with and without Friendly label, then reports the named claim after citation removal.
 * @evidence contracts/testing.md#independent-expectations Claim names are diagnostic labels, not graph identities; both accepted variants are independently required to be clean.
 * @evidence contracts/testing.md#distinguishing-cases The failing arm checks the label and target, but does not compare an unnamed failure's complete message.
 * @evidence contracts/testing.md#execution-ownership TestClaimNameChangesDiagnosticsButNotGraphBehavior is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestClaimNameChangesDiagnosticsButNotGraphBehavior(t *testing.T) {
  files := map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts": `
/** @evidence docs/spec.md#contract This type adopts the contract. */
export interface Ref {}
`,
  }
  baseClaim := `"type":"typescript","files":["src/ref.ts"],"symbol":"type","reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}`
  assertNoProblems(t, runIndexRule(t, files, `{"claims":[{`+baseClaim+`}]}`))
  assertNoProblems(t, runIndexRule(t, files, `{"claims":[{"name":"Friendly label",`+baseClaim+`}]}`))

  missingFiles := map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts":   "export interface Ref {}\n",
  }
  messages := runIndexRule(t, missingFiles, `{"claims":[{"name":"Friendly label",`+baseClaim+`}]}`)
  assertProblemContains(t, messages, "Claim 1 ('Friendly label')")
  assertProblemContains(t, messages, "'docs/spec.md#contract'")
}
