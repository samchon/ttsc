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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule first repeats a citation on one function, requiring Duplicate evidence without uniqueEvidence; moving it to a second function must report two distinct positive hosts.
 * @evidence contracts/testing.md#independent-expectations Unique ownership counts semantic implementations rather than written tag multiplicity.
 * @evidence contracts/testing.md#distinguishing-cases Repeated one-host tags versus two independent functions distinguish duplicate-edge reporting from unit-owner cardinality.
 * @evidence contracts/testing.md#execution-ownership TestUniqueEvidenceCountsSemanticHostsRatherThanDeclarations is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
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
