package evidence

import "testing"

/**
 * Verifies an aggregate evidence scope contributes each selected descendant identity.
 *
 * Cardinality follows the graph's hierarchy rather than the number of written tags. One parent citation therefore counts as two selected units when that parent and its selected child are both obligations, and as one when only the parent is.
 *
 *  1. Cite one Markdown H2 scope from one function requiring exactly one unit.
 *  2. Assert the H2-only reference passes.
 *  3. Select the H3 descendant as well and assert the same citation now counts two.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule cites Contract under H2-only selection and requires clean coverage; selecting its H3 child as well must report a two-unit cardinality violation.
 * @evidence contracts/testing.md#independent-expectations A scope contributes its distinct selected descendants, not merely one written tag.
 * @evidence contracts/testing.md#distinguishing-cases The same fixture and citation with shallow versus deep selectors isolate the denominator change.
 * @evidence contracts/testing.md#execution-ownership TestSingleEvidencePerSymbolExpandsHierarchicalScopes is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestSingleEvidencePerSymbolExpandsHierarchicalScopes(t *testing.T) {
  files := map[string]string{
    "docs/spec.md": "## Contract {#contract}\n\n### Validation {#validation}\n",
    "src/test.ts": `/** @evidence docs/spec.md#contract Covers the contract scope. */
export function testContract(): void {}
`,
  }
  shallow := runIndexRule(t, files, `{"claims":[{
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
  assertNoProblems(t, shallow)

  deep := runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":["h2","h3"],
      "singleEvidencePerSymbol":true
    }
  }]}`)
  assertProblemContains(t, deep, "cites 2 distinct selected evidence unit(s); singleEvidencePerSymbol requires exactly 1")
}
