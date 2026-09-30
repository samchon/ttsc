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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies hierarchically overlapping references retain independent policy counts. The original assertions check assert only the descendant-selecting reference fails its own count.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations An H2 scope can cover the H2 selected by one reference and the descendant H3 selected by another, but those are different obligation denominators. Counting the shared written target once globally would let either policy borrow the other's unit. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select an H2 in reference one and the H2 with its H3 descendant in reference two. Cite the H2 scope once under two single-evidence policies. Assert only the descendant-selecting reference fails its own count. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestReferencePoliciesStayIndependentAcrossHierarchicalReferences is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
