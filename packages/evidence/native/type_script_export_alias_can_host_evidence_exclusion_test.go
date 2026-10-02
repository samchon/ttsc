package evidence

import (
  "testing"
)

/**
 * Verifies a callable exported through a local alias remains an eligible JSDoc
 * host, including for an exclusion acknowledgement.
 *
 * Source materialization and claim-host selection use the same public
 * export analysis. Testing only source targets could leave aliased callables
 * visible as evidence while rejecting declarations attached to them.
 *
 *  1. Attach an exclusion to a local arrow-function `const`.
 *  2. Export that declaration under a public alias.
 *  3. Assert the function-only claim group accepts the host and exclusion.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the function-only claim group accepts the host and exclusion.
 * @evidence contracts/testing.md#independent-expectations Source materialization and claim-host selection use the same public export analysis. Testing only source targets could leave aliased callables visible as evidence while rejecting declarations attached to them. The authored scenario requires this outcome: Assert the function-only claim group accepts the host and exclusion.
 * @evidence contracts/testing.md#distinguishing-cases Attach an exclusion to a local arrow-function `const`. Export that declaration under a public alias. Assert the function-only claim group accepts the host and exclusion.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptExportAliasCanHostEvidenceExclusion runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptExportAliasCanHostEvidenceExclusion(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts": `
/** @evidenceExclude docs/spec.md#contract This adapter intentionally does not use the contract. */
const local = (): void => {};
export { local as publicAdapter };
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}
