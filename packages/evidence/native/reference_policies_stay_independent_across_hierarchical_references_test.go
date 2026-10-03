package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies hierarchically overlapping references retain independent policy counts.
 *
 * An H2 scope can cover the H2 selected by one reference and the descendant H3 selected by another, but those are different obligation denominators. Counting the shared written target once globally would let either policy borrow the other's unit.
 *
 *  1. Select an H2 in reference one and the H2 with its H3 descendant in reference two.
 *  2. Cite the H2 scope once under two single-evidence policies.
 *  3. Assert only the descendant-selecting reference fails its own count.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule cites Contract once under H2-only and H2/H3 references; exactly one singleEvidencePerSymbol failure must name reference 2.
 * @evidence contracts/testing.md#independent-expectations Distinct selected descendants are counted inside each reference denominator; one H2 scope counts one in the shallow reference and two in the deep reference.
 * @evidence contracts/testing.md#distinguishing-cases The same source and target under two overlapping selectors detect globally shared counts; only policy-count and attribution are asserted.
 * @evidence contracts/testing.md#execution-ownership TestReferencePoliciesStayIndependentAcrossHierarchicalReferences is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestReferencePoliciesStayIndependentAcrossHierarchicalReferences(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n\n### Validation {#validation}\n",
    "src/test.ts": `/** @evidence docs/spec.md#contract Implements the contract scope. */
export function testContract(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":[
      {
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2",
        "singleEvidencePerSymbol":true
      },
      {
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":["h2","h3"],
        "singleEvidencePerSymbol":true
      }
    ]
  }]}`)
  if count := countProblemsContaining(messages, "singleEvidencePerSymbol"); count != 1 {
    t.Fatalf("expected one hierarchical-reference failure, got %d:\n%s", count, strings.Join(problemMessages(messages), "\n"))
  }
  assertProblemContains(t, messages, "Claim 1 reference 2")
}
