package evidence

import "testing"

/**
 * Verifies overloaded declarations retain one semantic claim-host identity.
 *
 * Source positions distinguish overload declarations physically, but the public function is one graph unit. Cardinality must judge that semantic identity once and accept its implementation declaration's citation.
 *
 *  1. Declare two overload signatures and one implementation for one function.
 *  2. Put the only evidence tag on the implementation.
 *  3. Assert single-evidence cardinality sees one satisfied semantic host.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies overloaded declarations retain one semantic claim-host identity. The original assertions check assert single-evidence cardinality sees one satisfied semantic host.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Source positions distinguish overload declarations physically, but the public function is one graph unit. Cardinality must judge that semantic identity once and accept its implementation declaration's citation. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare two overload signatures and one implementation for one function. Put the only evidence tag on the implementation. Assert single-evidence cardinality sees one satisfied semantic host. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingleEvidencePerSymbolUsesMergedTypeScriptIdentity is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestSingleEvidencePerSymbolUsesMergedTypeScriptIdentity(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Parse {#parse}\n",
    "src/parse.ts": `export function parse(value: string): string;
export function parse(value: number): string;
/** @evidence docs/spec.md#parse Implements both public overloads. */
export function parse(value: string | number): string {
  return String(value);
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "singleEvidencePerSymbol":true
    }
  }]}`)
  assertNoProblems(t, messages)
}
