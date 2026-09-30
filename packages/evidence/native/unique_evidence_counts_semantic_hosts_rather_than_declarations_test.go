package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies unique evidence counts semantic claim hosts rather than declarations.
 *
 * Several tags on one exported function remain one implementation or proof, so repetition must not consume a unit's single owner. A second exported identity citing the same unit is the case the policy exists to reject.
 *
 *  1. Cite one unit twice from a single function under `uniqueEvidence`.
 *  2. Assert only the ordinary duplicate-tag diagnostic fires.
 *  3. Move the second citation onto another function and assert the unit reports two owners.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies unique evidence counts semantic claim hosts rather than declarations. The original assertions check move the second citation onto another function and assert the unit reports two owners.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Several tags on one exported function remain one implementation or proof, so repetition must not consume a unit's single owner. A second exported identity citing the same unit is the case the policy exists to reject. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite one unit twice from a single function under `uniqueEvidence`. Assert only the ordinary duplicate-tag diagnostic fires. Move the second citation onto another function and assert the unit reports two owners. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestUniqueEvidenceCountsSemanticHostsRatherThanDeclarations is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestUniqueEvidenceCountsSemanticHostsRatherThanDeclarations(t *testing.T) {
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "uniqueEvidence":true
    }
  }]}`
  oneHost := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/one.ts": `/**
 * @evidence docs/spec.md#contract First proof.
 * @evidence docs/spec.md#contract Repeated proof.
 */
export function one(): void {}
`,
  }, config)
  assertProblemContains(t, oneHost, "Duplicate @evidence")
  if strings.Contains(strings.Join(oneHost, "\n"), "uniqueEvidence") {
    t.Fatalf("repeated tags on one semantic host consumed its unique owner:\n%s", strings.Join(oneHost, "\n"))
  }

  twoHosts := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/one.ts": `/** @evidence docs/spec.md#contract First proof. */
export function one(): void {}
`,
    "src/two.ts": `/** @evidence docs/spec.md#contract Second proof. */
export function two(): void {}
`,
  }, config)
  assertProblemContains(t, twoHosts, "has 2 distinct positive evidence host(s); uniqueEvidence allows at most 1")
}
