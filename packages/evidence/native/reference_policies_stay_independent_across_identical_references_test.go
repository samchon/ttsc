package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies identical references evaluate their policies independently.
 *
 * A declaration may participate in several overlapping obligations, but their policies cannot pool counts. Two hosts citing one shared unit must satisfy the ordinary reference and independently fail the strict twin over the same population.
 *
 *  1. Configure identical references, one ordinary and one requiring unique evidence.
 *  2. Cite their shared unit from two selected hosts.
 *  3. Assert only reference two reports its own cardinality.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies identical references evaluate their policies independently. The original assertions check assert only reference two reports its own cardinality.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A declaration may participate in several overlapping obligations, but their policies cannot pool counts. Two hosts citing one shared unit must satisfy the ordinary reference and independently fail the strict twin over the same population. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Configure identical references, one ordinary and one requiring unique evidence. Cite their shared unit from two selected hosts. Assert only reference two reports its own cardinality. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestReferencePoliciesStayIndependentAcrossIdenticalReferences is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestReferencePoliciesStayIndependentAcrossIdenticalReferences(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/one.ts": `/** @evidence docs/spec.md#contract First proof. */
export function one(): void {}
`,
    "src/two.ts": `/** @evidence docs/spec.md#contract Second proof. */
export function two(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":[
      {
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2"
      },
      {
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2",
        "uniqueEvidence":true
      }
    ]
  }]}`)
  if count := countProblemsContaining(messages, "uniqueEvidence allows at most 1"); count != 1 {
    t.Fatalf("expected exactly one independent policy failure, got %d:\n%s", count, strings.Join(problemMessages(messages), "\n"))
  }
  assertProblemContains(t, messages, "Claim 1 reference 2")
}
