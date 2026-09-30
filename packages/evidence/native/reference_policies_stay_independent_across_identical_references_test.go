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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule cites one section from two functions under ordinary and uniqueEvidence references; exactly one unique failure must name reference 2.
 * @evidence contracts/testing.md#independent-expectations The ordinary obligation permits two positive hosts, while the strict twin independently allows at most one.
 * @evidence contracts/testing.md#distinguishing-cases Identical populations with different policy flags isolate policy ownership from resolution or selection; total graph diagnostics are not counted.
 * @evidence contracts/testing.md#execution-ownership TestReferencePoliciesStayIndependentAcrossIdenticalReferences is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
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
