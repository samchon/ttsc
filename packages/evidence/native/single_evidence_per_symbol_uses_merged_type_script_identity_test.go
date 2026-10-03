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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule reads two overload signatures plus a cited implementation under exactly-one evidence and requires silence.
 * @evidence contracts/testing.md#independent-expectations An exported overload set is one semantic function host; one implementation citation satisfies that identity.
 * @evidence contracts/testing.md#distinguishing-cases Unannotated signatures challenge physical-declaration host counting; clean-only results do not independently certify claim activation.
 * @evidence contracts/testing.md#execution-ownership TestSingleEvidencePerSymbolUsesMergedTypeScriptIdentity is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
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
