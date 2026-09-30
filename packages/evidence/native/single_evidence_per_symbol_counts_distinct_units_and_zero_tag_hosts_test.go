package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies single-evidence cardinality uses distinct units and includes silent hosts.
 *
 * Counting tags would let duplicate citations inflate one host and would never see a selected function with no JSDoc. The policy instead starts from every semantic claim unit and projects distinct covered reference-unit identities onto it.
 *
 *  1. Select an empty host, a duplicate-tag host, and a two-unit host.
 *  2. Require exactly one positive unit per semantic host.
 *  3. Assert only the zero-unit and two-unit hosts fail cardinality.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies single-evidence cardinality uses distinct units and includes silent hosts. The original assertions check assert only the zero-unit and two-unit hosts fail cardinality.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Counting tags would let duplicate citations inflate one host and would never see a selected function with no JSDoc. The policy instead starts from every semantic claim unit and projects distinct covered reference-unit identities onto it. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select an empty host, a duplicate-tag host, and a two-unit host. Require exactly one positive unit per semantic host. Assert only the zero-unit and two-unit hosts fail cardinality. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSingleEvidencePerSymbolCountsDistinctUnitsAndZeroTagHosts is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestSingleEvidencePerSymbolCountsDistinctUnitsAndZeroTagHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## First {#first}\n\n## Second {#second}\n",
    "src/tests.ts": `export function empty(): void {}

/**
 * @evidence docs/spec.md#first First proof.
 * @evidence docs/spec.md#first Repeated proof.
 */
export function duplicate(): void {}

/**
 * @evidence docs/spec.md#first First proof.
 * @evidence docs/spec.md#second Second proof.
 */
export function broad(): void {}
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
  if count := countProblemsContaining(messages, "singleEvidencePerSymbol requires exactly 1"); count != 2 {
    t.Fatalf("expected zero and broad hosts to fail cardinality, got %d:\n%s", count, strings.Join(problemMessages(messages), "\n"))
  }
  assertProblemContains(t, messages, "TypeScript function 'empty'")
  assertProblemContains(t, messages, "cites 0 distinct selected evidence unit(s)")
  assertProblemContains(t, messages, "TypeScript function 'broad'")
  assertProblemContains(t, messages, "cites 2 distinct selected evidence unit(s)")
  if strings.Contains(strings.Join(problemMessages(messages), "\n"), "TypeScript function 'duplicate'") {
    t.Fatalf("duplicate tags inflated the semantic host count:\n%s", strings.Join(problemMessages(messages), "\n"))
  }
  assertProblemContains(t, messages, "Duplicate @evidence")
}
