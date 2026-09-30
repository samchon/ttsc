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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies an aggregate evidence scope contributes each selected descendant identity. The original assertions check select the H3 descendant as well and assert the same citation now counts two.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Cardinality follows the graph's hierarchy rather than the number of written tags. One parent citation therefore counts as two selected units when that parent and its selected child are both obligations, and as one when only the parent is. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite one Markdown H2 scope from one function requiring exactly one unit. Assert the H2-only reference passes. Select the H3 descendant as well and assert the same citation now counts two. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingleEvidencePerSymbolExpandsHierarchicalScopes is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
